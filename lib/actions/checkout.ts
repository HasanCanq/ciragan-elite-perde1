'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { orderLimiter } from '@/lib/rate-limit';
import { validateAndBuildConsentedDocuments } from '@/lib/legal/document-versions';
import { validateCoupon, redeemCoupon, releaseCouponReservation } from '@/lib/promotions/coupon-service';
import {
  CartItem,
  Order,
  OrderInsert,
  OrderItemInsert,
  ApiResponse,
  PileFactor,
  PILE_COEFFICIENTS_UPPER,
  SHIPPING,
} from '@/types';
import {
  checkoutFormSchema,
  type CheckoutFormInput,
} from '@/lib/validations/checkout';
import { verifyAndExtract }           from '@/lib/engine/signer';
import { validateCalcInput }          from '@/lib/engine/validator';
import { calc, type CalculationType, type CoreCalcResult } from '@/lib/engine/core';
import {
  buildShippingSnapshot,
  buildBillingSnapshot,
  formatAddressText,
  type ShippingAddressSnapshot,
  type BillingAddressSnapshot,
} from '@/lib/actions/checkout-helpers';

// CheckoutFormInput ve CheckoutFormData re-export — tüketiciler doğrudan
// lib/validations/checkout'tan da import edebilir.
export type { CheckoutFormInput, CheckoutFormData } from '@/lib/validations/checkout';

// =====================================================
// VALİDASYON YARDIMCILARI (mevcut iç API)
// =====================================================

export interface StockValidationResult {
  valid: boolean;
  errors: string[];
  productStocks: Map<string, number>;
}

export interface PriceValidationResult {
  valid: boolean;
  errors: string[];
  serverCalculatedItems: OrderItemInsert[];
  serverSubtotal: number;
}

interface PlaceOrderResult {
  order: Order;
  orderNumber: string;
}

export type { LegalConsentInput } from '@/lib/validations/checkout';

/**
 * CoreCalcResult + ürün/kalem bağlamı → OrderItemInsert dönüşümü.
 * calculation_type_snapshot engine breakdown'dan alınır — hardcode yok.
 */
function buildOrderItemFromCalcResult(
  product:    { name: string; slug: string; images: string[] | null | undefined; base_price: number },
  cartItem:   CartItem,
  calcResult: CoreCalcResult
): OrderItemInsert {
  const { unitPrice, totalPrice, breakdown } = calcResult;

  let areaM2              = 0;
  let pileCoefficient     = 1;
  let pleatNameSnapshot: string | null = null;

  if (breakdown.calculationType === 'm2') {
    areaM2 = breakdown.effectiveAreaM2;
  } else if (breakdown.calculationType === 'mt') {
    areaM2            = breakdown.fabricMeters;
    pileCoefficient   = breakdown.multiplier;
    pleatNameSnapshot = breakdown.pleatName;
  }

  return {
    order_id:                   '',
    product_id:                 cartItem.productId,
    product_name:               product.name,
    product_slug:               product.slug,
    product_image:              product.images?.[0] || null,
    width_cm:                   cartItem.width,
    height_cm:                  cartItem.height,
    pile_factor:                cartItem.pileFactor,
    pleat_ratio_id:             cartItem.pleatId ?? null,
    pleat_name_snapshot:        pleatNameSnapshot,
    calculation_type_snapshot:  breakdown.calculationType,
    area_m2:                    areaM2,
    price_per_m2_snapshot:      product.base_price,
    pile_coefficient:           pileCoefficient,
    quantity:                   cartItem.quantity,
    unit_price:                 unitPrice,
    total_price:                totalPrice,
  };
}

