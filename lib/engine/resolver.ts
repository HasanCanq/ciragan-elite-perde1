/**
 * KATMAN 3 — PRODUCT RESOLVER
 * ============================
 * Supabase'den ürün fiyatlandırma verisini çeker ve hesap motoruna
 * hazır hâle getirir.
 *
 * SECURITY:
 *   import 'server-only' — Next.js bu dosyayı client bundle'a dahil etmeye
 *   kalkarsa build-time error fırlatır. base_price asla tarayıcıya sızmaz.
 *
 * Sorumluluklar:
 *   1. Ürün satırı  — calculation_type, base_price, min_width_cm, min_area_m2
 *   2. Pile seçenekleri (mt türü) — product_pleats (is_active = true, asc display_order)
 *   3. Model limitleri — curtain_models.max_width_cm / max_height_cm (FK üzerinden)
 *   4. Stock & yayın durumu doğrulaması
 *
 * Kullanım akışı (server action):
 *   resolver → validateCalcInput → calc → client'a sadece fiyat döner
 *
 * Bağlantı:
 *   getPublicSupabase() — cookie yoktur; ürün verisi herkese açık (RLS: SELECT public)
 */

import 'server-only';
import { getPublicSupabase } from '@/lib/supabase/public';
import type { CalculationType } from './core';
import type { ModelLimits } from './validator';

// ─── Çıktı Tipleri ────────────────────────────────────────────────────────────

/**
 * Tek pile seçeneği — çözümlenen ürünün dropdown listesi için.
 * Multiplier DB'den gelmesi zorunludur; client bu değeri doğrudan bilemez.
 */
export interface ResolvedPleat {
  id: string;
  name: string;
  multiplier: number;
  displayOrder: number;
}

/**
 * Resolver'dan dönen zengin ürün nesnesi.
 * Bu tip SADECE sunucu tarafında yaşar — client'a aktarılmaz.
 *
 * Güvenli transfer için kullan: toPublicProduct() helper'ı
 */
export interface ResolvedProduct {
  // ── Kimlik & Durum (client'a gönderilebilir) ────────────────────────────
  id: string;
  name: string;
  slug: string;
  inStock: boolean;

  // ── Fiyat Motoru Girdileri (SERVER-ONLY — serialize edilmez) ────────────
  /** Hesaplama türü: 'mt' | 'm2' | 'adet' */
  calculationType: CalculationType;
  /**
   * Birim fiyat (TRY). mt → TL/m, m2 → TL/m², adet → TL/adet.
   * ⚠️  Bu alan ASLA client'a serialize edilmez.
   *     Fiyat hesabı tamamlanıp yalnızca sonuç (totalPrice) döner.
   */
  basePrice: number;
  /** m2 türü için minimum genişlik (cm). NULL = sınır yok. */
  minWidthCm: number | null;
  /** m2 türü için minimum alan (m²). NULL = sınır yok. */
  minAreaM2: number | null;

  // ── mt Türü — Pile Seçenekleri ────────────────────────────────────────
  /** Tüm aktif pile seçenekleri, display_order'a göre sıralı.
   *  Boş dizi = m2 veya adet türü (mt değil). */
  pleats: ResolvedPleat[];
  /**
   * Çözümlenen pleatId'ye karşılık gelen pile.
   * NULL = pleatId verilmedi VEYA mt olmayan tür.
   */
  selectedPleat: ResolvedPleat | null;

  // ── Model Özgü Boyut Limitleri ─────────────────────────────────────────
  /**
   * Ürünün bağlı olduğu perde modelinin boyut üst sınırları.
   * NULL = model_id atanmamış ürün.
   * validateCalcInput()'un opts.modelLimits parametresine direkt geçilir.
   */
  modelLimits: ModelLimits | null;
}

/**
 * Client'a gönderilebilecek en az kimlik bilgisi.
 * basePrice, minWidthCm, minAreaM2 çıkarılmıştır.
 */
