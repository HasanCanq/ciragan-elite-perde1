/**
 * KATMAN 2 — INPUT VALIDATOR
 * ===========================
 * Zod v4 tabanlı sıkı doğrulama katmanı.
 * calc() fonksiyonuna ulaşmadan önce tüm girişler bu filtreden geçer.
 *
 * Sorumluluklar:
 *   1. Tip & aralık kontrolü  — number, NaN, Infinity, negatif değer engeli
 *   2. Boyut sınırları        — SIZE_LIMITS (global) + model özgü max değerler
 *   3. İş kuralı kontrolü    — mt türünde pile zorunlu
 *   4. Sanitization           — string injection (HTML/JS/SQL) engelleme
 *
 * Kullanım:
 *   const out = validateCalcInput(rawFormData, { modelLimits });
 *   if (!out.ok) { out.errors[0].field; out.errors[0].message; }
 *   else         { calc(out.data); }
 */

import { z } from 'zod';
import { SIZE_LIMITS } from '@/types';
import type { CoreCalcInput } from './core';

// ─── Model Özgü Limitler ──────────────────────────────────────────────────────

/**
 * Perde modeline özgü boyut üst sınırları.
 * CurtainModel tablosundan gelir (max_width_cm, max_height_cm).
 */
export interface ModelLimits {
  /** Modelin görünen adı — hata mesajında kullanılır: "Stor max 400 cm" */
  modelName: string;
  maxWidthCm: number;
  maxHeightCm: number;
}

// ─── Doğrulama Hata Tipleri ───────────────────────────────────────────────────

export interface ValidationError {
  /** Dot-notation alan yolu: "widthCm", "pleat.multiplier" */
  field: string;
  /** Makine tarafından okunabilir kural kodu */
  rule: string;
  /** Kullanıcıya gösterilecek Türkçe hata mesajı */
  message: string;
}

export type ValidationResult =
  | { ok: true;  data: CoreCalcInput }
  | { ok: false; errors: ValidationError[] };

// ─── Sanitization Şema Parçaları ─────────────────────────────────────────────

/**
 * HTML/JS/SQL injection vektörlerini bloklar.
 * İzin verilen: harf (TR dahil), rakam, boşluk, noktalama işaretleri ( . - × ( ) )
 * Engellenen: < > " ' ` { } \ ; @ $ # %
 */
const SAFE_STRING_RE = /^[^<>"'`{}\\;@$#%]*$/;

const safeString = (maxLen: number) =>
  z.string()
    .trim()
    .min(1,      'Boş olamaz.')
    .max(maxLen, `Maksimum ${maxLen} karakter olabilir.`)
    .regex(SAFE_STRING_RE, 'Geçersiz karakter içeriyor.');

/**
 * UUID v4 formatı doğrulaması — pleat.id için.
 * Kötü niyetli ID injection'ı engeller.
 */
const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Geçersiz ID formatı.'
  );

// ─── Alan Şemaları ────────────────────────────────────────────────────────────

/** Kullanılabilir birim fiyat: 0'dan büyük, sonlu, makul üst sınır (1M TRY) */
const basePriceSchema = z
  .number({ error: 'Birim fiyat sayı olmalıdır.' })
  .finite('Sonsuz değer kabul edilmez.')
  .positive('Birim fiyat sıfırdan büyük olmalıdır.')
  .max(1_000_000, 'Birim fiyat 1.000.000 ₺ üzerinde olamaz.');

/** mt ve m2 için genişlik: SIZE_LIMITS aralığı */
const widthSchema = z
  .number({ error: 'Genişlik sayı olmalıdır.' })
  .finite('Sonsuz değer kabul edilmez.')
  .int('Genişlik tam sayı (cm) olmalıdır.')
  .min(SIZE_LIMITS.MIN_WIDTH,  `Minimum genişlik ${SIZE_LIMITS.MIN_WIDTH} cm'dir.`)
  .max(SIZE_LIMITS.MAX_WIDTH,  `Maksimum genişlik ${SIZE_LIMITS.MAX_WIDTH} cm'dir.`);

/** mt ve m2 için yükseklik: SIZE_LIMITS aralığı */
const heightSchema = z
  .number({ error: 'Yükseklik sayı olmalıdır.' })
  .finite('Sonsuz değer kabul edilmez.')
  .int('Yükseklik tam sayı (cm) olmalıdır.')
  .min(SIZE_LIMITS.MIN_HEIGHT, `Minimum yükseklik ${SIZE_LIMITS.MIN_HEIGHT} cm'dir.`)
  .max(SIZE_LIMITS.MAX_HEIGHT, `Maksimum yükseklik ${SIZE_LIMITS.MAX_HEIGHT} cm'dir.`);