export async function validateStock(
  cartItems: CartItem[],
  supabase:  Awaited<ReturnType<typeof createClient>>
): Promise<StockValidationResult> {
  const errors: string[]                    = [];
  const productStocks = new Map<string, number>();
  const productIds    = Array.from(new Set(cartItems.map((i) => i.productId)));

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, stock_quantity, is_published, in_stock')
    .in('id', productIds);

  if (error || !products) {
    return { valid: false, errors: ['Ürün bilgileri alınamadı'], productStocks };
  }

  const productMap        = new Map(products.map((p) => [p.id, p]));
  const demandMetersMap   = new Map<string, number>();

  for (const item of cartItems) {
    // item.pileCoefficient: mt türü için gerçek kumaş çarpanı (2.0/2.5/3.0);
    // m2/adet türü için 1. PILE_COEFFICIENTS_UPPER kullanmak m2 ürünlerde
    // çarpanı 2x'e çıkardığı için (SEYREK=2.0) CartItem'daki değeri kullanıyoruz.
    const requiredM2 =
      (item.width / 100) * (item.height / 100) * item.quantity * item.pileCoefficient;
    const cur         = demandMetersMap.get(item.productId) ?? 0;
    demandMetersMap.set(
      item.productId,
      Math.round((cur + requiredM2) * 1000) / 1000
    );
  }

  for (const [productId, requiredM2] of Array.from(demandMetersMap)) {
    const product = productMap.get(productId);
    if (!product)              { errors.push(`Ürün bulunamadı (ID: ${productId})`); continue; }
    if (!product.is_published) { errors.push(`"${product.name}" artık satışta değil`); continue; }
    if (!product.in_stock)     { errors.push(`"${product.name}" stokta yok`); continue; }

    const availableM2 = product.stock_quantity ?? 0;
    if (availableM2 < requiredM2) {
      errors.push(
        `"${product.name}" için yeterli kumaş yok. ` +
        `Gereken: ${requiredM2.toFixed(2)} m², Mevcut: ${availableM2.toFixed(2)} m²`
      );
      continue;
    }
    productStocks.set(productId, availableM2);
  }

  return { valid: errors.length === 0, errors, productStocks };
}

