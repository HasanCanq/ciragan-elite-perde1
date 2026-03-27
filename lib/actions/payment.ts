'use server';

// =====================================================
// IYZICO PAYMENT SERVER ACTIONS
// PCI-DSS Uyumlu — Kart verisi ASLA sunucumuza gelmez.
// Iyzico Checkout Form (hosted iframe) kullanılır.
// =====================================================

import { createClient } from '@/lib/supabase/server';
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
} from '@/lib/actions/checkout';
import { logPaymentEvent } from '@/lib/payment-logger';
import { orderLimiter } from '@/lib/rate-limit';
import {
  CartItem,
  CheckoutFormData,
  ApiResponse,
  OrderInsert,
  Order,
  SHIPPING,
} from '@/types';

// =====================================================
// PCI-DSS UYUMLU: IYZICO CHECKOUT FORM (hosted iframe)
// Kart verisi SUNUCUMUZA GELMEZ — iyzico iframe'inde toplanır
// =====================================================

export interface CheckoutFormResult {
  orderId: string;
  orderNumber: string;
  /** Iyzico'nun iframe embed HTML'i — sayfada document.write ile render edilir */
  checkoutFormContent: string;
  /** Standalone ödeme sayfası URL'i (mobil fallback) */
  paymentPageUrl: string;
}