/** adet türünde boyutlar zorunlu değil — sipariş kaydı için 1 varsayılan */
const adetDimSchema = z
  .number({ error: 'Sayı olmalıdır.' })
  .finite()
  .positive()
  .optional()
  .default(1);

/** Sipariş adedi: 1–99 arası tam sayı */
const quantitySchema = z
  .number({ error: 'Miktar sayı olmalıdır.' })
  .finite()
  .int('Miktar tam sayı olmalıdır.')
  .min(1,  'En az 1 adet sipariş verilebilir.')
  .max(99, 'Tek siparişte en fazla 99 adet girilebilir.');

/** Pile/kıvrım seçeneği — yalnızca mt türünde kullanılır */
const pleatSchema = z.object({
  id:         uuidSchema,
  name:       safeString(100),
  multiplier: z
    .number({ error: 'Pile çarpanı sayı olmalıdır.' })
    .finite()
    .min(1.0, 'Pile çarpanı en az 1.0 olmalıdır.')
    .max(5.0, 'Pile çarpanı en fazla 5.0 olabilir.'),
});

// ─── Hesaplama Türü Şemaları (Discriminated Union) ────────────────────────────

/**
 * mt — Metre işi (Tül, Fon, Jakarlı)
 * Pile seçimi zorunlu; genişlik × çarpan / 100 = kumaş metresi
 */
const mtSchema = z.object({
  calculationType: z.literal('mt'),
  basePrice:       basePriceSchema,
  widthCm:         widthSchema,
  heightCm:        heightSchema,
  quantity:        quantitySchema,
  pleat:           pleatSchema,
  // m2 alanları bu türde kabul edilmez
  minWidthCm:      z.undefined().optional(),
  minAreaM2:       z.undefined().optional(),
});

/**
 * m2 — Metrekare işi (Zebra, Stor, Jaluzi, Plise)
 * min_width_cm ve min_area_m2 isteğe bağlı iş kuralları
 */
const m2Schema = z.object({
  calculationType: z.literal('m2'),
  basePrice:       basePriceSchema,
  widthCm:         widthSchema,
  heightCm:        heightSchema,
  quantity:        quantitySchema,
  pleat:           z.undefined().optional(),
  minWidthCm: z
    .number()
    .finite()
    .positive('Minimum genişlik pozitif olmalıdır.')
    .max(SIZE_LIMITS.MAX_WIDTH)
    .nullable()
    .optional(),
  minAreaM2: z
    .number()
    .finite()
    .positive('Minimum alan pozitif olmalıdır.')
    .max(100, 'Minimum alan 100 m² üzerinde olamaz.')
    .nullable()
    .optional(),
});

/**
 * adet — Sabit birim fiyat (Aksesuar, Korniş, Halka)
 * Boyutlar fiyatı etkilemez; kayıt tutmak için alınır.
 */
const adetSchema = z.object({
  calculationType: z.literal('adet'),
  basePrice:       basePriceSchema,
  widthCm:         adetDimSchema,
  heightCm:        adetDimSchema,
  quantity:        quantitySchema,
  pleat:           z.undefined().optional(),
  minWidthCm:      z.undefined().optional(),
  minAreaM2:       z.undefined().optional(),
});

/** Tüm türleri kapsayan birleşik şema */
const calcInputSchema = z.discriminatedUnion('calculationType', [
  mtSchema,
  m2Schema,
  adetSchema,
]);

// ─── Hata Dönüşümü ───────────────────────────────────────────────────────────

function toValidationErrors(
  zodIssues: z.ZodIssue[],
): ValidationError[] {
  return zodIssues.map((issue) => ({
    field:   issue.path.join('.') || 'input',
    rule:    issue.code,
    message: issue.message,
  }));
}

// ─── Ana Doğrulama Fonksiyonu ─────────────────────────────────────────────────

/**
 * Ham formu / API girdisini doğrular ve temizler.
 *
 * @param raw     - Doğrulanmamış girdi (form, JSON, URL param …)
 * @param opts    - İsteğe bağlı model özgü boyut limitleri
 *
 * @example
 * const out = validateCalcInput(formData, {
 *   modelLimits: { modelName: 'Stor', maxWidthCm: 400, maxHeightCm: 300 }
 * });
 * if (!out.ok) return { errors: out.errors };
 * const price = calc(out.data);
 */