export async function validateAndCalculatePrices(
  cartItems: CartItem[],
  supabase:  Awaited<ReturnType<typeof createClient>>
): Promise<PriceValidationResult> {
  const errors: string[]                    = [];
  const serverCalculatedItems: OrderItemInsert[] = [];
  let serverSubtotal = 0;

  // ── Faz 1 (Nokta 8): Token doğrulama ──────────────────────────────────────
  // Tüm kalemler imzalı token gerektirir — geçiş dönemi sona erdi.
  for (const item of cartItems) {
    if (!item.priceToken) {
      errors.push(`${item.productName}: Fiyat tokeni eksik — lütfen ürünü yeniden yapılandırın`);
      continue;
    }

    const verified = verifyAndExtract(item.priceToken);
    if (!verified.ok) {
      const reason = verified.reason === 'EXPIRED'
        ? 'Fiyat hesabınızın süresi doldu — lütfen ürünü yeniden yapılandırın'
        : 'Geçersiz fiyat tokeni — lütfen ürünü yeniden yapılandırın';
      errors.push(`${item.productName}: ${reason}`);
      continue;
    }

    // Payload tutarlılık kontrolü: token, bu sepet kalemine ait olmalı
    const p = verified.data;
    if (
      p.productId !== item.productId ||
      p.widthCm   !== item.width     ||
      p.heightCm  !== item.height    ||
      p.quantity  !== item.quantity
    ) {
      errors.push(`${item.productName}: Fiyat tokeni kalem bilgileriyle uyuşmuyor`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, serverCalculatedItems, serverSubtotal };
  }

  // ── Faz 2 (Nokta 7): Motor pipeline ile server-side fiyat hesaplama ────────
  // NOT: validateStock() ile bu sorgu arasında TOCTOU penceresi var.
  // is_published + in_stock filtreleri burada da zorunludur; yayından kalkmış
  // ürünler her iki kontrol arasındaki sürede siparişe sızmamalıdır.
  const productIds = Array.from(new Set(cartItems.map((i) => i.productId)));
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug, images, base_price, calculation_type, min_width_cm, min_area_m2')
    .in('id', productIds)
    .eq('is_published', true)
    .eq('in_stock', true);

  if (error || !products) {
    return { valid: false, errors: ['Ürün fiyat bilgileri alınamadı'], serverCalculatedItems, serverSubtotal };
  }

  // Sorguda filtrelenen (yayından kalkmış/stok dışı) ürünleri yakala
  const fetchedIds = new Set(products.map((p) => p.id));
  for (const id of productIds) {
    if (!fetchedIds.has(id)) {
      const name = cartItems.find((i) => i.productId === id)?.productName ?? id;
      errors.push(`"${name}" artık satışta değil. Lütfen sepetinizi güncelleyin.`);
    }
  }
  if (errors.length > 0) {
    return { valid: false, errors, serverCalculatedItems, serverSubtotal };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // ── Pleat bilgilerini topla (mt türü kalemler için) ────────────────────────
  const pleatIds = Array.from(new Set(
    cartItems
      .filter((i) => {
        const calcType = (productMap.get(i.productId)?.calculation_type ?? i.calculationType) as CalculationType;
        return calcType === 'mt' && i.pleatId;
      })
      .map((i) => i.pleatId!)
  ));

  const pleatMap = new Map<string, { id: string; name: string; multiplier: number }>();
  if (pleatIds.length > 0) {
    const { data: pleatRows } = await supabase
      .from('product_pleats')
      .select('id, name, multiplier')
      .in('id', pleatIds);
    for (const pleat of pleatRows ?? []) {
      pleatMap.set(pleat.id, pleat);
    }
  }

  for (const item of cartItems) {
    const product = productMap.get(item.productId);
    if (!product) { errors.push(`Ürün bulunamadı: ${item.productName}`); continue; }

    const calcType = (product.calculation_type ?? item.calculationType) as CalculationType;

    // mt: pile UUID zorunlu
    if (calcType === 'mt') {
      if (!item.pleatId) {
        errors.push(`${item.productName}: Pile seçimi eksik`);
        continue;
      }
      if (!pleatMap.has(item.pleatId)) {
        errors.push(`${item.productName}: Pile seçeneği geçersiz veya devre dışı`);
        continue;
      }
    }

    // Tüm türler: tam motor pipeline
    const validated = validateCalcInput({
      calculationType: calcType,
      basePrice:       product.base_price,
      widthCm:         item.width,
      heightCm:        item.height,
      quantity:        item.quantity,
      pleat:           calcType === 'mt' ? pleatMap.get(item.pleatId!) : undefined,
      minWidthCm:      product.min_width_cm ?? undefined,
      minAreaM2:       product.min_area_m2  ?? undefined,
    });

    if (!validated.ok) {
      errors.push(`${item.productName}: ${validated.errors[0]?.message ?? 'Fiyat hesaplanamadı'}`);
      continue;
    }

    const calcResult = calc(validated.data);
    if (!calcResult.ok) {
      errors.push(`${item.productName}: ${calcResult.error.message}`);
      continue;
    }

    const { unitPrice, totalPrice } = calcResult.result;

    if (Math.abs(item.unitPrice - unitPrice) > 0.01) {
      console.warn(
        `[checkout] Fiyat uyuşmazlığı: ${item.productName} — Client: ${item.unitPrice}, Server: ${unitPrice}`
      );
    }

    serverCalculatedItems.push(buildOrderItemFromCalcResult(product, item, calcResult.result));

    serverSubtotal += totalPrice;
  }

  return { valid: errors.length === 0, errors, serverCalculatedItems, serverSubtotal };
}

// =====================================================
// ANA SİPARİŞ FONKSİYONU
// =====================================================

export async function placeOrder(
  cartItems:    CartItem[],
  rawFormData:  CheckoutFormInput,
  couponCode?:  string,
): Promise<ApiResponse<PlaceOrderResult>> {
  try {
    const supabase = await createClient();

    // ── 1. Kullanıcı doğrulama ────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Sipariş oluşturmak için giriş yapmalısınız', success: false };
    }

    // ── 2. Rate limit ─────────────────────────────────────────────────────
    const orderRateCheck = await orderLimiter.limit(user.id);
    if (!orderRateCheck.success) {
      return { data: null, error: 'Çok fazla sipariş isteği. Lütfen 1 dakika bekleyin.', success: false };
    }

    if (!cartItems?.length) {
      return { data: null, error: 'Sepetiniz boş', success: false };
    }

    // ── 3. Zod validasyonu + XSS sanitizasyonu ────────────────────────────
    const parsed = checkoutFormSchema.safeParse(rawFormData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const fieldPath  = firstError.path.join(' → ');
      const message    = fieldPath
        ? `${fieldPath}: ${firstError.message}`
        : firstError.message;
      return { data: null, error: message, success: false };
    }
    const formData = parsed.data;

    // ── 4. Yasal belge doğrulama ──────────────────────────────────────────
    const consentValidation = await validateAndBuildConsentedDocuments(
      formData.legalConsent.documentVersionIds
    );
    if (!consentValidation.valid) {
      return { data: null, error: consentValidation.error ?? 'Yasal belgeler onaylanmadı', success: false };
    }

    const reqHeaders  = await headers();
    const ipAddress   = (
      reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      reqHeaders.get('x-real-ip') ??
      '127.0.0.1'
    );
    const userAgent   = reqHeaders.get('user-agent') ?? '';

    // ── 5. Stok kontrolü ──────────────────────────────────────────────────
    const stockValidation = await validateStock(cartItems, supabase);
    if (!stockValidation.valid) {
      return { data: null, error: `Stok hatası: ${stockValidation.errors.join(', ')}`, success: false };
    }

    // ── 6. Fiyat doğrulama (server-side) ─────────────────────────────────
    const priceValidation = await validateAndCalculatePrices(cartItems, supabase);
    if (!priceValidation.valid) {
      return { data: null, error: `Fiyat hatası: ${priceValidation.errors.join(', ')}`, success: false };
    }

    const { serverCalculatedItems, serverSubtotal } = priceValidation;

    // ── 6.5. Kupon doğrulama (server-side re-validation) ─────────────────
    // Client'taki önizleme sonucuna güvenilmez; sipariş öncesi tekrar doğrulanır.
    // Bu aşama DB write yapmaz; yazma işlemi order kaydından sonra atomic RPC'de yapılır.
    let couponId:       string | null = null;
    let discountAmount: number        = 0;
    let appliedSegment: string | null = null;
    let couponCodeSnapshot: string | null = null;

    if (couponCode?.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();

      const [profileResult, orderCountResult] = await Promise.all([
        supabase.from('profiles').select('segment').eq('id', user.id).single(),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .neq('status', 'CANCELLED'),
      ]);

      const couponResult = await validateCoupon({
        code:         normalizedCode,
        subtotal:     serverSubtotal,
        userId:       user.id,
        userSegment:  (profileResult.data as any)?.segment ?? null,
        ipAddress,
        isFirstOrder: (orderCountResult.count ?? 0) === 0,
      });

      if (!couponResult.valid) {
        return { data: null, error: `Kupon hatası: ${couponResult.errorMessage}`, success: false };
      }

      couponId           = couponResult.couponId;
      discountAmount     = couponResult.discountAmount;
      appliedSegment     = couponResult.appliedSegment;
      couponCodeSnapshot = normalizedCode;
    }

    // İndirim tutarı sepet tutarını aşamaz (güvenlik tabanı)
    discountAmount = Math.min(discountAmount, serverSubtotal);

    const shippingCost  = serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    // Kupon indirimi subtotal'dan düşülür; kargo ücreti ayrı hesaplanır
    const discountedSubtotal = Math.round((serverSubtotal - discountAmount) * 100) / 100;
    const totalAmount        = Math.round((discountedSubtotal + shippingCost) * 100) / 100;

    // ── 7. Adres snapshot'larını hazırla ──────────────────────────────────
    const shippingSnapshot = buildShippingSnapshot(formData.shippingAddress);

    const effectiveBilling = formData.sameAsBilling
      ? null
      : formData.billingAddress!;

    const billingSnapshot: BillingAddressSnapshot | null = effectiveBilling
      ? buildBillingSnapshot(effectiveBilling)
      : null;

    const shippingText  = formatAddressText(shippingSnapshot);
    const billingText   = billingSnapshot ? formatAddressText(billingSnapshot) : null;

    const customerName  = shippingSnapshot.fullName;
    const customerPhone = shippingSnapshot.phone;

    // ── 8. Stokları düş ───────────────────────────────────────────────────
    const deductedItems: Array<{ productId: string; meters: number }> = [];

    for (const item of cartItems) {
      const requiredM2  = Math.round(
        (item.width / 100) * (item.height / 100) * item.quantity * item.pileCoefficient * 1000
      ) / 1000;

      const { error: stockError } = await supabase.rpc('check_and_deduct_stock', {
        p_product_id: item.productId,
        p_quantity:   requiredM2,
      });

      if (stockError) {
        console.error('Stok düşme hatası:', stockError);
        try {
          for (const d of deductedItems) {
            await supabase.rpc('restore_stock', {
              p_product_id: d.productId,
              p_quantity:   d.meters,
            });
          }
        } catch (restoreErr) {
          console.error('[CRITICAL] Kısmi stok geri alma başarısız:', {
            failedItem: item.productId, deductedItems, restoreErr,
          });
        }
        return {
          data:    null,
          error:   `Stok güncellenemedi: ${item.productName}. Lütfen tekrar deneyin.`,
          success: false,
        };
      }
      deductedItems.push({ productId: item.productId, meters: requiredM2 });
    }

    // ── 9. Sipariş kaydı ──────────────────────────────────────────────────
    const orderData: OrderInsert & {
      shipping_address_snapshot: ShippingAddressSnapshot;
      billing_address_snapshot:  BillingAddressSnapshot | null;
    } = {
      user_id:         user.id,
      customer_email:  formData.email,
      customer_name:   customerName,
      customer_phone:  customerPhone,

      // Legacy TEXT kolonlar (backward compat — kargo/eski kod okuyabilsin)
      shipping_address: shippingText,
      billing_address:  billingText,

      // Yeni JSONB snapshot kolonlar (kargo entegrasyonu, e-Fatura için)
      shipping_address_snapshot: shippingSnapshot,
      billing_address_snapshot:  billingSnapshot,

      subtotal:         serverSubtotal,
      shipping_cost:    shippingCost,
      discount_amount:  discountAmount,
      total_amount:     totalAmount,
      status:           'PENDING',
      customer_note:    formData.customerNote || null,
      payment_method:   formData.paymentMethod,
      // Kupon snapshot — NULL ise kupon kullanılmadı
      coupon_id:        couponId,
      coupon_code:      couponCodeSnapshot,
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError || !order) {
      for (const d of deductedItems) {
        await supabase.rpc('restore_stock', {
          p_product_id: d.productId,
          p_quantity:   d.meters,
        });
      }
      console.error('Sipariş oluşturma hatası:', orderError);
      return { data: null, error: 'Sipariş oluşturulamadı. Lütfen tekrar deneyin.', success: false };
    }

    // ── 9.5. Kupon rezervasyonu (atomic) ──────────────────────────────────
    // Sipariş kaydı oluşturuldu; şimdi kuponu kilitle.
    // Başarısız olursa order + stok geri alınır.
    let redemptionId: string | null = null;
    if (couponId && discountAmount > 0) {
      const redeemResult = await redeemCoupon({
        couponId,
        userId:         user.id,
        orderId:        order.id,
        subtotal:       serverSubtotal,
        discountAmount,
        appliedSegment,
        ipAddress,
      });

      if (!redeemResult.success) {
        // Rollback: order sil + stoku iade et
        await supabase.from('orders').delete().eq('id', order.id);
        for (const d of deductedItems) {
          await supabase.rpc('restore_stock', { p_product_id: d.productId, p_quantity: d.meters });
        }
        console.error('[placeOrder] Kupon rezervasyonu başarısız:', redeemResult.error);
        return { data: null, error: 'Kupon uygulanamadı. Lütfen tekrar deneyin.', success: false };
      }

      redemptionId = redeemResult.redemptionId;

      // Redemption ID'yi order kaydına bağla
      await supabase
        .from('orders')
        .update({ redemption_id: redemptionId })
        .eq('id', order.id);
    }

    // ── 10. Sipariş kalemleri ──────────────────────────────────────────────
    const itemsWithOrderId = serverCalculatedItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      for (const d of deductedItems) {
        await supabase.rpc('restore_stock', {
          p_product_id: d.productId,
          p_quantity:   d.meters,
        });
      }
      if (redemptionId) await releaseCouponReservation(redemptionId);
      console.error('Sipariş kalemleri ekleme hatası:', itemsError);
      return { data: null, error: 'Sipariş detayları kaydedilemedi. Lütfen tekrar deneyin.', success: false };
    }

    // ── 11. Yasal log (atomik) ─────────────────────────────────────────────
    const { error: legalLogError } = await supabase.rpc('insert_order_legal_log', {
      p_order_id:            order.id,
      p_user_id:             user.id,
      p_ip_address:          ipAddress,
      p_user_agent:          userAgent,
      p_consented_documents: JSON.stringify(consentValidation.documents),
      p_metadata:            JSON.stringify({
        payment_method: formData.paymentMethod,
        checkout_time:  new Date().toISOString(),
      }),
    });

    if (legalLogError) {
      await supabase.from('orders').delete().eq('id', order.id);
      for (const d of deductedItems) {
        await supabase.rpc('restore_stock', {
          p_product_id: d.productId,
          p_quantity:   d.meters,
        });
      }
      if (redemptionId) await releaseCouponReservation(redemptionId);
      console.error('Yasal log kaydı hatası — sipariş geri alındı:', legalLogError);
      return { data: null, error: 'Sipariş işlemi tamamlanamadı. Lütfen tekrar deneyin.', success: false };
    }

    // ── 12. Sepeti temizle ─────────────────────────────────────────────────
    await supabase.rpc('clear_user_cart', { p_user_id: user.id });

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');
    revalidatePath('/account/orders');

    return {
      data:    { order: order as Order, orderNumber: order.order_number },
      error:   null,
      success: true,
    };
  } catch (error) {
    console.error('placeOrder error:', error);
    return {
      data:    null,
      error:   error instanceof Error ? error.message : 'Sipariş oluşturulamadı',
      success: false,
    };
  }
}

