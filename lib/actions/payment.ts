'use server';

// =====================================================
// IYZICO PAYMENT SERVER ACTIONS
// PCI-DSS Uyumlu — Kart verisi ASLA sunucumuza gelmez.
// Iyzico Checkout Form (hosted iframe) kullanılır.
//
// Sipariş Akışı (ACID):
//   1. Zod validasyonu + XSS sanitizasyonu (sunucu tarafı)
//   2. Stok + fiyat ön doğrulaması (read-only)
//   3. place_order_atomic RPC → sipariş + kalemler + stok tek TX
//   4. Iyzico Checkout Form başlat
//   5. Başarısız → expire_pending_orders (service_role) ile atomik rollback
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import Iyzipay from 'iyzipay';
import {
  checkoutFormInitialize,
  type IyzicoCheckoutFormRequest,
  type IyzicoBasketItem,
} from '@/lib/iyzico';
import {
  validateStock,
  validateAndCalculatePrices,
  checkoutFormSchema,
  type CheckoutFormInput,
} from '@/lib/actions/checkout';
import {
  buildShippingSnapshot,
  buildBillingSnapshot,
  formatAddressText,
} from '@/lib/actions/checkout-helpers';
import { logPaymentEvent } from '@/lib/payment-logger';
import { orderLimiter } from '@/lib/rate-limit';
import {
  CartItem,
  ApiResponse,
  SHIPPING,
} from '@/types';

// Service-role client — sadece Iyzico başlatma hatasında atomik rollback için
function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =====================================================
// PCI-DSS UYUMLU: IYZICO CHECKOUT FORM (hosted iframe)
// Kart verisi SUNUCUMUZA GELMEZ — iyzico iframe'inde toplanır
// =====================================================

export interface CheckoutFormResult {
  orderId: string;
  orderNumber: string;
  /** Iyzico'nun iframe embed HTML'i — IyzicoCheckoutForm bileşeni tarafından DOM'a güvenli enjekte edilir */
  checkoutFormContent: string;
  /** Standalone ödeme sayfası URL'i (mobil fallback) */
  paymentPageUrl: string;
}

