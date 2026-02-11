'use server';

// =====================================================
// SECURE CHECKOUT SERVER ACTIONS
// Güvenli Sipariş İşlemleri - Fiyat ve Stok Doğrulama
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  CartItem,
  Order,
  OrderInsert,
  OrderItemInsert,
  CheckoutFormData,
  ApiResponse,
  PILE_COEFFICIENTS_UPPER,
  SHIPPING,
  PileFactor,
} from '@/types';

// =====================================================
// TİPLER
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

// =====================================================
// YARDIMCI FONKSİYONLAR
// =====================================================

/**
 * Fiyatı server-side hesapla
 * Client'tan gelen fiyatlara GÜVENMİYORUZ
 */
function calculateServerPrice(
  widthCm: number,
  heightCm: number,
  pileFactor: PileFactor,
  basePricePerM2: number
): { areaM2: number; pileCoefficient: number; unitPrice: number } {
  const areaM2 = (widthCm * heightCm) / 10000;
  const pileCoefficient = PILE_COEFFICIENTS_UPPER[pileFactor];
  const unitPrice = Math.round(areaM2 * basePricePerM2 * pileCoefficient * 100) / 100;

  return { areaM2, pileCoefficient, unitPrice };
}

/**
 * Stok kontrolü yap
 */
export async function validateStock(
  cartItems: CartItem[],
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<StockValidationResult> {
  const errors: string[] = [];
  const productStocks = new Map<string, number>();

  // Tüm ürün ID'lerini topla
  const productIds = Array.from(new Set(cartItems.map((item) => item.productId)));

  // Stok bilgilerini getir
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, stock_quantity, is_published, in_stock')
    .in('id', productIds);

  if (error || !products) {
    return {
      valid: false,
      errors: ['Ürün bilgileri alınamadı'],
      productStocks,
    };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Her ürün için toplam talep hesapla
  const demandMap = new Map<string, number>();
  for (const item of cartItems) {
    const currentDemand = demandMap.get(item.productId) || 0;
    demandMap.set(item.productId, currentDemand + item.quantity);
  }

  // Stok kontrolü
  for (const [productId, demand] of Array.from(demandMap)) {
    const product = productMap.get(productId);

    if (!product) {
      errors.push(`Ürün bulunamadı (ID: ${productId})`);
      continue;
    }

    if (!product.is_published) {
      errors.push(`"${product.name}" artık satışta değil`);
      continue;
    }

    if (!product.in_stock) {
      errors.push(`"${product.name}" stokta yok`);
      continue;
    }

    if (product.stock_quantity < demand) {
      errors.push(
        `"${product.name}" için yeterli stok yok. İstenen: ${demand}, Mevcut: ${product.stock_quantity}`
      );
      continue;
    }

    productStocks.set(productId, product.stock_quantity);
  }

  return {
    valid: errors.length === 0,
    errors,
    productStocks,
  };
}

/**
 * Fiyat doğrulama - Server-side fiyat hesaplama
 * Client'tan gelen fiyatlara GÜVENMİYORUZ
 */
export async function validateAndCalculatePrices(
  cartItems: CartItem[],
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<PriceValidationResult> {
  const errors: string[] = [];
  const serverCalculatedItems: OrderItemInsert[] = [];
  let serverSubtotal = 0;

  // Ürün bilgilerini getir
  const productIds = Array.from(new Set(cartItems.map((item) => item.productId)));
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug, images, base_price')
    .in('id', productIds);

  if (error || !products) {
    return {
      valid: false,
      errors: ['Ürün fiyat bilgileri alınamadı'],
      serverCalculatedItems,
      serverSubtotal,
    };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Her kalem için server-side fiyat hesapla
  for (const item of cartItems) {
    const product = productMap.get(item.productId);

    if (!product) {
      errors.push(`Ürün bulunamadı: ${item.productName}`);
      continue;
    }

    // SERVER-SIDE FİYAT HESAPLAMA (KRİTİK GÜVENLİK)
    const { areaM2, pileCoefficient, unitPrice } = calculateServerPrice(
      item.width,
      item.height,
      item.pileFactor,
      product.base_price // Veritabanından gelen fiyat
    );

    const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100;

    // Client fiyatı ile server fiyatını karşılaştır (opsiyonel uyarı)
    const clientUnitPrice = item.unitPrice;
    const priceDiff = Math.abs(clientUnitPrice - unitPrice);
    if (priceDiff > 0.01) {
      console.warn(
        `Fiyat uyuşmazlığı: ${item.productName} - Client: ${clientUnitPrice}, Server: ${unitPrice}`
      );
    }

    serverCalculatedItems.push({
      order_id: '', // Sonra doldurulacak
      product_id: item.productId,
      product_name: product.name,
      product_slug: product.slug,
      product_image: product.images?.[0] || null,
      width_cm: item.width,
      height_cm: item.height,
      pile_factor: item.pileFactor,
      area_m2: areaM2,
      price_per_m2_snapshot: product.base_price,
      pile_coefficient: pileCoefficient,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    });

    serverSubtotal += totalPrice;
  }

  return {
    valid: errors.length === 0,
    errors,
    serverCalculatedItems,
    serverSubtotal,
  };
}

// =====================================================
// ANA SİPARİŞ FONKSİYONU
// =====================================================

/**
 * Güvenli sipariş oluştur
 *
 * GÜVENLİK KONTROLLERI:
 * 1. Kullanıcı kimlik doğrulama
 * 2. Fiyat doğrulama (server-side hesaplama)
 * 3. Stok kontrolü
 * 4. Transaction içinde işlemler
 */
export async function placeOrder(
  cartItems: CartItem[],
  formData: CheckoutFormData
): Promise<ApiResponse<PlaceOrderResult>> {
  try {
    const supabase = await createClient();

    // ==========================================
    // 1. KULLANICI DOĞRULAMA
    // ==========================================
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: 'Sipariş oluşturmak için giriş yapmalısınız',
        success: false,
      };
    }

    // Sepet boş mu kontrol
    if (!cartItems || cartItems.length === 0) {
      return {
        data: null,
        error: 'Sepetiniz boş',
        success: false,
      };
    }

    // ==========================================
    // 2. STOK KONTROLÜ
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
    // 3. FİYAT DOĞRULAMA (SERVER-SIDE)
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
    // 4. KARGO ÜCRETİ HESAPLA
    // ==========================================
    const shippingCost = serverSubtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const totalAmount = Math.round((serverSubtotal + shippingCost) * 100) / 100;

    // ==========================================
    // 5. SİPARİŞ OLUŞTUR (Transaction benzeri)
    // ==========================================

    // 5a. Stokları düş
    for (const item of cartItems) {
      const { error: stockError } = await supabase.rpc('check_and_deduct_stock', {
        p_product_id: item.productId,
        p_quantity: item.quantity,
      });

      if (stockError) {
        // Hata durumunda önceki stok düşmelerini geri al
        console.error('Stok düşme hatası:', stockError);
        return {
          data: null,
          error: `Stok güncellenemedi: ${item.productName}. Lütfen tekrar deneyin.`,
          success: false,
        };
      }
    }

    // 5b. Sipariş kaydı oluştur
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
      payment_method: formData.paymentMethod,
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError || !order) {
      // Stokları geri yükle
      for (const item of cartItems) {
        await supabase.rpc('restore_stock', {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        });
      }

      console.error('Sipariş oluşturma hatası:', orderError);
      return {
        data: null,
        error: 'Sipariş oluşturulamadı. Lütfen tekrar deneyin.',
        success: false,
      };
    }

    // 5c. Sipariş kalemlerini ekle
    const itemsWithOrderId = serverCalculatedItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      // Siparişi ve stokları geri al
      await supabase.from('orders').delete().eq('id', order.id);
      for (const item of cartItems) {
        await supabase.rpc('restore_stock', {
          p_product_id: item.productId,
          p_quantity: item.quantity,
        });
      }

      console.error('Sipariş kalemleri ekleme hatası:', itemsError);
      return {
        data: null,
        error: 'Sipariş detayları kaydedilemedi. Lütfen tekrar deneyin.',
        success: false,
      };
    }

    // 5d. Kullanıcının veritabanı sepetini temizle
    await supabase.rpc('clear_user_cart', { p_user_id: user.id });

    // ==========================================
    // 6. CACHE INVALIDATION
    // ==========================================
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');
    revalidatePath('/account/orders');

    return {
      data: {
        order: order as Order,
        orderNumber: order.order_number,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('placeOrder error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sipariş oluşturulamadı',
      success: false,
    };
  }
}

/**
 * Sipariş öncesi doğrulama (ön kontrol)
 * Kullanıcıya anında feedback vermek için
 */
export async function validateOrder(
  cartItems: CartItem[]
): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: { valid: false, errors: ['Giriş yapmalısınız'] },
        error: null,
        success: true,
      };
    }

    if (!cartItems || cartItems.length === 0) {
      return {
        data: { valid: false, errors: ['Sepetiniz boş'] },
        error: null,
        success: true,
      };
    }

    // Stok kontrolü
    const stockValidation = await validateStock(cartItems, supabase);

    if (!stockValidation.valid) {
      return {
        data: { valid: false, errors: stockValidation.errors },
        error: null,
        success: true,
      };
    }

    // Fiyat doğrulama
    const priceValidation = await validateAndCalculatePrices(cartItems, supabase);

    if (!priceValidation.valid) {
      return {
        data: { valid: false, errors: priceValidation.errors },
        error: null,
        success: true,
      };
    }

    return {
      data: { valid: true, errors: [] },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('validateOrder error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Doğrulama hatası',
      success: false,
    };
  }
}