// =====================================================
// ATOMIK SİPARİŞ (place_order_atomic RPC — Havale/EFT)
// =====================================================

export async function placeOrderAtomic(
  cartItems:    CartItem[],
  rawFormData:  CheckoutFormInput,
  couponCode?:  string,
): Promise<ApiResponse<PlaceOrderResult>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Giriş yapmalısınız', success: false };

    const rateCheck = await orderLimiter.limit(user.id);
    if (!rateCheck.success) {
      return { data: null, error: 'Çok fazla sipariş isteği. 1 dakika bekleyin.', success: false };
    }

    if (!cartItems?.length) return { data: null, error: 'Sepetiniz boş', success: false };

    // Zod validasyonu + sanitizasyon
    const parsed = checkoutFormSchema.safeParse(rawFormData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const fieldPath  = firstError.path.join(' → ');
      return {
        data:    null,
        error:   fieldPath ? `${fieldPath}: ${firstError.message}` : firstError.message,
        success: false,
      };
    }
    const formData = parsed.data;

    const consentValidation = await validateAndBuildConsentedDocuments(
      formData.legalConsent.documentVersionIds
    );
    if (!consentValidation.valid) {
      return { data: null, error: consentValidation.error ?? 'Yasal belgeler onaylanmadı', success: false };
    }

    const priceValidation = await validateAndCalculatePrices(cartItems, supabase);
    if (!priceValidation.valid) {
      return { data: null, error: `Fiyat hatası: ${priceValidation.errors.join(', ')}`, success: false };
    }

    const { serverCalculatedItems, serverSubtotal } = priceValidation;

    // Kupon doğrulama (server-side re-validation)
    let couponId:           string | null = null;
    let discountAmount:     number        = 0;
    let appliedSegment:     string | null = null;
    let couponCodeSnapshot: string | null = null;

    if (couponCode?.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const reqH           = await headers();
      const ipAddr         = reqH.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

      const [profileResult, orderCountResult] = await Promise.all([
        supabase.from('profiles').select('segment').eq('id', user.id).single(),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .neq('status', 'CANCELLED'),
      ]);

      const couponResult = await validateCoupon({
        code:         normalizedCode,
        subtotal:     serverSubtotal,
        userId:       user.id,
        userSegment:  (profileResult.data as any)?.segment ?? null,
        ipAddress:    ipAddr,
        isFirstOrder: (orderCountResult.count ?? 0) === 0,
      });

      if (!couponResult.valid) {
        return { data: null, error: `Kupon hatası: ${couponResult.errorMessage}`, success: false };
      }

      couponId           = couponResult.couponId;
      discountAmount     = Math.min(couponResult.discountAmount, serverSubtotal);
      appliedSegment     = couponResult.appliedSegment;
      couponCodeSnapshot = normalizedCode;
    }

    const shippingCost       = serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const discountedSubtotal = Math.round((serverSubtotal - discountAmount) * 100) / 100;
    const totalAmount        = Math.round((discountedSubtotal + shippingCost) * 100) / 100;

    const shippingSnapshot  = buildShippingSnapshot(formData.shippingAddress);
    const effectiveBilling  = formData.sameAsBilling ? null : formData.billingAddress!;
    const billingSnapshot   = effectiveBilling ? buildBillingSnapshot(effectiveBilling) : null;
    const customerName      = shippingSnapshot.fullName;

    const rpcItems = serverCalculatedItems.map((item, idx) => {
      const cartItem   = cartItems[idx];
      const stockDeductM2 = Math.round(
        (cartItem.width / 100) * (cartItem.height / 100) * cartItem.quantity * cartItem.pileCoefficient * 1000
      ) / 1000;

      return {
        product_id:              item.product_id,
        product_name:            item.product_name,
        product_slug:            item.product_slug,
        product_image:           item.product_image ?? null,
        width_cm:                item.width_cm,
        height_cm:               item.height_cm,
        pile_factor:             item.pile_factor,
        pleat_ratio_id:          item.pleat_ratio_id,
        pleat_name_snapshot:     null,
        mechanism_direction:     null,
        calculation_type_snapshot: item.calculation_type_snapshot,
        area_m2:                 item.area_m2,
        price_per_m2_snapshot:   item.price_per_m2_snapshot,
        pile_coefficient:        item.pile_coefficient,
        quantity:                item.quantity,
        unit_price:              item.unit_price,
        total_price:             item.total_price,
        stock_deduct_m2:         stockDeductM2,
      };
    });

    const rpcPayload = {
      user_id:          user.id,
      customer_email:   formData.email,
      customer_name:    customerName,
      customer_phone:   shippingSnapshot.phone,

      // Legacy TEXT
      shipping_address: formatAddressText(shippingSnapshot),
      billing_address:  billingSnapshot ? formatAddressText(billingSnapshot) : null,

      // JSONB snapshot'lar
      shipping_address_snapshot: shippingSnapshot,
      billing_address_snapshot:  billingSnapshot,

      subtotal:         serverSubtotal,
      shipping_cost:    shippingCost,
      discount_amount:  discountAmount,
      total_amount:     totalAmount,
      payment_method:   formData.paymentMethod,
      customer_note:    formData.customerNote || null,
      coupon_id:        couponId,
      coupon_code:      couponCodeSnapshot,
      items:            rpcItems,
    };

    const { data: rpcResult, error: rpcError } = await (supabase as any)
      .rpc('place_order_atomic', { p_payload: rpcPayload });

    if (rpcError) {
      console.error('[placeOrderAtomic] RPC hatası:', rpcError);
      return { data: null, error: 'Sipariş oluşturulamadı. Lütfen tekrar deneyin.', success: false };
    }

    if (!rpcResult?.success) {
      return { data: null, error: rpcResult?.error ?? 'Sipariş oluşturulamadı.', success: false };
    }

    const orderId = rpcResult.order_id as string;

    // Kupon rezervasyonu — order atomik oluşturuldu, şimdi kilitle
    let redemptionId: string | null = null;
    if (couponId && discountAmount > 0) {
      const reqH   = await headers();
      const ipAddr = reqH.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

      const redeemResult = await redeemCoupon({
        couponId,
        userId:         user.id,
        orderId,
        subtotal:       serverSubtotal,
        discountAmount,
        appliedSegment,
        ipAddress:      ipAddr,
      });

      if (!redeemResult.success) {
        await supabase.from('orders').update({ status: 'CANCELLED' }).eq('id', orderId).eq('status', 'PENDING');
        console.error('[placeOrderAtomic] Kupon rezervasyonu başarısız:', redeemResult.error);
        return { data: null, error: 'Kupon uygulanamadı. Lütfen tekrar deneyin.', success: false };
      }

      redemptionId = redeemResult.redemptionId;
      await supabase.from('orders').update({ redemption_id: redemptionId }).eq('id', orderId);
    }

    const reqHeaders = await headers();
    const ipAddress  = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    const userAgent  = reqHeaders.get('user-agent') ?? '';

    try {
      await supabase.rpc('insert_order_legal_log', {
        p_order_id:            orderId,
        p_user_id:             user.id,
        p_ip_address:          ipAddress,
        p_user_agent:          userAgent,
        p_consented_documents: JSON.stringify(consentValidation.documents),
        p_metadata:            JSON.stringify({ payment_method: formData.paymentMethod }),
      });
    } catch (legalErr) {
      console.error('[placeOrderAtomic] Yasal log hatası — sipariş iptal ediliyor:', legalErr);
      if (redemptionId) await releaseCouponReservation(redemptionId);
      await supabase.from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', orderId)
        .eq('status', 'PENDING');
      return { data: null, error: 'Sipariş işlemi tamamlanamadı.', success: false };
    }

    await supabase.rpc('clear_user_cart', { p_user_id: user.id });

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');
    revalidatePath('/account/orders');

    return {
      data: {
        order:       { id: orderId, order_number: rpcResult.order_number } as Order,
        orderNumber: rpcResult.order_number,
      },
      error:   null,
      success: true,
    };
  } catch (error) {
    console.error('[placeOrderAtomic] Beklenmedik hata:', error);
    return {
      data:    null,
      error:   error instanceof Error ? error.message : 'Sipariş oluşturulamadı',
      success: false,
    };
  }
}