export function validateCalcInput(
  raw: unknown,
  opts?: { modelLimits?: ModelLimits },
): ValidationResult {

  // ── Katman 1: Zod şema doğrulaması ────────────────────────────────────────
  const parsed = calcInputSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, errors: toValidationErrors(parsed.error.issues) };
  }

  const data = parsed.data;
  const extraErrors: ValidationError[] = [];

  // ── Katman 2: Model özgü boyut limitleri ───────────────────────────────────
  const limits = opts?.modelLimits;
  if (limits) {
    // mt ve m2 türlerinde boyutlar önemlidir; adet'te boyutlar fiyatı etkilemez
    if (data.calculationType !== 'adet') {
      if (data.widthCm > limits.maxWidthCm) {
        extraErrors.push({
          field:   'widthCm',
          rule:    'model_max_width',
          message: `${limits.modelName} modeli en fazla ${limits.maxWidthCm} cm genişlikte üretilebilir.`,
        });
      }
      if (data.heightCm > limits.maxHeightCm) {
        extraErrors.push({
          field:   'heightCm',
          rule:    'model_max_height',
          message: `${limits.modelName} modeli en fazla ${limits.maxHeightCm} cm yükseklikte üretilebilir.`,
        });
      }
    }
  }

  // ── Katman 3: İş kuralları ────────────────────────────────────────────────
  // mt türünde pile'ın şema tarafından zorunlu tutulduğunu doğrula
  // (discriminated union bunu garanti eder; bu katman defense-in-depth)
  if (data.calculationType === 'mt' && !data.pleat) {
    extraErrors.push({
      field:   'pleat',
      rule:    'required_for_mt',
      message: 'Metre işi ürünlerde pile/kıvrım seçimi zorunludur.',
    });
  }

  // m2 türünde minWidthCm < widthCm global minimumunu geçemez
  if (
    data.calculationType === 'm2' &&
    data.minWidthCm != null &&
    data.minWidthCm > SIZE_LIMITS.MAX_WIDTH
  ) {
    extraErrors.push({
      field:   'minWidthCm',
      rule:    'exceeds_global_max',
      message: `Minimum genişlik ${SIZE_LIMITS.MAX_WIDTH} cm'yi geçemez.`,
    });
  }

  if (extraErrors.length > 0) {
    return { ok: false, errors: extraErrors };
  }

  // ── Başarılı: temizlenmiş veriyi döndür ───────────────────────────────────
  return {
    ok: true,
    data: data as CoreCalcInput,
  };
}

// ─── Form Kolaylığı: Koercive Şema (string → number) ─────────────────────────

/**
 * HTML form veya URL arama parametrelerinden gelen string değerleri
 * sayıya dönüştüren coercive sarmalayıcı.
 *
 * Kullanım: FormData veya URLSearchParams ile çalışan form handler'larında.
 *
 * @example
 * const raw = coerceFormInput({
 *   calculationType: 'mt',
 *   basePrice: '450',   // string — form input
 *   widthCm: '150',
 *   heightCm: '240',
 *   quantity: '1',
 *   pleat: { id: 'uuid', name: '1x2.5 Normal', multiplier: '2.5' }
 * });
 * // raw artık sayısal alanları number'a dönüştürmüş hâlde döner
 */
export function coerceFormInput(form: Record<string, unknown>): Record<string, unknown> {
  const NUM_FIELDS = [
    'basePrice', 'widthCm', 'heightCm', 'quantity',
    'minWidthCm', 'minAreaM2',
  ];

  const result: Record<string, unknown> = { ...form };

  for (const key of NUM_FIELDS) {
    if (key in result && result[key] !== undefined && result[key] !== null && result[key] !== '') {
      const n = Number(result[key]);
      if (!Number.isNaN(n)) result[key] = n;
    }
  }

  // Pile çarpanı da coerce edilir
  if (
    result.pleat != null &&
    typeof result.pleat === 'object' &&
    'multiplier' in (result.pleat as object)
  ) {
    const p = { ...(result.pleat as Record<string, unknown>) };
    const m = Number(p.multiplier);
    if (!Number.isNaN(m)) p.multiplier = m;
    result.pleat = p;
  }

  return result;
}

// ─── Tipler: Doğrulanmış Input ────────────────────────────────────────────────

/** Zod şemasından çıkarılan doğrulanmış tip */
export type ValidatedCalcInput = z.infer<typeof calcInputSchema>;