export interface PublicProductInfo {
  id: string;
  name: string;
  slug: string;
  inStock: boolean;
  calculationType: CalculationType;
  /** Dropdown için pile listesi — çarpan dahil (hesaplama için gerekli) */
  pleats: Array<{ id: string; name: string; multiplier: number; displayOrder: number }>;
  modelLimits: ModelLimits | null;
}

// ─── Hata Tipleri ─────────────────────────────────────────────────────────────

export type ResolverErrorCode =
  | 'NOT_FOUND'        // Ürün yok veya yayında değil
  | 'OUT_OF_STOCK'     // Stok yok
  | 'PLEAT_NOT_FOUND'  // Belirtilen pleatId bu ürüne ait değil / pasif
  | 'DB_ERROR';        // Beklenmeyen veritabanı hatası

export interface ResolverError {
  code: ResolverErrorCode;
  message: string;
}

export type ResolverResult =
  | { ok: true;  product: ResolvedProduct }
  | { ok: false; error: ResolverError };

// ─── Ana Resolver Fonksiyonu ──────────────────────────────────────────────────

/**
 * Ürün ID'si ve (opsiyonel) pile ID'si alarak fiyat motoruna hazır nesne döner.
 *
 * İki DB sorgusu yapılır:
 *   1. products + curtain_models (JOIN) — temel ürün verisi
 *   2. product_pleats              — yalnızca mt türünde, aktif seçenekler
 *
 * @param productId  - Çözümlenecek ürünün UUID'i
 * @param pleatId    - Seçilen pile UUID'i (yalnızca mt türünde zorunlu)
 * @param allowOutOfStock - true = stok dolu olma zorunluluğunu atla (admin için)
 *
 * @example
 * const out = await resolveProduct('uuid-...', { pleatId: 'uuid-...' });
 * if (!out.ok) return { error: out.error.message };
 * // out.product.basePrice sunucuda kalır, client'a gönderilmez
 * const price = calc({ ...toCalcInput(out.product, { widthCm, heightCm, quantity }) });
 */
