'use server';

// =====================================================
// IYZICO PAYMENT SERVER ACTIONS
// 3D Secure Kredi Kartı Ödeme İşlemleri
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import Iyzipay from 'iyzipay';
import {
  threedsInitialize,
  type IyzicoThreedsInitRequest,
  type IyzicoBasketItem,
} from '@/lib/iyzico';
import {
  validateStock,
  validateAndCalculatePrices,
} from '@/lib/actions/checkout';
import {
  CartItem,
  CheckoutFormData,
  CreditCardData,
  ThreedsInitResult,
  ApiResponse,
  OrderInsert,
  Order,
  SHIPPING,
} from '@/types';

// =====================================================
// ANA ÖDEME FONKSİYONU
// =====================================================

export async function initiateCreditCardPayment(
  cartItems: CartItem[],
  formData: CheckoutFormData,
  cardData: CreditCardData
): Promise<ApiResponse<ThreedsInitResult>> {
  try {
    const supabase = await createClient();
    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      '127.0.0.1';

    // ==========================================
    // 1. KULLANICI DOĞRULAMA
    // ==========================================
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: 'Giriş yapmanız gerekiyor', success: false };
    }

    // ==========================================
    // 2. KART VERİSİ DOĞRULAMA
    // ==========================================
    if (
      !cardData.cardHolderName ||
      !cardData.cardNumber ||
      !cardData.expireMonth ||
      !cardData.expireYear ||
      !cardData.cvc
    ) {
      return { data: null, error: 'Kart bilgileri eksik', success: false };
    }

    // ==========================================
    // 3. SEPET KONTROLÜ
    // ==========================================
    if (!cartItems || cartItems.length === 0) {
      return { data: null, error: 'Sepetiniz boş', success: false };
    }

    // ==========================================
    // 4. STOK KONTROLÜ
    // ==========================================
    const stockValidation = await validateStock(cartItems, supabase);

    if (!stockValidation.valid) {
      return {
        data: null,
        error: `Stok hatası: ${stockValidation.errors.join(', ')}`,
        success: false,
      };
    }

    // ==========================================
    // 5. FİYAT DOĞRULAMA (SERVER-SIDE)
    // ==========================================
    const priceValidation = await validateAndCalculatePrices(cartItems, supabase);

    if (!priceValidation.valid) {
      return {
        data: null,
        error: `Fiyat hatası: ${priceValidation.errors.join(', ')}`,
        success: false,
      };
    }

    const { serverCalculatedItems, serverSubtotal } = priceValidation;

    // ==========================================
    // 6. KARGO & TOPLAM HESAPLA
    // ==========================================
    const shippingCost =
      serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const totalAmount =
      Math.round((serverSubtotal + shippingCost) * 100) / 100;

    // ==========================================
    // 7. STOK DÜŞME
    // ==========================================
    for (const item of cartItems) {
      const { error: stockError } = await supabase.rpc(
        'check_and_deduct_stock',
        {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        }
      );

      if (stockError) {
        console.error('Stok düşme hatası:', stockError);
        return {
          data: null,
          error: `Stok güncellenemedi: ${item.productName}`,
          success: false,
        };
      }
    }

    // ==========================================
    // 8. SİPARİŞ OLUŞTUR (PENDING)
    // ==========================================
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
      // Stokları geri yükle
      await restoreStock(supabase, cartItems);
      console.error('Sipariş oluşturma hatası:', orderError);
      return {
        data: null,
        error: 'Sipariş oluşturulamadı',
        success: false,
      };
    }

    // Sipariş kalemlerini ekle
    const itemsWithOrderId = serverCalculatedItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      await restoreStock(supabase, cartItems);
      console.error('Sipariş kalemleri hatası:', itemsError);
      return {
        data: null,
        error: 'Sipariş detayları kaydedilemedi',
        success: false,
      };
    }

    // ==========================================
    // 9. IYZICO 3DS BAŞLAT
    // ==========================================
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/callback`;

    // Basket items: Iyzico sum(basketItem.price) = price alanına eşit olmalı
    const basketItems: IyzicoBasketItem[] = serverCalculatedItems.map(
      (item, idx) => ({
        id: item.product_id || `item-${idx}`,
        name: item.product_name,
        category1: 'Perde',
        itemType: 'PHYSICAL' as const,
        price: item.total_price.toFixed(2),
      })
    );

    // Kargo ücreti varsa basket item olarak ekle
    if (shippingCost > 0) {
      basketItems.push({
        id: 'shipping',
        name: 'Kargo Ücreti',
        category1: 'Kargo',
        itemType: 'PHYSICAL',
        price: shippingCost.toFixed(2),
      });
    }

    const nameParts = formData.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || formData.fullName;
    const lastName = nameParts.slice(1).join(' ') || formData.fullName;

    const iyzicoRequest: IyzicoThreedsInitRequest = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: order.id,
      price: serverSubtotal.toFixed(2),
      paidPrice: totalAmount.toFixed(2),
      currency: Iyzipay.CURRENCY.TRY,
      installment: '1',
      basketId: order.order_number,
      paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl,
      paymentCard: {
        cardHolderName: cardData.cardHolderName,
        cardNumber: cardData.cardNumber.replace(/\s/g, ''),
        expireMonth: cardData.expireMonth,
        expireYear: cardData.expireYear,
        cvc: cardData.cvc,
        registerCard: '0',
      },
      buyer: {
        id: user.id,
        name: firstName,
        surname: lastName,
        gsmNumber: formData.phone
          ? `+90${formData.phone.replace(/\D/g, '').slice(-10)}`
          : undefined,
        email: formData.email,
        identityNumber: '11111111111',
        registrationAddress: formData.shippingAddress,
        ip,
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: formData.fullName,
        city: 'Istanbul',
        country: 'Turkey',
        address: formData.shippingAddress,
      },
      billingAddress: {
        contactName: formData.fullName,
        city: 'Istanbul',
        country: 'Turkey',
        address: formData.sameAsBilling
          ? formData.shippingAddress
          : formData.billingAddress || formData.shippingAddress,
      },
      basketItems,
    };

    const iyzicoResult = await threedsInitialize(iyzicoRequest);

    if (iyzicoResult.status !== 'success') {
      // Ödeme başlatılamadı - geri al
      await restoreStockAndCancelOrder(supabase, order.id, cartItems);
      console.error('Iyzico 3DS init hatası:', iyzicoResult.errorMessage);
      return {
        data: null,
        error: iyzicoResult.errorMessage || 'Ödeme başlatılamadı',
        success: false,
      };
    }

    // ==========================================
    // 10. 3DS HTML DÖNÜŞÜ
    // ==========================================
    const decodedHtml = Buffer.from(
      iyzicoResult.threeDSHtmlContent,
      'base64'
    ).toString('utf-8');

    revalidatePath('/admin/orders');

    return {
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        threeDSHtmlContent: decodedHtml,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('initiateCreditCardPayment error:', error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : 'Ödeme işlemi başarısız',
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
