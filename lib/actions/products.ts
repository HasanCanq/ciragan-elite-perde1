'use server';

// =====================================================
// ADMIN PRODUCT SERVER ACTIONS - CRUD & Image Upload
// =====================================================

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  Product,
  ProductWithCategory,
  ProductInsert,
  ProductUpdate,
  Category,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

// =====================================================
// HELPER: Admin Kontrolü
// =====================================================

async function verifyAdmin(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string }> {
  const supabase = await createClient();

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

  return { supabase, userId: user.id };
}

// =====================================================
// ÜRÜN LİSTELEME (Admin)
// =====================================================

/**
 * Admin: Tüm ürünleri getir (yayında olsun olmasın)
 */
export async function getAdminProducts(
  page = 1,
  pageSize = 20,
  search?: string
): Promise<ApiResponse<PaginatedResponse<ProductWithCategory>>> {
  try {
    const { supabase } = await verifyAdmin();

    // Toplam sayıyı al
    let countQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.ilike('name', `%${search}%`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Ürünleri al
    const offset = (page - 1) * pageSize;
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, error } = await query;
    if (error) throw error;

    return {
      data: {
        data: products as ProductWithCategory[],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getAdminProducts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürünler yüklenemedi',
      success: false,
    };
  }
}

/**
 * Admin: Tek ürün detayı getir
 */
export async function getAdminProduct(productId: string): Promise<ApiResponse<ProductWithCategory>> {
  try {
    const { supabase } = await verifyAdmin();

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('id', productId)
      .single();

    if (error) throw error;

    return {
      data: product as ProductWithCategory,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getAdminProduct error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürün bulunamadı',
      success: false,
    };
  }
}

/**
 * Admin: Tüm kategorileri getir
 */
export async function getAdminCategories(): Promise<ApiResponse<Category[]>> {
  try {
    const { supabase } = await verifyAdmin();

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return {
      data: categories as Category[],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getAdminCategories error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Kategoriler yüklenemedi',
      success: false,
    };
  }
}

// =====================================================
// ÜRÜN OLUŞTURMA
// =====================================================

/**
 * Admin: Yeni ürün oluştur
 */
export async function createProduct(
  productData: Omit<ProductInsert, 'slug'>
): Promise<ApiResponse<Product>> {
  try {
    const { supabase } = await verifyAdmin();

    // Slug oluştur
    const slug = generateSlug(productData.name);

    // Slug benzersizliğini kontrol et
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        ...productData,
        slug: finalSlug,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    revalidatePath('/');

    return {
      data: product as Product,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('createProduct error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürün oluşturulamadı',
      success: false,
    };
  }
}

/**
 * Admin: Ürün güncelle
 */
export async function updateProduct(
  productId: string,
  productData: ProductUpdate
): Promise<ApiResponse<Product>> {
  try {
    const { supabase } = await verifyAdmin();

    // Eğer isim değişmişse slug'ı da güncelle
    let updateData = { ...productData };
    if (productData.name) {
      const newSlug = generateSlug(productData.name);

      // Başka ürünlerde bu slug var mı kontrol et
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', productId)
        .single();

      updateData.slug = existing ? `${newSlug}-${Date.now()}` : newSlug;
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath('/');
    revalidatePath(`/urun/${product.slug}`);

    return {
      data: product as Product,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('updateProduct error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürün güncellenemedi',
      success: false,
    };
  }
}

/**
 * Admin: Ürün sil
 */
export async function deleteProduct(productId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await verifyAdmin();

    // Önce ürünün resimlerini al
    const { data: product } = await supabase
      .from('products')
      .select('images')
      .eq('id', productId)
      .single();

    // Storage'dan resimleri sil
    if (product?.images && product.images.length > 0) {
      const adminClient = await createAdminClient();
      const filePaths = product.images
        .map((url: string) => extractStoragePath(url))
        .filter(Boolean);

      if (filePaths.length > 0) {
        await adminClient.storage.from('products').remove(filePaths);
      }
    }

    // Ürünü sil
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) throw error;

    revalidatePath('/admin/products');
    revalidatePath('/');

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('deleteProduct error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürün silinemedi',
      success: false,
    };
  }
}

// =====================================================
// GÖRSEL YÜKLEMESİ
// =====================================================

/**
 * Admin: Ürün görseli yükle
 */
export async function uploadProductImage(
  formData: FormData
): Promise<ApiResponse<{ url: string }>> {
  try {
    await verifyAdmin();

    const file = formData.get('file') as File;
    if (!file) {
      throw new Error('Dosya seçilmedi');
    }

    // Dosya tipi kontrolü
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Geçersiz dosya tipi. Sadece JPEG, PNG, WebP ve GIF desteklenir.');
    }

    // Dosya boyutu kontrolü (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Dosya boyutu 5MB\'dan büyük olamaz.');
    }

    // Benzersiz dosya adı oluştur
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
    const filePath = `products/${fileName}`;

    // Admin client ile yükle (service role key)
    const adminClient = await createAdminClient();

    const { error: uploadError } = await adminClient.storage
      .from('products')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Public URL al
    const { data: { publicUrl } } = adminClient.storage
      .from('products')
      .getPublicUrl(filePath);

    return {
      data: { url: publicUrl },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('uploadProductImage error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Görsel yüklenemedi',
      success: false,
    };
  }
}

/**
 * Admin: Ürün görselini sil
 */
export async function deleteProductImage(imageUrl: string): Promise<ApiResponse<null>> {
  try {
    await verifyAdmin();

    const filePath = extractStoragePath(imageUrl);
    if (!filePath) {
      throw new Error('Geçersiz görsel URL\'i');
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient.storage
      .from('products')
      .remove([filePath]);

    if (error) throw error;

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('deleteProductImage error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Görsel silinemedi',
      success: false,
    };
  }
}

// =====================================================
// YARDIMCI FONKSİYONLAR
// =====================================================

/**
 * Türkçe karakterleri çevir ve slug oluştur
 */
function generateSlug(text: string): string {
  const turkishMap: Record<string, string> = {
    ç: 'c', Ç: 'C',
    ğ: 'g', Ğ: 'G',
    ı: 'i', I: 'I',
    İ: 'I', i: 'i',
    ö: 'o', Ö: 'O',
    ş: 's', Ş: 'S',
    ü: 'u', Ü: 'U',
  };

  return text
    .split('')
    .map((char) => turkishMap[char] || char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Storage URL'inden dosya yolunu çıkar
 */
function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/products\/(.+)$/);
    return match ? `products/${match[1]}` : null;
  } catch {
    return null;
  }
}

// =====================================================
// ÜRÜN YAYIN DURUMU
// =====================================================

/**
 * Admin: Ürün yayın durumunu değiştir
 */
export async function toggleProductPublish(
  productId: string,
  isPublished: boolean
): Promise<ApiResponse<Product>> {
  try {
    const { supabase } = await verifyAdmin();

    const { data: product, error } = await supabase
      .from('products')
      .update({ is_published: isPublished })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    revalidatePath('/');

    return {
      data: product as Product,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('toggleProductPublish error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Durum değiştirilemedi',
      success: false,
    };
  }
}

/**
 * Admin: Ürün stok durumunu değiştir
 */
export async function toggleProductStock(
  productId: string,
  inStock: boolean
): Promise<ApiResponse<Product>> {
  try {
    const { supabase } = await verifyAdmin();

    const { data: product, error } = await supabase
      .from('products')
      .update({ in_stock: inStock })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/admin/products');
    revalidatePath('/');

    return {
      data: product as Product,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('toggleProductStock error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Durum değiştirilemedi',
      success: false,
    };
  }
}
