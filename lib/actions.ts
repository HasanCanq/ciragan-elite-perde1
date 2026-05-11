'use server';

// =====================================================
// ÇIRAĞAN ELITE PERDE - SERVER ACTIONS
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  Product,
  ProductWithCategory,
  Category,
  Order,
  OrderWithItems,
  OrderItem,
  OrderInsert,
  OrderItemInsert,
  CartItem,
  ApiResponse,
  PaginatedResponse,
  PILE_COEFFICIENTS_UPPER,
  SHIPPING,
  OrderStatus,
  Profile,
  type CalculationType,
} from '@/types';
import { type CheckoutFormData } from '@/lib/validations/checkout';

// =====================================================
// ÜRÜN İŞLEMLERİ
// =====================================================

/**
 * Yayındaki tüm ürünleri getir
 */
export async function getProducts(): Promise<ApiResponse<ProductWithCategory[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      data: data as ProductWithCategory[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getProducts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürünler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Slug ile ürün detayı getir
 */
export async function getProduct(slug: string): Promise<ApiResponse<ProductWithCategory>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error) throw error;

    return {
      data: data as ProductWithCategory,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getProduct error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürün bulunamadı',
      success: false,
    };
  }
}

/**
 * Filtreleme ve sıralama parametreleri
 */
export interface ProductFilters {
  minPrice?: number;
  maxPrice?: number;
  sortOrder?: 'recommended' | 'price_asc' | 'price_desc' | 'newest' | 'name_asc' | 'name_desc';
  inStockOnly?: boolean;
}

/**
 * Kategoriye göre ürünleri getir (filtreleme ve sıralama destekli)
 */
