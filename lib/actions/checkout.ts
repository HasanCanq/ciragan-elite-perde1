'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { orderLimiter } from '@/lib/rate-limit';
import { validateAndBuildConsentedDocuments } from '@/lib/legal/document-versions';
import {
  CartItem,
  Order,
  OrderInsert,
  OrderItemInsert,
  ApiResponse,
  PILE_COEFFICIENTS_UPPER,
  SHIPPING,
} from '@/types';
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

// =====================================================
// ZOD ŞEMALARI
// =====================================================

const TR_PHONE_RE =
  /^(\+90|0090|90)?0?5\d{9}$|^05\d{9}$/;

const htmlEncode = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

const safeStr = (min: number, max = 500) =>
  z
    .string()
    .min(min, `En az ${min} karakter olmalıdır`)
    .max(max)
    .transform(htmlEncode);

const addressBaseSchema = z.object({
  firstName:     safeStr(3, 150),
  lastName:      z.string().max(150).transform(htmlEncode).default(''),
  phone:         z
    .string()
    .regex(TR_PHONE_RE, 'Geçerli bir Türkiye telefon numarası girin (örn: 05xx xxx xx xx)'),
  addressLine:   safeStr(10, 500),
  neighbourhood: z.string().max(150).transform(htmlEncode).optional(),
  district:      safeStr(2, 100),
  city:          safeStr(2, 100),
  postalCode:    z
    .string()
    .regex(/^\d{5}$/, 'Posta kodu 5 haneli rakam olmalıdır')
    .optional()
    .or(z.literal('')),
});

const billingAddressSchema = addressBaseSchema
  .extend({
    billingType:  z.enum(['INDIVIDUAL', 'CORPORATE']),
    taxNumber:    z.string().max(11).optional(),
    taxOffice:    z.string().max(150).transform(htmlEncode).optional(),
    companyName:  safeStr(3, 255).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.billingType !== 'CORPORATE') return;

    if (!d.taxNumber || !/^\d{10}$/.test(d.taxNumber)) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['taxNumber'],
        message: 'Kurumsal faturalama için 10 haneli VKN zorunludur',
      });
    }
    if (!d.taxOffice || d.taxOffice.trim().length < 2) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['taxOffice'],
        message: 'Kurumsal faturalama için vergi dairesi zorunludur',
      });
    }
    if (!d.companyName || d.companyName.trim().length < 3) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['companyName'],
        message: 'Kurumsal faturalama için şirket unvanı zorunludur',
      });
    }
  });

export const checkoutFormSchema = z
  .object({
    email:         z.string().email('Geçerli bir e-posta adresi girin').max(255),
    shippingAddress: addressBaseSchema,
    sameAsBilling: z.boolean(),
    billingAddress: billingAddressSchema.optional(),
    customerNote:  z.string().max(1000).transform(htmlEncode).optional(),
    paymentMethod: z.enum(
      ['credit_card'],
      { error: 'Geçerli bir ödeme yöntemi seçin' }
    ),
    legalConsent: z.object({
      documentVersionIds: z
        .array(z.string().uuid())
        .min(1, 'Yasal belgeler onaylanmalıdır'),
    }),
  })
  .superRefine((d, ctx) => {
    if (!d.sameAsBilling && !d.billingAddress) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['billingAddress'],
        message: 'Farklı fatura adresi seçildiğinde fatura adresi zorunludur',
      });
    }
  });

// =====================================================
// DIŞA AÇIK TİPLER
// =====================================================

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
export type CheckoutFormData  = z.output<typeof checkoutFormSchema>;

type AddressBase    = z.output<typeof addressBaseSchema>;
type BillingAddress = z.output<typeof billingAddressSchema>;

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

export interface LegalConsentInput {
  documentVersionIds: string[];
}

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
    const pileCoeff   = PILE_COEFFICIENTS_UPPER[item.pileFactor] ?? 1.0;
    const requiredM2  =
      (item.width / 100) * (item.height / 100) * item.quantity * pileCoeff;
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
  const productIds = Array.from(new Set(cartItems.map((i) => i.productId)));
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug, images, base_price, calculation_type, min_width_cm, min_area_m2')
    .in('id', productIds);

  if (error || !products) {
    return { valid: false, errors: ['Ürün fiyat bilgileri alınamadı'], serverCalculatedItems, serverSubtotal };
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
  rawFormData:  CheckoutFormInput
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
    const shippingCost  = serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const totalAmount   = Math.round((serverSubtotal + shippingCost) * 100) / 100;

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
      const pileCoeff   = PILE_COEFFICIENTS_UPPER[item.pileFactor] ?? 1.0;
      const requiredM2  = Math.round(
        (item.width / 100) * (item.height / 100) * item.quantity * pileCoeff * 1000
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
      discount_amount:  0,
      total_amount:     totalAmount,
      status:           'PENDING',
      customer_note:    formData.customerNote || null,
      payment_method:   formData.paymentMethod,
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
  rawFormData:  CheckoutFormInput
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
    const shippingCost = serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const totalAmount  = Math.round((serverSubtotal + shippingCost) * 100) / 100;

    const shippingSnapshot  = buildShippingSnapshot(formData.shippingAddress);
    const effectiveBilling  = formData.sameAsBilling ? null : formData.billingAddress!;
    const billingSnapshot   = effectiveBilling ? buildBillingSnapshot(effectiveBilling) : null;
    const customerName      = shippingSnapshot.fullName;

    const rpcItems = serverCalculatedItems.map((item, idx) => {
      const cartItem   = cartItems[idx];
      const pileCoeff  = PILE_COEFFICIENTS_UPPER[cartItem.pileFactor] ?? 1.0;
      const stockDeductM2 = Math.round(
        (cartItem.width / 100) * (cartItem.height / 100) * cartItem.quantity * pileCoeff * 1000
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
      discount_amount:  0,
      total_amount:     totalAmount,
      payment_method:   formData.paymentMethod,
      customer_note:    formData.customerNote || null,
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

    const reqHeaders = await headers();
    const ipAddress  = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
    const userAgent  = reqHeaders.get('user-agent') ?? '';

    try {
      await supabase.rpc('insert_order_legal_log', {
        p_order_id:            rpcResult.order_id,
        p_user_id:             user.id,
        p_ip_address:          ipAddress,
        p_user_agent:          userAgent,
        p_consented_documents: JSON.stringify(consentValidation.documents),
        p_metadata:            JSON.stringify({ payment_method: formData.paymentMethod }),
      });
    } catch (legalErr) {
      console.error('[placeOrderAtomic] Yasal log hatası — sipariş iptal ediliyor:', legalErr);
      await supabase.from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', rpcResult.order_id)
        .eq('status', 'PENDING');
      return { data: null, error: 'Sipariş işlemi tamamlanamadı.', success: false };
    }

    await supabase.rpc('clear_user_cart', { p_user_id: user.id });

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');
    revalidatePath('/account/orders');

    return {
      data: {
        order:       { id: rpcResult.order_id, order_number: rpcResult.order_number } as Order,
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
      return { data: { valid: false, errors: ['Giriş yapmalısınız'] }, error: null, success: true };
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
      // TODO: engine entegrasyonu sonrası priceToken'dan alınacak; fallback 0 = güvenli fail
      const basePrice = productMap.get(item.productId) ?? 0;
      const { unitPrice } = calculateServerPrice(
        item.width, item.height, item.pileFactor, basePrice
      );
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
