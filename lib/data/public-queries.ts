/**
 * PUBLIC DATA QUERIES
 * ─────────────────────────────────────────────────────────────
 * Herkese açık veri okuma fonksiyonları.
 *
 * İki katmanlı optimizasyon:
 *   1) getPublicSupabase() → cookies() yok → ISR cache çalışır
 *   2) React cache()      → aynı render içinde tekrar çağrılsa
 *                           Supabase'e tek sorgu gider
 *                           (Request Memoization)
 *
 * Bu fonksiyonlar 'use server' değildir — sadece veri okur,
 * mutasyon yapmaz. Server Component'lardan doğrudan çağrılır.
 */

import { cache } from 'react';
import { getPublicSupabase } from '@/lib/supabase/public';
import type { ProductWithCategory, Category, CurtainModel, MeasurementGuide } from '@/types';

// ─── COMPOSITE TİPLER ──────────────────────────────────────

/** Ürün pile seçeneği (product_pleats tablosundan). PDP MeasurementForm için. */
export interface PleatOption {
  id:            string;
  name:          string;
  multiplier:    number;
  display_order: number;
  is_active:     boolean;
}

/**
 * Ürün + perde modeli + pile seçenekleri.
 * PDP'de MeasurementForm'a geçilir.
 * Supabase FK join: model → curtain_models (to-one), pleats → product_pleats (to-many)
 */
export type ProductWithModel = ProductWithCategory & {
  /** NULL = ürüne model atanmamış (eski ürünler / aksesuar) */
  model: CurtainModel | null;
  /** mt türü ürünlerde pile seçenekleri; diğerlerinde boş dizi */
  pleats: PleatOption[];
};

// ─── KATEGORİLER ─────────────────────────────────────────────

/**
 * Tüm aktif kategorileri getirir.
 * Ana sayfa, kategori listesi, navigation için.
 */
export const getCategoriesPublic = cache(async (): Promise<Category[]> => {
  const supabase = getPublicSupabase();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[getCategoriesPublic]', error.message);
    return [];
  }

  return data ?? [];
});

/**
 * Slug ile kategori getirir.
 * Kategori sayfası ve generateStaticParams için.
 */
export const getCategoryPublic = cache(async (slug: string): Promise<Category | null> => {
  const supabase = getPublicSupabase();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) {
    // PGRST116 = kayıt bulunamadı (404) — console.error spam etme
    if (error.code !== 'PGRST116') {
      console.error('[getCategoryPublic]', slug, error.message);
    }
    return null;
  }

  return data;
});

/**
 * Build zamanında generateStaticParams için tüm kategori slug'larını getirir.
 */
export const getAllCategorySlugsPublic = cache(async (): Promise<string[]> => {
  const supabase = getPublicSupabase();

  const { data } = await supabase
    .from('categories')
    .select('slug')
    .eq('is_active', true);

  return data?.map((c) => c.slug) ?? [];
});

// ─── ÜRÜNLER ─────────────────────────────────────────────────

/**
 * Build zamanında generateStaticParams için tüm ürün slug'larını getirir.
 */
export const getAllProductSlugsPublic = cache(async (): Promise<string[]> => {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from('products')
    .select('slug')
    .eq('is_published', true);
  return data?.map((p) => p.slug) ?? [];
});

/**
 * Öne çıkan ürünleri getirir (ana sayfa için).
 */
export const getFeaturedProductsPublic = cache(async (): Promise<ProductWithCategory[]> => {
  const supabase = getPublicSupabase();

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('is_published', true)
    .eq('in_stock', true)
    .order('created_at', { ascending: false })
    .limit(7);

  if (error) {
    console.error('[getFeaturedProductsPublic]', error.message);
    return [];
  }

  return data ?? [];
});

/**
 * Slug ile ürün detayı getirir.
 * Ürün sayfası ve generateStaticParams için.
 */
export const getProductPublic = cache(async (slug: string): Promise<ProductWithCategory | null> => {
  const supabase = getPublicSupabase();

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[getProductPublic]', slug, error.message);
    }
    return null;
  }

  return data;
});