// =====================================================
// ÖN DOĞRULAMA (Checkout sayfası hızlı feedback için)
// =====================================================

export async function validateOrder(
  cartItems: CartItem[]
): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: 'Oturum süresi doldu. Lütfen yeniden giriş yapın.', success: false };
    }

    if (!cartItems?.length) {
      return { data: { valid: false, errors: ['Sepetiniz boş'] }, error: null, success: true };
    }

    const stockValidation = await validateStock(cartItems, supabase);
    if (!stockValidation.valid) {
      return { data: { valid: false, errors: stockValidation.errors }, error: null, success: true };
    }

    const priceValidation = await validateAndCalculatePrices(cartItems, supabase);
    if (!priceValidation.valid) {
      return { data: { valid: false, errors: priceValidation.errors }, error: null, success: true };
    }

    return { data: { valid: true, errors: [] }, error: null, success: true };
  } catch (error) {
    console.error('validateOrder error:', error);
    return {
      data:    null,
      error:   error instanceof Error ? error.message : 'Doğrulama hatası',
      success: false,
    };
  }
}

// =====================================================
// SERVER-SIDE FİYAT HESAPLAMA (Frontend senkronizasyon)
// =====================================================

export async function getServerCalculatedPrices(
  cartItems: CartItem[]
): Promise<ApiResponse<{
  items: Array<{
    productId:         string;
    width:             number;
    height:            number;
    pileFactor:        PileFactor;
    serverUnitPrice:   number;
    serverTotalPrice:  number;
  }>;
  subtotal:     number;
  shippingCost: number;
  total:        number;
}>> {
  try {
    const supabase = await createClient();

    if (!cartItems?.length) {
      return {
        data: { items: [], subtotal: 0, shippingCost: SHIPPING.COST, total: SHIPPING.COST },
        error: null,
        success: true,
      };
    }

    const productIds = Array.from(new Set(cartItems.map((i) => i.productId)));
    const { data: products } = await supabase
      .from('products')
      .select('id, base_price')
      .in('id', productIds);

    if (!products) {
      return { data: null, error: 'Ürün fiyatları alınamadı', success: false };
    }

    const productMap = new Map(products.map((p) => [p.id, p.base_price]));

    const items = cartItems.map((item) => {
      const basePrice = productMap.get(item.productId) ?? 0;

      // PILE_COEFFICIENTS_UPPER değerleri (2.0 / 2.5 / 3.0) kumaş metre
      // çarpanlarıdır (mt türü için). Fiyat çarpanı DEĞILDIR.
      // Her hesap türü kendi formülünü kullanır:
      //   mt    → fabricMeters = en × pileKatsayisi / 100  (yükseklik dahil edilmez)
      //   m2    → alan = en × boy / 10000                  (pile uygulanmaz)
      //   adet  → birim fiyat sabit
      let unitPrice: number;
      if (item.calculationType === 'mt') {
        const fabricRatio = PILE_COEFFICIENTS_UPPER[item.pileFactor] ?? 2.0;
        const fabricMeters = (item.width / 100) * fabricRatio;
        unitPrice = Math.round(fabricMeters * basePrice * 100) / 100;
      } else if (item.calculationType === 'adet') {
        unitPrice = basePrice;
      } else {
        // m2 — saf alan; pile çarpanı yoktur
        const areaM2 = (item.width / 100) * (item.height / 100);
        unitPrice = Math.round(areaM2 * basePrice * 100) / 100;
      }

      return {
        productId:        item.productId,
        width:            item.width,
        height:           item.height,
        pileFactor:       item.pileFactor,
        serverUnitPrice:  unitPrice,
        serverTotalPrice: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    });

    const subtotal    = items.reduce((sum, i) => sum + i.serverTotalPrice, 0);
    const shippingCost = subtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const total        = Math.round((subtotal + shippingCost) * 100) / 100;

    return { data: { items, subtotal, shippingCost, total }, error: null, success: true };
  } catch (error) {
    console.error('getServerCalculatedPrices error:', error);
    return {
      data:    null,
      error:   error instanceof Error ? error.message : 'Fiyat hesaplama hatası',
      success: false,
    };
  }
}