export async function resolveProduct(
  productId: string,
  opts?: { pleatId?: string | null; allowOutOfStock?: boolean },
): Promise<ResolverResult> {
  const supabase = getPublicSupabase();

  // ── 1. Ürün + Perde Modeli ──────────────────────────────────────────────
  const { data: row, error: productErr } = await supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      in_stock,
      is_published,
      calculation_type,
      base_price,
      min_width_cm,
      min_area_m2,
      model_id,
      curtain_model:curtain_models (
        name,
        max_width_cm,
        max_height_cm
      )
    `)
    .eq('id', productId)
    .eq('is_published', true)
    .maybeSingle();

  if (productErr) {
    console.error('[Resolver] DB hatası (products):', productId, productErr.message);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Veritabanı hatası oluştu.' },
    };
  }

  if (!row) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Ürün bulunamadı veya artık satışta değil.' },
    };
  }

  if (!opts?.allowOutOfStock && !row.in_stock) {
    return {
      ok: false,
      error: { code: 'OUT_OF_STOCK', message: 'Bu ürün şu an stokta bulunmamaktadır.' },
    };
  }

  const calculationType = (row.calculation_type ?? 'adet') as CalculationType;

  // ── Model limitleri (curtain_model FK) ──────────────────────────────────
  // Supabase many-to-one join'i bazen dizi, bazen nesne döner;
  // her iki durumu da normalize ediyoruz.
  type CmRow = { name: string; max_width_cm: number; max_height_cm: number };
  const cmRaw = row.curtain_model as CmRow | CmRow[] | null;
  const cm: CmRow | null = Array.isArray(cmRaw)
    ? (cmRaw[0] ?? null)
    : cmRaw;

  const modelLimits: ModelLimits | null = cm
    ? { modelName: cm.name, maxWidthCm: cm.max_width_cm, maxHeightCm: cm.max_height_cm }
    : null;

  // ── 2. Pile Seçenekleri (sadece mt türü) ────────────────────────────────
  let pleats: ResolvedPleat[] = [];
  let selectedPleat: ResolvedPleat | null = null;

  if (calculationType === 'mt') {
    const { data: pleatRows, error: pleatErr } = await supabase
      .from('product_pleats')
      .select('id, name, multiplier, display_order')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (pleatErr) {
      console.error('[Resolver] DB hatası (product_pleats):', productId, pleatErr.message);
      return {
        ok: false,
        error: { code: 'DB_ERROR', message: 'Pile seçenekleri yüklenirken hata oluştu.' },
      };
    }

    pleats = (pleatRows ?? []).map((p) => ({
      id:           p.id,
      name:         p.name,
      multiplier:   Number(p.multiplier),
      displayOrder: p.display_order,
    }));

    // Belirli bir pile isteniyorsa — DB listesiyle çapraz doğrulama
    if (opts?.pleatId) {
      const found = pleats.find((p) => p.id === opts.pleatId);
      if (!found) {
        return {
          ok: false,
          error: {
            code: 'PLEAT_NOT_FOUND',
            message: 'Seçilen pile seçeneği bu ürüne ait değil ya da artık aktif değil.',
          },
        };
      }
      selectedPleat = found;
    }
  }

  // ── Başarılı sonuç ───────────────────────────────────────────────────────
  return {
    ok: true,
    product: {
      id:              row.id,
      name:            row.name,
      slug:            row.slug,
      inStock:         row.in_stock,
      calculationType,
      basePrice:       Number(row.base_price),
      minWidthCm:      row.min_width_cm   != null ? Number(row.min_width_cm)   : null,
      minAreaM2:       row.min_area_m2    != null ? Number(row.min_area_m2)    : null,
      pleats,
      selectedPleat,
      modelLimits,
    },
  };
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/**
 * ResolvedProduct + kullanıcı ölçülerini CoreCalcInput'a dönüştürür.
 * Validator'dan hemen önce, server action içinde kullanılır.
 *
 * @example
 * const out = await resolveProduct(productId, { pleatId });
 * if (!out.ok) ...
 * const input = toCalcInput(out.product, { widthCm, heightCm, quantity });
 * const validated = validateCalcInput(input, { modelLimits: out.product.modelLimits });
 */
export function toCalcInput(
  product: ResolvedProduct,
  userDims: { widthCm: number; heightCm: number; quantity: number },
) {
  return {
    calculationType: product.calculationType,
    basePrice:       product.basePrice,
    widthCm:         userDims.widthCm,
    heightCm:        userDims.heightCm,
    quantity:        userDims.quantity,
    pleat:           product.selectedPleat
      ? {
          id:         product.selectedPleat.id,
          name:       product.selectedPleat.name,
          multiplier: product.selectedPleat.multiplier,
        }
      : undefined,
    minWidthCm: product.minWidthCm ?? undefined,
    minAreaM2:  product.minAreaM2  ?? undefined,
  };
}

/**
 * Client component'lara gönderilebilecek public ürün bilgisi.
 * base_price, min_width_cm, min_area_m2 çıkarılmıştır.
 *
 * Server action'da ResolvedProduct'ı client'a seri hâle getirmeden önce
 * bu fonksiyona geçir.
 *
 * @example
 * // Server action:
 * const out = await resolveProduct(productId);
 * if (!out.ok) ...
 * return { product: toPublicProduct(out.product) };  // basePrice sızdırmaz
 */
export function toPublicProduct(product: ResolvedProduct): PublicProductInfo {
  return {
    id:              product.id,
    name:            product.name,
    slug:            product.slug,
    inStock:         product.inStock,
    calculationType: product.calculationType,
    pleats:          product.pleats.map((p) => ({
      id:           p.id,
      name:         p.name,
      multiplier:   p.multiplier,   // UI'da dropdown etiket üretimi için gerekli
      displayOrder: p.displayOrder,
    })),
    modelLimits:     product.modelLimits,
  };
}