export async function initiateCheckoutFormPayment(
  cartItems: CartItem[],
  rawFormData: CheckoutFormInput
): Promise<ApiResponse<CheckoutFormResult>> {
  try {
    const supabase = await createClient();
    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

    // 1. Kullanıcı doğrulama
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Giriş yapmanız gerekiyor', success: false };

    // 1a. Sipariş rate limit — aynı hesap max 5 ödeme girişimi / dakika
    const rateCheck = await orderLimiter.limit(`checkout:${user.id}`);
    if (!rateCheck.success) {
      return {
        data: null,
        error: 'Çok fazla ödeme girişimi. Lütfen 1 dakika bekleyin.',
        success: false,
      };
    }

    // 2. Zod validasyonu + XSS sanitizasyonu
    //    Server Action olduğu için client'tan gelen her veri doğrulanmalıdır.
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

    // 3. Adres snapshot'larını oluştur — yapısal bütünlük korunur
    const shippingSnapshot = buildShippingSnapshot(formData.shippingAddress);
    const effectiveBilling = formData.sameAsBilling ? null : formData.billingAddress!;
    const billingSnapshot  = effectiveBilling ? buildBillingSnapshot(effectiveBilling) : null;
    // Iyzico ve DB için tek kaynak: snapshot üzerinden de-structuring
    const effectiveBillingSnapshot = billingSnapshot ?? shippingSnapshot;

    // 4. Profil: identity_number varsa kullan, yoksa Iyzico sandbox fallback
    const { data: profile } = await supabase
      .from('profiles')
      .select('identity_number')
      .eq('id', user.id)
      .single();
    const identityNumber = (profile as any)?.identity_number?.trim() || '11111111111';

    // 5. Sepet kontrolü
    if (!cartItems || cartItems.length === 0) {
      return { data: null, error: 'Sepetiniz boş', success: false };
    }

    // 6. Stok ön kontrolü (read-only — atomik RPC öncesi erken hata)
    const stockValidation = await validateStock(cartItems, supabase);
    if (!stockValidation.valid) {
      return { data: null, error: `Stok hatası: ${stockValidation.errors.join(', ')}`, success: false };
    }

    // 7. Fiyat doğrulama (server-side — motor pipeline)
    const priceValidation = await validateAndCalculatePrices(cartItems, supabase);
    if (!priceValidation.valid) {
      return { data: null, error: `Fiyat hatası: ${priceValidation.errors.join(', ')}`, success: false };
    }

    const { serverCalculatedItems, serverSubtotal } = priceValidation;
    const shippingCost = serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const totalAmount  = Math.round((serverSubtotal + shippingCost) * 100) / 100;

    // 8. place_order_atomic için kalem listesi
    //    stock_deduct_m2 = area_m2 * pile_coefficient * quantity
    //    expire_pending_orders (migration 016) aynı formülü ile restore eder.
    const rpcItems = serverCalculatedItems.map((item) => ({
      product_id:                item.product_id,
      product_name:              item.product_name,
      product_slug:              item.product_slug,
      product_image:             item.product_image ?? null,
      width_cm:                  item.width_cm,
      height_cm:                 item.height_cm,
      pile_factor:               item.pile_factor,
      pleat_ratio_id:            item.pleat_ratio_id,
      pleat_name_snapshot:       item.pleat_name_snapshot,
      mechanism_direction:       item.mechanism_direction ?? null,
      calculation_type_snapshot: item.calculation_type_snapshot,
      area_m2:                   item.area_m2,
      price_per_m2_snapshot:     item.price_per_m2_snapshot,
      pile_coefficient:          item.pile_coefficient,
      quantity:                  item.quantity ?? 1,
      unit_price:                item.unit_price,
      total_price:               item.total_price,
      stock_deduct_m2: Math.round(
        item.area_m2 * item.pile_coefficient * (item.quantity ?? 1) * 1000
      ) / 1000,
    }));

    const rpcPayload = {
      user_id:          user.id,
      customer_email:   formData.email,
      customer_name:    shippingSnapshot.fullName,
      customer_phone:   shippingSnapshot.phone,
      // DB TEXT kolonlar — kargo etiketi ve legacy okuma için
      shipping_address: formatAddressText(shippingSnapshot),
      billing_address:  billingSnapshot ? formatAddressText(billingSnapshot) : null,
      subtotal:         serverSubtotal,
      shipping_cost:    shippingCost,
      discount_amount:  0,
      total_amount:     totalAmount,
      payment_method:   'credit_card',
      customer_note:    formData.customerNote || null,
      items:            rpcItems,
    };

    logPaymentEvent(supabase, {
      user_id:         user.id,
      event_type:      'PAYMENT_INITIATED',
      expected_amount: totalAmount,
      currency:        'TRY',
      ip_address:      ip,
    });

    // 9. Atomik sipariş oluştur — sipariş + kalemler + stok düşme tek TX
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('place_order_atomic', { p_payload: rpcPayload });

    if (rpcError || !rpcResult?.success) {
      const errMsg = rpcResult?.error ?? rpcError?.message ?? 'Sipariş oluşturulamadı';
      console.error('[initiateCheckoutFormPayment] place_order_atomic hatası:', errMsg);
      return { data: null, error: errMsg, success: false };
    }

    const orderId     = rpcResult.order_id     as string;
    const orderNumber = rpcResult.order_number  as string;

    // 10. Iyzico Checkout Form başlat — KARTSİZ istek
    //     Adres alanları snapshot üzerinden de-structuring ile dinamik doldurulur.
    //     Sabit 'Istanbul' YOK — kullanıcının girdiği il/ilçe/posta kodu kullanılır.
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/callback`;

    const basketItems: IyzicoBasketItem[] = serverCalculatedItems.map((item, idx) => ({
      id:        item.product_id || `item-${idx}`,
      name:      item.product_name,
      category1: 'Perde',
      itemType:  'PHYSICAL' as const,
      price:     item.total_price.toFixed(2),
    }));

    if (shippingCost > 0) {
      basketItems.push({
        id: 'shipping', name: 'Kargo Ücreti', category1: 'Kargo',
        itemType: 'PHYSICAL', price: shippingCost.toFixed(2),
      });
    }

    const checkoutRequest: IyzicoCheckoutFormRequest = {
      locale:              Iyzipay.LOCALE.TR,
      conversationId:      orderId,
      price:               serverSubtotal.toFixed(2),
      paidPrice:           totalAmount.toFixed(2),
      currency:            Iyzipay.CURRENCY.TRY,
      basketId:            orderNumber,
      paymentChannel:      Iyzipay.PAYMENT_CHANNEL.WEB,
      paymentGroup:        Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl,
      enabledInstallments: ['1', '2', '3', '6', '9'],
      buyer: {
        id:                  user.id,
        name:                shippingSnapshot.firstName,
        surname:             shippingSnapshot.lastName,
        gsmNumber:           shippingSnapshot.phone
          ? `+90${shippingSnapshot.phone.replace(/\D/g, '').slice(-10)}`
          : undefined,
        email:               formData.email,
        identityNumber,
        registrationAddress: formatAddressText(shippingSnapshot),
        ip,
        city:                shippingSnapshot.city,
        country:             'Turkey',
      },
      shippingAddress: {
        contactName: shippingSnapshot.fullName,
        city:        shippingSnapshot.city,
        country:     'Turkey',
        address:     formatAddressText(shippingSnapshot),
      },
      billingAddress: {
        contactName: effectiveBillingSnapshot.fullName,
        city:        effectiveBillingSnapshot.city,
        country:     'Turkey',
        address:     formatAddressText(effectiveBillingSnapshot),
      },
      basketItems,
    };

    const formResult = await checkoutFormInitialize(checkoutRequest);

    if (formResult.status !== 'success') {
      // Iyzico formu başlatılamadı — atomik rollback: stok iade + sipariş iptal
      const adminSupabase = getAdminSupabase();
      await adminSupabase.rpc('expire_pending_orders', { p_order_ids: [orderId] });

      logPaymentEvent(supabase, {
        order_id:        orderId,
        user_id:         user.id,
        event_type:      'THREEDS_INIT_FAILED',
        conversation_id: orderId,
        error_code:      formResult.errorCode,
        error_message:   formResult.errorMessage,
        expected_amount: totalAmount,
        ip_address:      ip,
      });

      return { data: null, error: formResult.errorMessage || 'Ödeme formu başlatılamadı', success: false };
    }

    logPaymentEvent(supabase, {
      order_id:        orderId,
      user_id:         user.id,
      event_type:      'THREEDS_INIT_SUCCESS',
      conversation_id: orderId,
      expected_amount: totalAmount,
      ip_address:      ip,
    });

    revalidatePath('/admin/orders');

    return {
      data: {
        orderId,
        orderNumber,
        checkoutFormContent: formResult.checkoutFormContent,
        paymentPageUrl:      formResult.paymentPageUrl,
      },
      error:   null,
      success: true,
    };
  } catch (error) {
    console.error('initiateCheckoutFormPayment error:', error);
    return {
      data:    null,
      error:   error instanceof Error ? error.message : 'Ödeme işlemi başarısız',
      success: false,
    };
  }
}