export async function getProductsByCategory(
  categorySlug: string,
  filters?: ProductFilters
): Promise<ApiResponse<ProductWithCategory[]>> {
  try {
    const supabase = await createClient();

    // Önce kategori ID'sini bul
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single();

    if (catError) throw catError;

    // Base query
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('category_id', category.id)
      .eq('is_published', true);

    // Apply filters
    if (filters?.minPrice !== undefined && filters.minPrice > 0) {
      query = query.gte('base_price', filters.minPrice);
    }

    if (filters?.maxPrice !== undefined && filters.maxPrice > 0) {
      query = query.lte('base_price', filters.maxPrice);
    }

    if (filters?.inStockOnly) {
      query = query.eq('in_stock', true);
    }

    // Apply sorting
    switch (filters?.sortOrder) {
      case 'price_asc':
        query = query.order('base_price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('base_price', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name_desc':
        query = query.order('name', { ascending: false });
        break;
      case 'recommended':
      default:
        // Default: newest first, then by stock status
        query = query
          .order('in_stock', { ascending: false })
          .order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      data: data as ProductWithCategory[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getProductsByCategory error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürünler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Tüm ürünleri getir (filtreleme ve sıralama destekli)
 */
export async function getAllProductsFiltered(
  filters?: ProductFilters
): Promise<ApiResponse<ProductWithCategory[]>> {
  try {
    const supabase = await createClient();

    // Base query
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('is_published', true);

    // Apply filters
    if (filters?.minPrice !== undefined && filters.minPrice > 0) {
      query = query.gte('base_price', filters.minPrice);
    }

    if (filters?.maxPrice !== undefined && filters.maxPrice > 0) {
      query = query.lte('base_price', filters.maxPrice);
    }

    if (filters?.inStockOnly) {
      query = query.eq('in_stock', true);
    }

    // Apply sorting
    switch (filters?.sortOrder) {
      case 'price_asc':
        query = query.order('base_price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('base_price', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name_desc':
        query = query.order('name', { ascending: false });
        break;
      case 'recommended':
      default:
        query = query
          .order('in_stock', { ascending: false })
          .order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      data: data as ProductWithCategory[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getAllProductsFiltered error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürünler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Öne çıkan ürünleri getir (ilk 6)
 */
export async function getFeaturedProducts(): Promise<ApiResponse<ProductWithCategory[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('is_published', true)
      .eq('in_stock', true)
      .order('created_at', { ascending: false })
      .limit(7);

    if (error) throw error;

    return {
      data: data as ProductWithCategory[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getFeaturedProducts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürünler yüklenemedi',
      success: false,
    };
  }
}

// =====================================================
// KATEGORİ İŞLEMLERİ
// =====================================================

/**
 * Tüm aktif kategorileri getir
 */
export async function getCategories(): Promise<ApiResponse<Category[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return {
      data: data as Category[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCategories error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Kategoriler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Slug ile kategori getir
 */
export async function getCategory(slug: string): Promise<ApiResponse<Category>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) throw error;

    return {
      data: data as Category,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCategory error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Kategori bulunamadı',
      success: false,
    };
  }
}

// =====================================================
// SİPARİŞ İŞLEMLERİ
// =====================================================

/**
 * Backend tarafında fiyat hesaplama (GÜVENLİK)
 * Client'tan gelen fiyatlara güvenmiyoruz
 */
async function calculateOrderPrices(
  cartItems: CartItem[],
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{
  items: OrderItemInsert[];
  subtotal: number;
}> {
  const orderItems: OrderItemInsert[] = [];
  let subtotal = 0;

  for (const item of cartItems) {
    // Veritabanından güncel fiyatı al
    const { data: product } = await supabase
      .from('products')
      .select('base_price, name, slug, images')
      .eq('id', item.productId)
      .single();

    if (!product) {
      throw new Error(`Ürün bulunamadı: ${item.productId}`);
    }

    // Backend'de fiyatı tekrar hesapla
    const areaM2 = (item.width * item.height) / 10000;
    const pileCoefficient = PILE_COEFFICIENTS_UPPER[item.pileFactor];
    const unitPrice = Math.round(areaM2 * product.base_price * pileCoefficient * 100) / 100;
    const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100;

    orderItems.push({
      order_id: '', // Sonra doldurulacak
      product_id: item.productId,
      product_name: product.name,
      product_slug: product.slug,
      product_image: product.images?.[0] || null,
      width_cm: item.width,
      height_cm: item.height,
      pile_factor: item.pileFactor,
      pleat_ratio_id: item.pleatId ?? null,
      pleat_name_snapshot: null, // TODO: mt türü için engine entegrasyonunda doldurulacak
      calculation_type_snapshot: (item.calculationType ?? 'm2') as CalculationType,
      area_m2: areaM2,
      price_per_m2_snapshot: product.base_price,
      pile_coefficient: pileCoefficient,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    });

    subtotal += totalPrice;
  }

  return { items: orderItems, subtotal };
}

/**
 * Sipariş oluştur
 */
export async function createOrder(
  cartItems: CartItem[],
  formData: CheckoutFormData
): Promise<ApiResponse<Order>> {
  try {
    const supabase = await createClient();

    // Kullanıcı kontrolü
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Sipariş oluşturmak için giriş yapmalısınız');
    }

    // Backend'de fiyatları hesapla (GÜVENLİK)
    const { items: orderItems, subtotal } = await calculateOrderPrices(cartItems, supabase);

    // Kargo ücreti
    const shippingCost = subtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.COST;
    const totalAmount = subtotal + shippingCost;

    const { shippingAddress, sameAsBilling, billingAddress } = formData;
    const customerName = [shippingAddress.firstName, shippingAddress.lastName].filter(Boolean).join(' ');
    const shippingText = [
      shippingAddress.addressLine,
      shippingAddress.neighbourhood,
      shippingAddress.district,
      shippingAddress.city,
      shippingAddress.postalCode,
    ].filter(Boolean).join(', ');
    const billingText = sameAsBilling || !billingAddress
      ? shippingText
      : [
          billingAddress.addressLine,
          billingAddress.neighbourhood,
          billingAddress.district,
          billingAddress.city,
          billingAddress.postalCode,
        ].filter(Boolean).join(', ');

    // Sipariş oluştur
    const orderData: OrderInsert = {
      user_id: user.id,
      customer_email: formData.email,
      customer_name: customerName,
      customer_phone: shippingAddress.phone || null,
      shipping_address: shippingText,
      billing_address: billingText,
      subtotal,
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

    if (orderError) throw orderError;

    // Sipariş kalemlerini ekle
    const itemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) throw itemsError;

    // Admin panelini güncelle
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');

    return {
      data: order as Order,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('createOrder error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sipariş oluşturulamadı',
      success: false,
    };
  }
}

/**
 * Kullanıcının siparişlerini getir
 */
export async function getUserOrders(): Promise<ApiResponse<OrderWithItems[]>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      data: orders as OrderWithItems[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getUserOrders error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Siparişler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Sipariş detayı getir (kullanıcının kendi siparişi)
 */
export async function getOrderById(orderId: string): Promise<ApiResponse<OrderWithItems>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Giriş yapmalısınız');
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return {
      data: order as OrderWithItems,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getOrderById error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sipariş bulunamadı',
      success: false,
    };
  }
}

// =====================================================
// ADMIN İŞLEMLERİ
// =====================================================

/**
 * Admin: Tüm siparişleri getir
 */
export async function getAllOrders(
  page = 1,
  pageSize = 20,
  status?: OrderStatus
): Promise<ApiResponse<PaginatedResponse<OrderWithItems>>> {
  try {
    const supabase = await createClient();

    // Admin kontrolü
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Yetkisiz erişim');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'ADMIN') {
      throw new Error('Yetkisiz erişim');
    }

    // Toplam sayıyı al
    let countQuery = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true });

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Siparişleri al
    const offset = (page - 1) * pageSize;
    let query = supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    return {
      data: {
        data: orders as OrderWithItems[],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getAllOrders error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Siparişler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Admin: Sipariş durumunu güncelle
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  adminNote?: string
): Promise<ApiResponse<Order>> {
  try {
    const supabase = await createClient();

    // Admin kontrolü
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Yetkisiz erişim');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'ADMIN') {
      throw new Error('Yetkisiz erişim');
    }

    // Durum güncelleme verileri
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (adminNote) {
      updateData.admin_note = adminNote;
    }

    // Durum bazlı timestamp güncellemeleri
    if (status === 'PAID') {
      updateData.paid_at = new Date().toISOString();
    } else if (status === 'SHIPPED') {
      updateData.shipped_at = new Date().toISOString();
    } else if (status === 'DELIVERED') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    // Sayfaları yenile
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${orderId}`);

    return {
      data: order as Order,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Sipariş güncellenemedi',
      success: false,
    };
  }
}

// Dashboard stats için güvenli boş veri
const EMPTY_DASHBOARD_STATS = {
  totalOrders: 0,
  pendingOrders: 0,
  totalRevenue: 0,
  todayOrders: 0,
};

/**
 * Admin: Dashboard istatistikleri
 *
 * @param days - Kaç günlük veriyi göster (default: 30). pendingOrders tüm zamanlara aittir.
 *
 * Strateji:
 * 1. get_dashboard_stats RPC dene (production'da tek DB round-trip, sıfır JS aggregation)
 * 2. RPC yoksa (test DB) → Promise.all ile paralel sorgular (eski RAM sızıntısı düzeltildi)
 * 3. Her şey başarısız olursa → sıfırlanmış veri döndür, uygulama çökmesin
 */
export async function getDashboardStats(days = 30): Promise<
  ApiResponse<{
    totalOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    todayOrders: number;
  }>
> {
  try {
    const supabase = await createClient();

    // Admin kontrolü
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Yetkisiz erişim');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'ADMIN') {
      throw new Error('Yetkisiz erişim');
    }

    // Tarih filtresini hesapla
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    sinceDate.setHours(0, 0, 0, 0);

    // ── 1. RPC dene (production) ─────────────────────────────────────────
    // get_dashboard_stats: tek sorguda tüm aggregation'ı DB'de yapar,
    // büyük tablolarda JS'e veri taşımaz → RAM sızıntısı yok.
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any)
        .rpc('get_dashboard_stats', { p_days: days });

      if (!rpcError && rpcData) {
        return {
          data: {
            totalOrders:   rpcData.total_orders   ?? 0,
            pendingOrders: rpcData.pending_orders  ?? 0,
            totalRevenue:  rpcData.total_revenue   ?? 0,
            todayOrders:   rpcData.today_orders    ?? 0,
          },
          error: null,
          success: true,
        };
      }
    } catch {
      // RPC henüz test DB'de mevcut değil → fallback'e geç
    }

    // ── 2. Paralel fallback sorguları (RAM-safe, artık serial değil) ─────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { count: totalOrders },
      { count: pendingOrders },
      { count: todayOrders },
      { data: revenueData },
    ] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', sinceDate.toISOString()),
      // pendingOrders: tüm zamanlara ait bekleyenler — tarih filtresinden muaf
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      // Gelir: sadece total_amount çekiyoruz (satır başına ~8 byte, yönetilebilir)
      // Production'da RPC bu sorguyu tamamen ortadan kaldırır
      supabase.from('orders').select('total_amount')
        .in('status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
        .gte('created_at', sinceDate.toISOString()),
    ]);

    const totalRevenue =
      revenueData?.reduce((sum, o) => sum + (o.total_amount || 0), 0) ?? 0;

    return {
      data: {
        totalOrders:   totalOrders   || 0,
        pendingOrders: pendingOrders || 0,
        totalRevenue,
        todayOrders:   todayOrders   || 0,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    // ── 3. Son çare fallback — uygulama hiç çökmesin ─────────────────────
    console.error('getDashboardStats error:', error);
    return {
      data: EMPTY_DASHBOARD_STATS,
      error: null, // UI'ı kırmamak için null döndür
      success: true,
    };
  }
}

// =====================================================
// AUTH HELPER
// =====================================================

/**
 * Mevcut kullanıcı profilini getir
 */
export async function getCurrentProfile(): Promise<ApiResponse<Profile>> {
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

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    return {
      data: profile as Profile,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getCurrentProfile error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Profil yüklenemedi',
      success: false,
    };
  }
}

/**
 * Kullanıcının admin olup olmadığını kontrol et
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return profile?.role === 'ADMIN';
  } catch {
    return false;
  }
}
