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
import { auditLog, diffObjects } from '@/lib/services/audit-logger';

// =====================================================
// 1. GÜVENLİK VE YARDIMCI FONKSİYONLAR
// =====================================================

// Admin yetkisi kontrolü
async function verifyAdmin() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Oturum açılmamış.');

    // Profiles tablosundan rol kontrolü — sadece ADMIN rolü geçer
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        throw new Error('Kullanıcı profili bulunamadı.');
    }

    if (profile.role !== 'ADMIN') {
        throw new Error('Bu işlem için yetkiniz yok.');
    }

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

// Tüm ürünleri getir (Sayfalı) — soft-deleted olanlar hariç
export async function getProducts(
    page = 1,
    pageSize = 20,
    search?: string,
    includeDeleted = false  // Admin "çöp kutusu" görünümü için
): Promise<ApiResponse<PaginatedResponse<ProductWithCategory>>> {
    try {
        const { supabase } = await verifyAdmin();

        let countQuery = supabase.from('products').select('*', { count: 'exact', head: true });
        if (!includeDeleted) countQuery = countQuery.is('deleted_at', null);
        if (search) countQuery = countQuery.ilike('name', `%${search}%`);

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        const offset = (page - 1) * pageSize;
        let query = supabase
            .from('products')
            .select(`*, category:categories(*)`)
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);

        if (!includeDeleted) query = query.is('deleted_at', null);
        if (search) query = query.ilike('name', `%${search}%`);

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

// Perde modellerini getir (Selectbox için)
export async function getCurtainModels(): Promise<ApiResponse<{ id: string; name: string; slug: string }[]>> {
    try {
        const { supabase } = await verifyAdmin();
        const { data, error } = await supabase
            .from('curtain_models')
            .select('id, name, slug')
            .eq('is_active', true)
            .order('display_order');
        if (error) throw error;
        return { success: true, data: data ?? [], error: null };
    } catch (error) {
        return { success: false, data: null, error: 'Perde modelleri alınamadı' };
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
        const stockQuantity = parseFloat(formData.get('stock_quantity') as string || '0');
        const lowStockThreshold = parseFloat(formData.get('low_stock_threshold') as string || '5');
        const modelId = (formData.get('model_id') as string) || null;
        const calculationType = (formData.get('calculation_type') as string) || 'adet';
        const fabricPropertiesRaw = formData.get('fabric_properties') as string;
        const fabricProperties: string[] = fabricPropertiesRaw ? JSON.parse(fabricPropertiesRaw) : [];

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
                in_stock: inStock,
                stock_quantity: isNaN(stockQuantity) ? 0 : stockQuantity,
                low_stock_threshold: isNaN(lowStockThreshold) ? 5 : lowStockThreshold,
                calculation_type: calculationType,
                fabric_properties: fabricProperties,
                ...(modelId ? { model_id: modelId } : {}),
            })
            .select()
            .single();

        if (error) throw error;

        // mt türü ürünlerde Seyrek/Orta/Sık pile seçeneklerini otomatik oluştur
        if (calculationType === 'mt' && product) {
            const defaultPleats = [
                { name: 'Seyrek Pile', multiplier: 2.0, display_order: 1 },
                { name: 'Orta Pile',   multiplier: 2.5, display_order: 2 },
                { name: 'Sık Pile',    multiplier: 3.0, display_order: 3 },
            ];
            const { error: pleatError } = await supabase
                .from('product_pleats')
                .insert(defaultPleats.map((p) => ({ ...p, product_id: product.id, is_active: true })));
            if (pleatError) {
                console.error('createProduct: pile seçenekleri oluşturulamadı', pleatError.message);
            }
        }

        revalidatePath('/admin/products');
        // Yeni ürün → tüm listeleme sayfalarını geçersiz kıl
        revalidatePath('/');
        revalidatePath('/kategori/tum-urunler');
        revalidatePath('/kategori', 'layout'); // tüm /kategori/* alt sayfaları
        revalidatePath('/urunler');            // asistan PLP cache'i temizle
        revalidatePath('/asistan');            // asistan ana sayfası

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
        const stockQuantity = parseFloat(formData.get('stock_quantity') as string || '0');
        const lowStockThreshold = parseFloat(formData.get('low_stock_threshold') as string || '5');
        const modelId = (formData.get('model_id') as string) || null;
        const calculationType = (formData.get('calculation_type') as string) || 'adet';
        const fabricPropertiesRaw = formData.get('fabric_properties') as string;
        const fabricProperties: string[] = fabricPropertiesRaw ? JSON.parse(fabricPropertiesRaw) : [];

        // Mevcut ürünü al (images + slug + audit diff için)
        const { data: currentProduct } = await supabase
            .from('products')
            .select('images, slug, name, base_price, is_published, in_stock, category_id, calculation_type')
            .eq('id', id)
            .single();
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
                stock_quantity: isNaN(stockQuantity) ? 0 : stockQuantity,
                low_stock_threshold: isNaN(lowStockThreshold) ? 5 : lowStockThreshold,
                calculation_type: calculationType,
                fabric_properties: fabricProperties,
                ...(modelId ? { model_id: modelId } : {}),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // calculation_type mt'ye değiştiyse ve henüz pile yoksa otomatik oluştur
        const prevType = (currentProduct as any)?.calculation_type;
        if (calculationType === 'mt') {
            const { count } = await supabase
                .from('product_pleats')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', id);
            if ((count ?? 0) === 0) {
                const defaultPleats = [
                    { name: 'Seyrek Pile', multiplier: 2.0, display_order: 1 },
                    { name: 'Orta Pile',   multiplier: 2.5, display_order: 2 },
                    { name: 'Sık Pile',    multiplier: 3.0, display_order: 3 },
                ];
                const { error: pleatError } = await supabase
                    .from('product_pleats')
                    .insert(defaultPleats.map((p) => ({ ...p, product_id: id, is_active: true })));
                if (pleatError) {
                    console.error('updateProduct: pile seçenekleri oluşturulamadı', pleatError.message);
                }
            }
        }

        // Audit log — fiyat değişimi, yayım durumu vb. (fire-and-forget)
        if (currentProduct) {
            const newSnapshot = {
                name,
                base_price: price,
                is_published: isPublished,
                in_stock: inStock,
                category_id: categoryId || null,
                calculation_type: calculationType,
            };
            const oldSnapshot = {
                name: currentProduct.name,
                base_price: currentProduct.base_price,
                is_published: currentProduct.is_published,
                in_stock: currentProduct.in_stock,
                category_id: currentProduct.category_id,
                calculation_type: prevType,
            };
            const { oldDiff, newDiff } = diffObjects(
                oldSnapshot as Record<string, unknown>,
                newSnapshot as Record<string, unknown>
            );
            if (Object.keys(oldDiff).length > 0) {
                auditLog(supabase, {
                    action: 'UPDATE',
                    tableName: 'products',
                    recordId: id,
                    oldValues: oldDiff,
                    newValues: newDiff,
                });
            }
        }

        revalidatePath('/admin/products');
        if (currentProduct?.slug) revalidatePath(`/urun/${currentProduct.slug}`);
        revalidatePath('/');
        revalidatePath('/kategori/tum-urunler');
        revalidatePath('/kategori', 'layout');
        revalidatePath('/urunler');
        revalidatePath('/asistan');

        return { success: true, data: updatedProduct as Product, error: null };

    } catch (error) {
        console.error('updateProduct hatası:', error);
        return { success: false, data: null, error: error instanceof Error ? error.message : 'Güncelleme başarısız' };
    }
}

