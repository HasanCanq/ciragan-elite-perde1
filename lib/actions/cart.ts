'use server';

// =====================================================
// CART SERVER ACTIONS - Sepet Senkronizasyonu
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  CartItem,
  ApiResponse,
  PileFactor,
} from '@/types';
import { validateCalcInput }    from '@/lib/engine/validator';
import { type CalculationType } from '@/lib/engine/core';

// =====================================================
// TİPLER
// =====================================================

interface CartItemDB {
  id: string;
  cart_id: string;
  product_id: string;
  width_cm: number;
  height_cm: number;
  pile_factor: PileFactor;
  quantity: number;
  created_at: string;
  updated_at: string;
}

// loadCart sorgusunun SELECT'te döndürdüğü alanların alt kümesi.
// CartItemDB tam tablo satırını temsil eder; cart_id/created_at/updated_at burada seçilmez.
type LoadedCartItem = Pick<CartItemDB, 'id' | 'product_id' | 'width_cm' | 'height_cm' | 'pile_factor' | 'quantity'>;

interface CartWithItems {
  id: string;
  user_id: string;
  items: LoadedCartItem[];
}

interface ServerCartItem {
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  pricePerM2: number;
  width: number;
  height: number;
  pileFactor: PileFactor;
  quantity: number;
  stockQuantity: number;
}

// =====================================================
// SEPET SENKRONIZASYONU
// =====================================================

/**
 * validateCalcInput() kullanarak her kalemi motor ile doğrular.
 * Geçersiz/manipüle edilmiş ölçüler DB'ye yazılmaz.
 * mt geçiş dönemi: pile UUID yok — boyut aralığı manuel kontrol.
 */
async function validateCartItems(
  items:    CartItem[],
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CartItem[]> {
  if (items.length === 0) return [];

  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { data: products } = await supabase
    .from('products')
    .select('id, base_price, calculation_type, min_width_cm, min_area_m2')
    .in('id', productIds);

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  // Pleat bilgilerini topla — mt türü kalemler için
  const pleatIds = Array.from(new Set(
    items
      .filter((i) => {
        const ct = (productMap.get(i.productId)?.calculation_type ?? i.calculationType) as CalculationType;
        return ct === 'mt' && i.pleatId;
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

  const valid: CartItem[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue; // DB'de bulunmayan ürün — güvenlik gereği atla

    const calcType = (product.calculation_type ?? item.calculationType) as CalculationType;

    // mt: pleatId yoksa veya DB'de bulunamıyorsa geç
    if (calcType === 'mt' && (!item.pleatId || !pleatMap.has(item.pleatId))) continue;

    // Tüm türler: tam motor validasyonu
    const result = validateCalcInput({
      calculationType: calcType,
      basePrice:       product.base_price,
      widthCm:         item.width,
      heightCm:        item.height,
      quantity:        item.quantity,
      pleat:           calcType === 'mt' ? pleatMap.get(item.pleatId!) : undefined,
      minWidthCm:      product.min_width_cm ?? null,
      minAreaM2:       product.min_area_m2  ?? null,
    });

    if (result.ok) valid.push(item);
  }

  return valid;
}

/**
 * Client-side sepeti veritabanına senkronize et
 * Kullanıcı giriş yaptığında veya sepet değiştiğinde çağrılır
 */
export async function syncCart(items: CartItem[]): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    // Kullanıcı kontrolü
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: 'Sepeti senkronize etmek için giriş yapmalısınız',
        success: false,
      };
    }

    // Kalem validasyonu: geçersiz/manipüle edilmiş ölçüleri DB'ye yazma
    const validItems = await validateCartItems(items, supabase);

    // Kullanıcının sepetini bul veya oluştur
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!cart) {
      const { data: newCart, error: createError } = await supabase
        .from('carts')
        .insert({ user_id: user.id })
        .select('id')
        .single();

      if (createError) throw createError;
      cart = newCart;
    }

    // Mevcut sepet kalemlerini sil
    await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id);

    // Yeni kalemleri ekle (yalnızca doğrulanmış kalemler)
    if (validItems.length > 0) {
      const cartItems = validItems.map((item) => ({
        cart_id: cart.id,
        product_id: item.productId,
        width_cm: item.width,
        height_cm: item.height,
        pile_factor: item.pileFactor,
        quantity: item.quantity,
      }));

      const { error: insertError } = await supabase
        .from('cart_items')
        .insert(cartItems);

      if (insertError) throw insertError;
    }

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('syncCart error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sepet senkronize edilemedi',
      success: false,
    };
  }
}

/**
 * Veritabanından sepeti yükle
 * Kullanıcı giriş yaptığında client-side sepeti güncellemek için kullanılır
 */