/**
 * Ürün + perde modeli birlikte getirir.
 * PDP (Ürün Detay Sayfası) için — dinamik Zod doğrulaması bu veriden beslenir.
 *
 * Supabase FK join: products → curtain_models (to-one).
 * `model` alanı NULL olabilir (eski ürünler / model atanmamış aksesuar).
 */
export const getProductWithModelPublic = cache(
  async (slug: string): Promise<ProductWithModel | null> => {
    const supabase = getPublicSupabase();

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(*),
        model:curtain_models(
          id, name, slug, max_width_cm, max_height_cm,
          description, image_url, is_active, display_order,
          created_at, updated_at
        ),
        pleats:product_pleats!product_pleats_product_id_fkey(
          id, name, multiplier, display_order, is_active
        )
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[getProductWithModelPublic]', slug, error.message);
      }
      return null;
    }

    // Supabase FK join to-one ilişkiyi teknik olarak dizi tipler;
    // gerçekte tek nesne döner. null model'i (RLS/opsiyonel FK) koru.
    // pleats: to-many → dizi; display_order ile sırala, sadece aktifler.
    const typed = data as unknown as ProductWithModel | null;
    if (typed?.pleats) {
      typed.pleats = typed.pleats
        .filter((p) => p.is_active)
        .sort((a, b) => a.display_order - b.display_order);
    }
    return typed;
  },
);

/**
 * Kategoriye göre ürün listesi (temel, filtresiz versiyon).
 * ISR sayfalarında ve generateStaticParams'da kullanılır.
 * Filtreleme gereken dinamik render'lar için lib/actions.ts'i kullan.
 */
export const getProductsByCategoryPublic = cache(async (
  categorySlug: string
): Promise<ProductWithCategory[]> => {
  const supabase = getPublicSupabase();

  const { data: category } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .single();

  if (!category) return [];

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('category_id', category.id)
    .eq('is_published', true)
    .order('in_stock',    { ascending: false })
    .order('created_at',  { ascending: false });

  if (error) {
    console.error('[getProductsByCategoryPublic]', categorySlug, error.message);
    return [];
  }

  return data ?? [];
});

/**
 * guide_key ile ölçü kılavuzu getirir.
 * PDP sayfasında MeasurementForm modalı için kullanılır.
 */
export const getMeasurementGuide = cache(
  async (guideKey: string): Promise<MeasurementGuide | null> => {
    const supabase = getPublicSupabase();

    const { data, error } = await supabase
      .from('measurement_guides')
      .select('*')
      .eq('guide_key', guideKey)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[getMeasurementGuide]', guideKey, error.message);
      }
      return null;
    }

    return data;
  },
);

/**
 * Tüm aktif ölçü kılavuzlarını getirir.
 * Admin yönetim sayfası için.
 */
export const getAllMeasurementGuidesPublic = cache(
  async (): Promise<MeasurementGuide[]> => {
    const supabase = getPublicSupabase();

    const { data, error } = await supabase
      .from('measurement_guides')
      .select('*')
      .order('guide_key');

    if (error) {
      console.error('[getAllMeasurementGuidesPublic]', error.message);
      return [];
    }

    return data ?? [];
  },
);

/**
 * store_settings'ten shop_enabled bayrağını getirir.
 * PDP ve kategori sayfalarında "Sepete Ekle" butonunu kontrol eder.
 * Ayar okunamazsa güvenli default: true (satış açık).
 */
export const getShopEnabled = cache(async (): Promise<boolean> => {
  const supabase = getPublicSupabase();

  const { data } = await supabase
    .from('store_settings')
    .select('shop_enabled')
    .single();

  return data?.shop_enabled ?? true;
});

/**
 * Tüm yayındaki ürünleri getirir (filtresiz).
 * tum-urunler sayfasının ISR versiyonu için.
 */
export const getAllProductsPublic = cache(async (): Promise<ProductWithCategory[]> => {
  const supabase = getPublicSupabase();

  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('is_published', true)
    .order('in_stock',   { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAllProductsPublic]', error.message);
    return [];
  }

  return data ?? [];
});