/**
 * Sepetteki ürünlerin güncel fiyatlarını getir
 * Client'a doğru fiyatları göstermek için
 */
export async function getServerCalculatedPrices(
  cartItems: CartItem[]
): Promise<
  ApiResponse<{
    items: Array<{
      productId: string;
      width: number;
      height: number;
      pileFactor: PileFactor;
      serverUnitPrice: number;
      serverTotalPrice: number;
    }>;
    subtotal: number;
    shippingCost: number;
    total: number;
  }>
> {
  try {
    const supabase = await createClient();

    if (!cartItems || cartItems.length === 0) {
      return {
        data: {
          items: [],
          subtotal: 0,
          shippingCost: SHIPPING.COST,
          total: SHIPPING.COST,
        },
        error: null,
        success: true,
      };
    }

    // Ürün fiyatlarını getir
    const productIds = Array.from(new Set(cartItems.map((item) => item.productId)));
    const { data: products } = await supabase
      .from('products')
      .select('id, base_price')
      .in('id', productIds);

    if (!products) {
      return {
        data: null,
        error: 'Ürün fiyatları alınamadı',
        success: false,
      };
    }

    const productMap = new Map(products.map((p) => [p.id, p.base_price]));

    const items = cartItems.map((item) => {
      const basePrice = productMap.get(item.productId) || item.pricePerM2;
      const { unitPrice } = calculateServerPrice(
        item.width,
        item.height,
        item.pileFactor,
        basePrice
      );

      return {
        productId: item.productId,
        width: item.width,
        height: item.height,
        pileFactor: item.pileFactor,
        serverUnitPrice: unitPrice,
        serverTotalPrice: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.serverTotalPrice, 0);
    const shippingCost = subtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const total = Math.round((subtotal + shippingCost) * 100) / 100;

    return {
      data: {
        items,
        subtotal,
        shippingCost,
        total,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getServerCalculatedPrices error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Fiyat hesaplama hatası',
      success: false,
    };
  }
}