export async function loadCart(): Promise<ApiResponse<ServerCartItem[]>> {
  try {
    const supabase = await createClient();

    // Kullanıcı kontrolü
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: [],
        error: null,
        success: true,
      };
    }

    // Sepeti ve ürün bilgilerini birlikte getir
    const { data: cart } = await supabase
      .from('carts')
      .select(`
        id,
        cart_items (
          id,
          product_id,
          width_cm,
          height_cm,
          pile_factor,
          quantity
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
      return {
        data: [],
        error: null,
        success: true,
      };
    }

    // Ürün bilgilerini getir
    const productIds = cart.cart_items.map((item: LoadedCartItem) => item.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, name, slug, images, base_price, stock_quantity, is_published')
      .in('id', productIds)
      .eq('is_published', true);

    if (!products) {
      return {
        data: [],
        error: null,
        success: true,
      };
    }

    // Sepet kalemlerini ürün bilgileriyle birleştir
    const productMap = new Map(products.map((p) => [p.id, p]));

    const cartItems: ServerCartItem[] = cart.cart_items
      .filter((item: LoadedCartItem) => productMap.has(item.product_id))
      .map((item: LoadedCartItem) => {
        const product = productMap.get(item.product_id)!;
        return {
          productId: item.product_id,
          productName: product.name,
          productSlug: product.slug,
          productImage: product.images?.[0] || null,
          pricePerM2: product.base_price,
          width: item.width_cm,
          height: item.height_cm,
          pileFactor: item.pile_factor as PileFactor,
          quantity: item.quantity,
          stockQuantity: product.stock_quantity,
        };
      });

    return {
      data: cartItems,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('loadCart error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sepet yüklenemedi',
      success: false,
    };
  }
}

/**
 * Veritabanındaki sepeti temizle
 */
export async function clearServerCart(): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: null,
        success: true,
      };
    }

    // Sepeti bul ve temizle
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (cart) {
      await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);
    }

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('clearServerCart error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sepet temizlenemedi',
      success: false,
    };
  }
}

/**
 * Sepete tek ürün ekle (server-side)
 */
export async function addToServerCart(
  productId: string,
  width: number,
  height: number,
  pileFactor: PileFactor,
  quantity: number
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: 'Giriş yapmalısınız',
        success: false,
      };
    }

    // Ürün kontrolü
    const { data: product } = await supabase
      .from('products')
      .select('id, stock_quantity, is_published')
      .eq('id', productId)
      .eq('is_published', true)
      .single();

    if (!product) {
      return {
        data: null,
        error: 'Ürün bulunamadı',
        success: false,
      };
    }

    if (product.stock_quantity < quantity) {
      return {
        data: null,
        error: 'Yeterli stok yok',
        success: false,
      };
    }

    // Sepeti bul veya oluştur
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!cart) {
      const { data: newCart, error: createError } = await supabase
        .from('carts')
        .insert({ user_id: user.id })
        .select('id')
        .single();

      if (createError) throw createError;
      cart = newCart;
    }

    // Aynı özelliklerde ürün var mı kontrol et
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .eq('width_cm', width)
      .eq('height_cm', height)
      .eq('pile_factor', pileFactor)
      .single();

    if (existingItem) {
      // Miktarı güncelle
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: existingItem.quantity + quantity })
        .eq('id', existingItem.id);

      if (updateError) throw updateError;
    } else {
      // Yeni kalem ekle
      const { error: insertError } = await supabase
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          product_id: productId,
          width_cm: width,
          height_cm: height,
          pile_factor: pileFactor,
          quantity,
        });

      if (insertError) throw insertError;
    }

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('addToServerCart error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürün sepete eklenemedi',
      success: false,
    };
  }
}

/**
 * Sepetteki ürün miktarını güncelle
 */
export async function updateServerCartItemQuantity(
  productId: string,
  width: number,
  height: number,
  pileFactor: PileFactor,
  quantity: number
): Promise<ApiResponse<null>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: 'Giriş yapmalısınız',
        success: false,
      };
    }

    // Sepeti bul
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!cart) {
      return {
        data: null,
        error: 'Sepet bulunamadı',
        success: false,
      };
    }

    if (quantity <= 0) {
      // Kalemi sil
      await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .eq('width_cm', width)
        .eq('height_cm', height)
        .eq('pile_factor', pileFactor);
    } else {
      // Miktarı güncelle
      await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .eq('width_cm', width)
        .eq('height_cm', height)
        .eq('pile_factor', pileFactor);
    }

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateServerCartItemQuantity error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Miktar güncellenemedi',
      success: false,
    };
  }
}

/**
 * Sepetten ürün kaldır
 */
export async function removeFromServerCart(
  productId: string,
  width: number,
  height: number,
  pileFactor: PileFactor
): Promise<ApiResponse<null>> {
  return updateServerCartItemQuantity(productId, width, height, pileFactor, 0);
}