export async function initiateCheckoutFormPayment(
  cartItems: CartItem[],
  formData: CheckoutFormData
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

    // 1b. Profil: identity_number varsa kullan, yoksa Iyzico sandbox fallback
    //     (identity_number sütunu ileride eklenecek — graceful degradation)
    const { data: profile } = await supabase
      .from('profiles')
      .select('identity_number')
      .eq('id', user.id)
      .single();
    const identityNumber = (profile as any)?.identity_number?.trim() || '11111111111';

    // 2. Sepet kontrolü
    if (!cartItems || cartItems.length === 0) {
      return { data: null, error: 'Sepetiniz boş', success: false };
    }

    // 3. Stok kontrolü
    const stockValidation = await validateStock(cartItems, supabase);
    if (!stockValidation.valid) {
      return { data: null, error: `Stok hatası: ${stockValidation.errors.join(', ')}`, success: false };
    }

    // 4. Fiyat doğrulama (server-side)
    const priceValidation = await validateAndCalculatePrices(cartItems, supabase);
    if (!priceValidation.valid) {
      return { data: null, error: `Fiyat hatası: ${priceValidation.errors.join(', ')}`, success: false };
    }

    const { serverCalculatedItems, serverSubtotal } = priceValidation;
    const shippingCost = serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const totalAmount = Math.round((serverSubtotal + shippingCost) * 100) / 100;

    // 5. Stok düş
    for (const item of cartItems) {
      const { error: stockError } = await supabase.rpc('check_and_deduct_stock', {
        p_product_id: item.productId,
        p_quantity: item.quantity,
      });
      if (stockError) {
        return { data: null, error: `Stok güncellenemedi: ${item.productName}`, success: false };
      }
    }

    // 6. Sipariş oluştur (PENDING)
    const orderData: OrderInsert = {
      user_id: user.id,
      customer_email: formData.email,
      customer_name: formData.fullName,
      customer_phone: formData.phone || null,
      shipping_address: formData.shippingAddress,
      billing_address: formData.sameAsBilling
        ? formData.shippingAddress
        : formData.billingAddress || formData.shippingAddress,
      subtotal: serverSubtotal,
      shipping_cost: shippingCost,
      discount_amount: 0,
      total_amount: totalAmount,
      status: 'PENDING',
      customer_note: formData.customerNote || null,
      payment_method: 'credit_card',
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError || !order) {
      await restoreStock(supabase, cartItems);
      return { data: null, error: 'Sipariş oluşturulamadı', success: false };
    }

    // 7. Sipariş kalemleri
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(serverCalculatedItems.map(item => ({ ...item, order_id: order.id })));

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      await restoreStock(supabase, cartItems);
      return { data: null, error: 'Sipariş detayları kaydedilemedi', success: false };
    }

    // 8. Iyzico Checkout Form başlat — KARTSİZ istek
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/callback`;
    const basketItems: IyzicoBasketItem[] = serverCalculatedItems.map((item, idx) => ({
      id: item.product_id || `item-${idx}`,
      name: item.product_name,
      category1: 'Perde',
      itemType: 'PHYSICAL' as const,
      price: item.total_price.toFixed(2),
    }));

    if (shippingCost > 0) {
      basketItems.push({ id: 'shipping', name: 'Kargo Ücreti', category1: 'Kargo', itemType: 'PHYSICAL', price: shippingCost.toFixed(2) });
    }

    const nameParts = formData.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || formData.fullName;
    const lastName = nameParts.slice(1).join(' ') || formData.fullName;

    const checkoutRequest: IyzicoCheckoutFormRequest = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: order.id,
      price: serverSubtotal.toFixed(2),
      paidPrice: totalAmount.toFixed(2),
      currency: Iyzipay.CURRENCY.TRY,
      basketId: order.order_number,
      paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl,
      enabledInstallments: ['1', '2', '3', '6', '9'],
      buyer: {
        id: user.id,
        name: firstName,
        surname: lastName,
        gsmNumber: formData.phone ? `+90${formData.phone.replace(/\D/g, '').slice(-10)}` : undefined,
        email: formData.email,
        identityNumber, // profiles.identity_number → fallback: '11111111111'
        registrationAddress: formData.shippingAddress,
        ip,
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: { contactName: formData.fullName, city: 'Istanbul', country: 'Turkey', address: formData.shippingAddress },
      billingAddress: {
        contactName: formData.fullName,
        city: 'Istanbul',
        country: 'Turkey',
        address: formData.sameAsBilling ? formData.shippingAddress : formData.billingAddress || formData.shippingAddress,
      },
      basketItems,
    };

    logPaymentEvent(supabase, {
      order_id: order.id,
      user_id: user.id,
      event_type: 'PAYMENT_INITIATED',
      conversation_id: order.id,
      expected_amount: totalAmount,
      currency: 'TRY',
      ip_address: ip,
    });

    const formResult = await checkoutFormInitialize(checkoutRequest);

    if (formResult.status !== 'success') {
      await restoreStockAndCancelOrder(supabase, order.id, cartItems);
      logPaymentEvent(supabase, {
        order_id: order.id,
        user_id: user.id,
        event_type: 'THREEDS_INIT_FAILED',
        conversation_id: order.id,
        error_code: formResult.errorCode,
        error_message: formResult.errorMessage,
        expected_amount: totalAmount,
        ip_address: ip,
      });
      return { data: null, error: formResult.errorMessage || 'Ödeme formu başlatılamadı', success: false };
    }

    logPaymentEvent(supabase, {
      order_id: order.id,
      user_id: user.id,
      event_type: 'THREEDS_INIT_SUCCESS',
      conversation_id: order.id,
      expected_amount: totalAmount,
      ip_address: ip,
    });

    revalidatePath('/admin/orders');

    return {
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        checkoutFormContent: formResult.checkoutFormContent,
        paymentPageUrl: formResult.paymentPageUrl,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('initiateCheckoutFormPayment error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ödeme işlemi başarısız',
      success: false,
    };
  }
}

// =====================================================
// YARDIMCI FONKSİYONLAR
// =====================================================

async function restoreStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cartItems: CartItem[]
) {
  for (const item of cartItems) {
    await supabase.rpc('restore_stock', {
      p_product_id: item.productId,
      p_quantity: item.quantity,
    });
  }
}

async function restoreStockAndCancelOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  cartItems: CartItem[]
) {
  await restoreStock(supabase, cartItems);
  await supabase
    .from('orders')
    .update({
      status: 'CANCELLED',
      admin_note: 'Ödeme başlatılamadı - otomatik iptal',
    })
    .eq('id', orderId)
    .eq('status', 'PENDING');
}
