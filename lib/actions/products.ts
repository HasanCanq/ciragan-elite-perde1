'use server';

// =====================================================
// ADMIN PRODUCT ACTIONS (TEK VE TEMİZ VERSİYON)
// =====================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
    Product,
    ProductWithCategory,
    Category,
    ApiResponse,
    PaginatedResponse,
} from '@/types';

// =====================================================
// 1. GÜVENLİK VE YARDIMCI FONKSİYONLAR
// =====================================================

// Admin yetkisi kontrolü
async function verifyAdmin() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Oturum açılmamış.');

    // Rol kontrolü (metadata veya profiles tablosundan)
    // Not: Eğer user_metadata içinde role tutuyorsan oradan da bakabilirsin
    // Şimdilik sadece user var mı diye bakıyoruz, gerekirse burayı güçlendiririz.
    return { supabase, user };
}

// Türkçe karakter uyumlu Slug oluşturucu
function generateSlug(text: string): string {
    const turkishMap: Record<string, string> = {
        ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', I: 'I',
        İ: 'i', i: 'i', ö: 'o', Ö: 'O', ş: 's', Ş: 'S',
        ü: 'u', Ü: 'U'
    };

    return text
        .split('')
        .map((char) => turkishMap[char] || char)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Storage URL'inden dosya yolunu çıkaran yardımcı
// URL formatı: .../storage/v1/object/public/products/<dosya-yolu>
function extractStoragePath(url: string): string | null {
    try {
        const match = url.match(/\/storage\/v1\/object\/public\/products\/(.+)$/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

// =====================================================
// 2. VERİ ÇEKME İŞLEMLERİ (GET)
// =====================================================

// Tüm ürünleri getir (Sayfalı)
export async function getProducts(
    page = 1,
    pageSize = 20,
    search?: string
): Promise<ApiResponse<PaginatedResponse<ProductWithCategory>>> {
    try {
        const { supabase } = await verifyAdmin();

        let countQuery = supabase.from('products').select('*', { count: 'exact', head: true });

        if (search) {
            countQuery = countQuery.ilike('name', `%${search}%`);
        }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        const offset = (page - 1) * pageSize;
        let query = supabase
            .from('products')
            .select(`*, category:categories(*)`)
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return {
            success: true,
            data: {
                data: data as ProductWithCategory[],
                total: count || 0,
                page,
                pageSize,
                totalPages: Math.ceil((count || 0) / pageSize),
            },
            error: null
        };
    } catch (error) {
        console.error('getProducts hatası:', error);
        return { success: false, data: null, error: 'Ürünler yüklenemedi' };
    }
}

// Tek ürün getir
export async function getProductById(id: string): Promise<ApiResponse<ProductWithCategory>> {
    try {
        const { supabase } = await verifyAdmin();

        const { data, error } = await supabase
            .from('products')
            .select(`*, category:categories(*)`)
            .eq('id', id)
            .single();

        if (error) throw error;

        return { success: true, data: data as ProductWithCategory, error: null };
    } catch (error) {
        return { success: false, data: null, error: 'Ürün bulunamadı' };
    }
}

// Kategorileri getir (Selectbox için)
export async function getCategories(): Promise<ApiResponse<Category[]>> {
    try {
        const { supabase } = await verifyAdmin();
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (error) throw error;
        return { success: true, data: data as Category[], error: null };
    } catch (error) {
        return { success: false, data: null, error: 'Kategoriler alınamadı' };
    }
}

// =====================================================
// 3. YAZMA İŞLEMLERİ (CREATE / UPDATE / DELETE)
// =====================================================

// Tek bir dosyayı Storage'a yükle, public URL döndür
async function uploadImage(
    supabase: Awaited<ReturnType<typeof createClient>>,
    file: File
): Promise<string> {
    const ext = file.name.split('.').pop();
    const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
    return publicUrl;
}

// YENİ ÜRÜN OLUŞTUR
export async function createProduct(formData: FormData): Promise<ApiResponse<Product>> {
    try {
        const { supabase } = await verifyAdmin();

        // 1. Form verilerini al
        const name = formData.get('name') as string;
        const price = parseFloat(formData.get('base_price') as string);
        const categoryId = formData.get('category_id') as string;
        const shortDescription = formData.get('short_description') as string;
        const description = formData.get('description') as string;
        const isPublished = formData.get('is_published') === 'true';
        const inStock = formData.get('in_stock') === 'true';

        // 2. Slug oluştur ve kontrol et
        let slug = generateSlug(name);
        const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).single();
        if (existing) slug = `${slug}-${Date.now()}`;

        // 3. Çoklu Resim Yükleme (3 slot)
        const images: string[] = [];
        for (let i = 0; i < 3; i++) {
            const file = formData.get(`image_${i}`) as File;
            if (file && file.size > 0) {
                const url = await uploadImage(supabase, file);
                images.push(url);
            }
        }

        // 4. Veritabanına Kayıt
        const { data: product, error } = await supabase
            .from('products')
            .insert({
                name,
                slug,
                base_price: price,
                category_id: categoryId || null,
                short_description: shortDescription || null,
                description,
                images,
                is_published: isPublished,
                in_stock: inStock
            })
            .select()
            .single();

        if (error) throw error;

        revalidatePath('/admin/products');
        return { success: true, data: product as Product, error: null };

    } catch (error) {
        console.error('createProduct hatası:', error);
        return { success: false, data: null, error: error instanceof Error ? error.message : 'Ürün oluşturulamadı' };
    }
}

// ÜRÜN GÜNCELLE
export async function updateProduct(id: string, formData: FormData): Promise<ApiResponse<Product>> {
    try {
        const { supabase } = await verifyAdmin();

        const name = formData.get('name') as string;
        const shortDescription = formData.get('short_description') as string;
        const price = parseFloat(formData.get('base_price') as string);
        const categoryId = formData.get('category_id') as string;
        const description = formData.get('description') as string;
        const isPublished = formData.get('is_published') === 'true';
        const inStock = formData.get('in_stock') === 'true';

        // Mevcut ürünü al
        const { data: currentProduct } = await supabase.from('products').select('images').eq('id', id).single();
        const oldImages = currentProduct?.images || [];

        // Korunan mevcut URL'leri al (JSON string olarak gönderilir)
        const existingImagesRaw = formData.get('existing_images') as string;
        const existingImages: string[] = existingImagesRaw ? JSON.parse(existingImagesRaw) : [];

        // Silinecek eski görselleri bul ve Storage'dan temizle
        const removedUrls = oldImages.filter((url: string) => !existingImages.includes(url));
        if (removedUrls.length > 0) {
            try {
                const paths = removedUrls.map((url: string) => extractStoragePath(url)).filter(Boolean) as string[];
                if (paths.length > 0) await supabase.storage.from('products').remove(paths);
            } catch (e) {
                console.error('Eski resim silme hatası (devam ediliyor):', e);
            }
        }

        // Yeni görselleri yükle ve mevcut sıraya yerleştir
        const images: string[] = [...existingImages];
        for (let i = 0; i < 3; i++) {
            const file = formData.get(`image_${i}`) as File;
            if (file && file.size > 0) {
                const url = await uploadImage(supabase, file);
                // Slot index'ine yerleştir
                const slotIndex = parseInt(formData.get(`image_${i}_slot`) as string || String(images.length));
                images.splice(slotIndex, 0, url);
            }
        }

        // Güncelleme
        const { data: updatedProduct, error } = await supabase
            .from('products')
            .update({
                name,
                base_price: price,
                category_id: categoryId || null,
                short_description: shortDescription || null,
                description,
                images,
                is_published: isPublished,
                in_stock: inStock,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        revalidatePath('/admin/products');
        return { success: true, data: updatedProduct as Product, error: null };

    } catch (error) {
        console.error('updateProduct hatası:', error);
        return { success: false, data: null, error: error instanceof Error ? error.message : 'Güncelleme başarısız' };
    }
}

// ÜRÜN SİL
export async function deleteProduct(id: string): Promise<ApiResponse<null>> {
    try {
        const { supabase } = await verifyAdmin();

        // Önce resimleri temizle (hata olursa ürün silmeyi engellemesin)
        const { data: product } = await supabase.from('products').select('images').eq('id', id).single();

        if (product?.images && product.images.length > 0) {
            try {
                const paths = product.images.map((url: string) => extractStoragePath(url)).filter(Boolean) as string[];
                if (paths.length > 0) await supabase.storage.from('products').remove(paths);
            } catch (storageError) {
                console.error('Resim silme hatası (devam ediliyor):', storageError);
            }
        }

        // Ürünü sil
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;

        revalidatePath('/admin/products');
        return { success: true, data: null, error: null };

    } catch (error) {
        console.error('deleteProduct hatası:', error);
        return { success: false, data: null, error: error instanceof Error ? error.message : 'Silme işlemi başarısız' };
    }
}

// DURUM DEĞİŞTİR (Hızlı toggle işlemleri için)
export async function toggleProductStatus(id: string, field: 'is_published' | 'in_stock', value: boolean) {
    try {
        const { supabase } = await verifyAdmin();
        const { error } = await supabase.from('products').update({ [field]: value }).eq('id', id);
        if (error) throw error;
        revalidatePath('/admin/products');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Durum güncellenemedi' };
    }
} 