// ÜRÜN SOFT DELETE — fiziksel silme YOK
export async function deleteProduct(id: string): Promise<ApiResponse<null>> {
    try {
        const { supabase } = await verifyAdmin();

        // Mevcut ürünü al (audit log + slug için)
        const { data: product } = await supabase
            .from('products')
            .select('images, slug, name, base_price, is_published')
            .eq('id', id)
            .is('deleted_at', null)  // zaten silinmişse işlem yapma
            .single();

        if (!product) {
            return { success: false, data: null, error: 'Ürün bulunamadı veya zaten silinmiş' };
        }

        // Soft delete: deleted_at = NOW() ve is_published = false
        // Fiziksel DELETE YAPILMAZ — geçmiş sipariş bütünlüğü korunur
        const { error } = await supabase
            .from('products')
            .update({
                deleted_at: new Date().toISOString(),
                is_published: false, // Artık görünmez
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .is('deleted_at', null); // Race condition koruması

        if (error) throw error;

        // Audit log (fire-and-forget)
        auditLog(supabase, {
            action: 'SOFT_DELETE',
            tableName: 'products',
            recordId: id,
            oldValues: { deleted_at: null, is_published: product.is_published, name: product.name },
            newValues: { deleted_at: new Date().toISOString(), is_published: false },
        });

        // Storage temizliği — soft delete'den bağımsız; hata olursa devam et
        // NOT: Resimler şimdilik KORUNUYOR (restore senaryosu için)
        // Kalıcı temizlik için ayrı bir purge cron yazılabilir.

        revalidatePath('/admin/products');
        if (product?.slug) revalidatePath(`/urun/${product.slug}`);
        revalidatePath('/');
        revalidatePath('/kategori/tum-urunler');
        revalidatePath('/kategori', 'layout');

        return { success: true, data: null, error: null };

    } catch (error) {
        console.error('deleteProduct hatası:', error);
        return { success: false, data: null, error: error instanceof Error ? error.message : 'Silme işlemi başarısız' };
    }
}

// ÜRÜN GERİ YÜKLE (Soft Delete'den Çıkarma)
export async function restoreProduct(id: string): Promise<ApiResponse<null>> {
    try {
        const { supabase } = await verifyAdmin();

        const { error } = await supabase
            .from('products')
            .update({
                deleted_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .not('deleted_at', 'is', null); // Sadece silinmişleri restore et

        if (error) throw error;

        auditLog(supabase, {
            action: 'RESTORE',
            tableName: 'products',
            recordId: id,
            oldValues: { deleted_at: 'set' },
            newValues: { deleted_at: null },
        });

        revalidatePath('/admin/products');
        revalidatePath('/');

        return { success: true, data: null, error: null };

    } catch (error) {
        console.error('restoreProduct hatası:', error);
        return { success: false, data: null, error: error instanceof Error ? error.message : 'Geri yükleme başarısız' };
    }
}

// DURUM DEĞİŞTİR (Hızlı toggle işlemleri için)
export async function toggleProductStatus(id: string, field: 'is_published' | 'in_stock', value: boolean) {
    try {
        const { supabase } = await verifyAdmin();

        // Slug gerekli — revalidatePath için
        const { data: product } = await supabase
            .from('products')
            .select('slug')
            .eq('id', id)
            .single();

        const { error } = await supabase.from('products').update({ [field]: value }).eq('id', id);
        if (error) throw error;

        revalidatePath('/admin/products');
        if (product?.slug) {
            revalidatePath(`/urun/${product.slug}`);
        }
        revalidatePath('/');
        revalidatePath('/kategori/tum-urunler');
        revalidatePath('/kategori', 'layout');

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Durum güncellenemedi' };
    }
} 