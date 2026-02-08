'use server';

// =====================================================
// ADMIN PRODUCT SERVER ACTIONS - CRUD & Image Upload
// =====================================================

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  Product,
  ProductWithCategory,
  Category,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

// =====================================================
// HELPER: Admin Kontrolü
// =====================================================

async function verifyAdmin(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
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
// SLUG OLUŞTURMA
// =====================================================

function generateSlug(text: string): string {
  const turkishMap: Record<string, string> = {
    ç: 'c',
    Ç: 'C',
    ğ: 'g',
    Ğ: 'G',
    ı: 'i',
    I: 'I',
    İ: 'I',
    i: 'i',
    ö: 'o',
    Ö: 'O',
    ş: 's',
    Ş: 'S',
    ü: 'u',
    Ü: 'U',
  };

  return text
    .split('')
    .map((char) => turkishMap[char] || char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// =====================================================
// STORAGE HELPERS
// =====================================================

function extractStoragePath(url: string): string | null {
  try {
    // URL formatı: .../storage/v1/object/public/products/products/filename.ext
    const match = url.match(/\/products\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// =====================================================
// GET PRODUCTS (Paginated)
// =====================================================

export async function getProducts(
  page = 1,
  pageSize = 20,
  search?: string
): Promise<ApiResponse<PaginatedResponse<ProductWithCategory>>> {
  try {
    const { supabase } = await verifyAdmin();

    // Count query
    let countQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.ilike('name', `%${search}%`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Data query
    const offset = (page - 1) * pageSize;
    let query = supabase
      .from('products')
      .select(
        `
        *,
        category:categories(*)
      `
      )
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
    console.error('getProducts error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürünler yüklenemedi',
      success: false,
    };
  }
}

// =====================================================
// GET PRODUCT BY ID
// =====================================================

export async function getProductById(
  productId: string
): Promise<ApiResponse<ProductWithCategory>> {
  try {
    const { supabase } = await verifyAdmin();

    const { data: product, error } = await supabase
      .from('products')
      .select(
        `
        *,
        category:categories(*)
      `
      )
      .eq('id', productId)
      .single();

    if (error) throw error;

    return {
      data: product as ProductWithCategory,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('getProductById error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Ürün bulunamadı',
      success: false,
    };
  }
}

// =====================================================
// GET CATEGORIES
// =====================================================

export async function getCategories(): Promise<ApiResponse<Category[]>> {
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
    console.error('getCategories error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Kategoriler yüklenemedi',
      success: false,
    };
  }
}

// =====================================================
// CREATE PRODUCT (with Image Upload)
// =====================================================

export async function createProduct(
  formData: FormData
): Promise<ApiResponse<Product>> {
  try {
    const { supabase } = await verifyAdmin();

    // Extract form fields
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const shortDescription = formData.get('short_description') as string | null;
    const basePrice = parseFloat(formData.get('base_price') as string);
    const categoryId = formData.get('category_id') as string | null;
    const isPublished = formData.get('is_published') === 'true';
    const inStock = formData.get('in_stock') === 'true';
    const imageFile = formData.get('image') as File | null;

    // Validation
    if (!name?.trim()) {
      throw new Error('Ürün adı gereklidir');
    }

    if (isNaN(basePrice) || basePrice <= 0) {
      throw new Error('Geçerli bir fiyat giriniz');
    }

    // Generate unique slug
    let slug = generateSlug(name);
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    // Handle image upload
    let imageUrl: string | null = null;
    if (imageFile && imageFile.size > 0) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error('Geçersiz dosya tipi. JPEG, PNG, WebP veya GIF yükleyiniz.');
      }

      // Validate file size (5MB)
      if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error('Dosya boyutu 5MB\'dan büyük olamaz.');
      }

      // Upload to Supabase Storage
      const ext = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const filePath = `products/${fileName}`;

      const adminClient = await createAdminClient();
      const { error: uploadError } = await adminClient.storage
        .from('products')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = adminClient.storage.from('products').getPublicUrl(filePath);

      imageUrl = publicUrl;
    }

    // Insert product
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        short_description: shortDescription?.trim() || null,
        base_price: basePrice,
        category_id: categoryId || null,
        images: imageUrl ? [imageUrl] : [],
        is_published: isPublished,
        in_stock: inStock,
      })
      .select()
      .single();

    if (error) throw error;

    // Revalidate paths
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

// =====================================================
// UPDATE PRODUCT (with Image Replacement)
// =====================================================

export async function updateProduct(
  productId: string,
  formData: FormData
): Promise<ApiResponse<Product>> {
  try {
    const { supabase } = await verifyAdmin();

    // Get current product
    const { data: currentProduct } = await supabase
      .from('products')
      .select('images, slug')
      .eq('id', productId)
      .single();

    // Extract form fields
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const shortDescription = formData.get('short_description') as string | null;
    const basePrice = parseFloat(formData.get('base_price') as string);
    const categoryId = formData.get('category_id') as string | null;
    const isPublished = formData.get('is_published') === 'true';
    const inStock = formData.get('in_stock') === 'true';
    const imageFile = formData.get('image') as File | null;
    const removeImage = formData.get('remove_image') === 'true';

    // Validation
    if (!name?.trim()) {
      throw new Error('Ürün adı gereklidir');
    }

    if (isNaN(basePrice) || basePrice <= 0) {
      throw new Error('Geçerli bir fiyat giriniz');
    }

    // Generate new slug if name changed
    let slug = generateSlug(name);
    const { data: existingWithSlug } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .neq('id', productId)
      .single();

    if (existingWithSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Handle image
    let images = currentProduct?.images || [];
    const adminClient = await createAdminClient();

    // Remove old image if requested or if new image is being uploaded
    if (removeImage || (imageFile && imageFile.size > 0)) {
      if (images.length > 0) {
        const oldPath = extractStoragePath(images[0]);
        if (oldPath) {
          await adminClient.storage.from('products').remove([oldPath]);
        }
      }
      images = [];
    }

    // Upload new image if provided
    if (imageFile && imageFile.size > 0) {
      // Validate
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error('Geçersiz dosya tipi. JPEG, PNG, WebP veya GIF yükleyiniz.');
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        throw new Error('Dosya boyutu 5MB\'dan büyük olamaz.');
      }

      // Upload
      const ext = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await adminClient.storage
        .from('products')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = adminClient.storage.from('products').getPublicUrl(filePath);

      images = [publicUrl];
    }

    // Update product
    const { data: product, error } = await supabase
      .from('products')
      .update({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        short_description: shortDescription?.trim() || null,
        base_price: basePrice,
        category_id: categoryId || null,
        images,
        is_published: isPublished,
        in_stock: inStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;

    // Revalidate paths
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath('/');
    revalidatePath(`/urun/${product.slug}`);
    if (currentProduct?.slug && currentProduct.slug !== product.slug) {
      revalidatePath(`/urun/${currentProduct.slug}`);
    }

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

// =====================================================
// DELETE PRODUCT (with Storage Cleanup)
// =====================================================

export async function deleteProduct(productId: string): Promise<ApiResponse<null>> {
  try {
    const { supabase } = await verifyAdmin();

    // Get product to delete its images from storage
    const { data: product } = await supabase
      .from('products')
      .select('images, slug')
      .eq('id', productId)
      .single();

    // Delete images from storage
    if (product?.images && product.images.length > 0) {
      const adminClient = await createAdminClient();
      const filePaths = product.images
        .map((url: string) => extractStoragePath(url))
        .filter(Boolean) as string[];

      if (filePaths.length > 0) {
        await adminClient.storage.from('products').remove(filePaths);
      }
    }

    // Delete product from database
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) throw error;

    // Revalidate paths
    revalidatePath('/admin/products');
    revalidatePath('/');
    if (product?.slug) {
      revalidatePath(`/urun/${product.slug}`);
    }

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
// TOGGLE PUBLISH STATUS
// =====================================================

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

// =====================================================
// TOGGLE STOCK STATUS
// =====================================================

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
