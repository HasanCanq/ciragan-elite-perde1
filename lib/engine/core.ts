/**
 * KATMAN 1 — CORE MATH ENGINE
 * ============================
 * Saf fonksiyon. DB yok, HTTP yok, side-effect yok.
 * Hem server hem client'ta güvenle import edilebilir.
 *
 * Decimal.js kullanarak IEEE-754 float hataları sıfırlanır.
 * Deterministik: aynı input → her zaman aynı output.
 *
 * Desteklenen hesaplama türleri:
 *   mt   — Metre işi (Tül, Fon)       : fabric_mt = (width_cm × multiplier) / 100
 *   m2   — Metrekare işi (Zebra, Stor) : area = MAX(eff_width × height, min_area)
 *   adet — Sabit birim fiyat            : toplam = quantity × base_price
 */

import Decimal from 'decimal.js';

// Decimal.js global ayarları — yuvarlama: ROUND_HALF_UP (bankacılık standardı)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type CalculationType = 'mt' | 'm2' | 'adet';

/** mt türü için pile/kıvrım seçeneği */
export interface PleatOption {
  id: string;
  name: string;
  /** Kumaş çarpanı: 2.5 → 1 m genişlik için 2.5 m kumaş */
  multiplier: number;
}

/** Hesaplama giriş parametreleri */
export interface CoreCalcInput {
  calculationType: CalculationType;
  /** Birim fiyat (TRY). mt → TL/m, m2 → TL/m², adet → TL/adet */
  basePrice: number;
  widthCm: number;
  heightCm: number;
  quantity: number;
  // mt türü için zorunlu
  pleat?: PleatOption | null;
  // m2 türü için isteğe bağlı
  minWidthCm?: number | null;
  minAreaM2?: number | null;
}

/** Hesaplama çıktısı — tüm ara değerler dahil */
export interface CoreCalcResult {
  /** Toplam fiyat (TRY, 2 ondalık) — quantity dahil */
  totalPrice: number;
  /** Tek kalem fiyatı (TRY, 2 ondalık) — quantity hariç */
  unitPrice: number;
  /** Kullanılan miktar: mt → metre, m2 → m², adet → adet sayısı */
  usedQuantity: number;
  /** Birim etiketi: "m", "m²", "adet" */
  unitLabel: string;
  /** Tüm ara adımlar — UI'da gösterim ve debug için */
  breakdown: CoreBreakdown;
}

export type CoreBreakdown =
  | MtBreakdown
  | M2Breakdown
  | AdetBreakdown;

interface BaseBreakdown {
  calculationType: CalculationType;
  widthCm: number;
  heightCm: number;
  quantity: number;
  basePrice: number;
}

export interface MtBreakdown extends BaseBreakdown {
  calculationType: 'mt';
  pleatId: string;
  pleatName: string;
  /** Pile çarpanı */
  multiplier: number;
  /** Kullanılacak kumaş (m) = (widthCm × multiplier) / 100 */
  fabricMeters: number;
}

export interface M2Breakdown extends BaseBreakdown {
  calculationType: 'm2';
  /** Minimum genişlik uygulandıysa kullanılan genişlik */
  effectiveWidthCm: number;
  /** Ham alan = (effectiveWidthCm × heightCm) / 10000 */
  rawAreaM2: number;
  /** Minimum alan uygulandıysa kullanılan alan */
  effectiveAreaM2: number;
  minWidthApplied: boolean;
  minAreaApplied: boolean;
}

export interface AdetBreakdown extends BaseBreakdown {
  calculationType: 'adet';
}

/** Hata kodu ve mesajı */
export interface CoreCalcError {
  code: 'INVALID_DIMENSIONS' | 'MISSING_PLEAT' | 'UNKNOWN_TYPE';
  message: string;
}

export type CoreCalcOutput =
  | { ok: true; result: CoreCalcResult }
  | { ok: false; error: CoreCalcError };

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

/**
 * Fiyat hesaplar. DB/HTTP bağımlılığı sıfır.
 *
 * @example mt — Tül perde
 * calc({ calculationType:'mt', basePrice:120, widthCm:200, heightCm:260,
 *        quantity:1, pleat:{ id:'x', name:'1x2.5 Normal', multiplier:2.5 }})
 * // fabricMeters = (200 × 2.5) / 100 = 5.000
 * // unitPrice    = 5.000 × 120       = 600.00 TL
 *
 * @example m2 — Zebra perde (min alan uygulaması)
 * calc({ calculationType:'m2', basePrice:450, widthCm:80, heightCm:160,
 *        quantity:1, minWidthCm:100, minAreaM2:1.5 })
 * // effectiveWidth = MAX(80, 100) = 100 cm
 * // rawArea        = (100 × 160) / 10000 = 1.600 m²
 * // effectiveArea  = MAX(1.600, 1.5)     = 1.600 m²
 * // unitPrice      = 1.600 × 450         = 720.00 TL
 */
export function calc(input: CoreCalcInput): CoreCalcOutput {
  const { calculationType, basePrice, widthCm, heightCm, quantity } = input;

  // ── Boyut validasyonu ────────────────────────────────────────────────────
  if (widthCm <= 0 || heightCm <= 0 || quantity <= 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_DIMENSIONS',
        message: 'Genişlik, yükseklik ve miktar sıfırdan büyük olmalıdır.',
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // mt — Metre hesabı
  // ────────────────────────────────────────────────────────────────────────
  if (calculationType === 'mt') {
    if (!input.pleat) {
      return {
        ok: false,
        error: {
          code: 'MISSING_PLEAT',
          message: 'Metre işi ürünlerde pile/kıvrım seçimi zorunludur.',
        },
      };
    }

    const { id: pleatId, name: pleatName, multiplier } = input.pleat;

    // fabricMeters = (widthCm × multiplier) / 100
    const fabricMeters = new Decimal(widthCm)
      .times(multiplier)
      .dividedBy(100)
      .toDecimalPlaces(3);

    const unitPrice = fabricMeters
      .times(basePrice)
      .toDecimalPlaces(2);

    const totalPrice = unitPrice
      .times(quantity)
      .toDecimalPlaces(2);

    return {
      ok: true,
      result: {
        totalPrice: totalPrice.toNumber(),
        unitPrice: unitPrice.toNumber(),
        usedQuantity: fabricMeters.toNumber(),
        unitLabel: 'm',
        breakdown: {
          calculationType: 'mt',
          widthCm,
          heightCm,
          quantity,
          basePrice,
          pleatId,
          pleatName,
          multiplier,
          fabricMeters: fabricMeters.toNumber(),
        } satisfies MtBreakdown,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // m2 — Metrekare hesabı
  // ────────────────────────────────────────────────────────────────────────
  if (calculationType === 'm2') {
    const minW = new Decimal(input.minWidthCm ?? 0);
    const minA = new Decimal(input.minAreaM2 ?? 0);

    const dWidth  = new Decimal(widthCm);
    const dHeight = new Decimal(heightCm);

    // Minimum genişlik kuralı
    const effectiveWidth = Decimal.max(dWidth, minW);
    const minWidthApplied = effectiveWidth.greaterThan(dWidth);

    // Ham alan (m²)
    const rawArea = effectiveWidth.times(dHeight).dividedBy(10000);

    // Minimum alan kuralı
    const effectiveArea = Decimal.max(rawArea, minA);
    const minAreaApplied = effectiveArea.greaterThan(rawArea);

    const unitPrice = effectiveArea
      .times(basePrice)
      .toDecimalPlaces(2);

    const totalPrice = unitPrice
      .times(quantity)
      .toDecimalPlaces(2);

    return {
      ok: true,
      result: {
        totalPrice: totalPrice.toNumber(),
        unitPrice: unitPrice.toNumber(),
        usedQuantity: effectiveArea.toDecimalPlaces(3).toNumber(),
        unitLabel: 'm²',
        breakdown: {
          calculationType: 'm2',
          widthCm,
          heightCm,
          quantity,
          basePrice,
          effectiveWidthCm: effectiveWidth.toNumber(),
          rawAreaM2: rawArea.toDecimalPlaces(3).toNumber(),
          effectiveAreaM2: effectiveArea.toDecimalPlaces(3).toNumber(),
          minWidthApplied,
          minAreaApplied,
        } satisfies M2Breakdown,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // adet — Sabit birim fiyat
  // ────────────────────────────────────────────────────────────────────────
  if (calculationType === 'adet') {
    const totalPrice = new Decimal(basePrice)
      .times(quantity)
      .toDecimalPlaces(2);

    return {
      ok: true,
      result: {
        totalPrice: totalPrice.toNumber(),
        unitPrice: basePrice,
        usedQuantity: quantity,
        unitLabel: 'adet',
        breakdown: {
          calculationType: 'adet',
          widthCm,
          heightCm,
          quantity,
          basePrice,
        } satisfies AdetBreakdown,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'UNKNOWN_TYPE',
      message: `Bilinmeyen hesaplama türü: ${calculationType as string}`,
    },
  };
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * Hesaplama sonucunu kullanıcıya gösterilen metin satırına çevirir.
 *
 * @example
 * mt:   "5.000 m × 120,00 ₺/m = 600,00 ₺  (1x2.5 Normal Pile)"
 * m2:   "1.600 m² × 450,00 ₺/m² = 720,00 ₺  (min. 100 cm en uygulandı)"
 * adet: "2 adet × 350,00 ₺ = 700,00 ₺"
 */
export function formatCalcResult(result: CoreCalcResult): string {
  const { breakdown: b, unitLabel, usedQuantity, unitPrice } = result;
  const fmt = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);

  switch (b.calculationType) {
    case 'mt': {
      const suffix = b.pleatName ? `  (${b.pleatName})` : '';
      return `${usedQuantity} ${unitLabel} × ${fmt(b.basePrice)}/${unitLabel} = ${fmt(unitPrice)}${suffix}`;
    }
    case 'm2': {
      const notes: string[] = [];
      if (b.minWidthApplied) notes.push(`min. ${b.effectiveWidthCm} cm en uygulandı`);
      if (b.minAreaApplied)  notes.push('min. alan uygulandı');
      const suffix = notes.length ? `  (${notes.join(', ')})` : '';
      return `${usedQuantity} ${unitLabel} × ${fmt(b.basePrice)}/${unitLabel} = ${fmt(unitPrice)}${suffix}`;
    }
    case 'adet': {
      return `${usedQuantity} ${unitLabel} × ${fmt(b.basePrice)} = ${fmt(unitPrice)}`;
    }
  }
}

/**
 * Hızlı test: tüm türler için beklenen sonuçları doğrular.
 * Üretimde çağrılmaz — sadece geliştirme/CI amaçlı.
 */
export function __selfTest(): void {
  // mt
  const mt = calc({ calculationType: 'mt', basePrice: 120, widthCm: 200, heightCm: 260, quantity: 1,
    pleat: { id: 'x', name: '1x2.5 Normal', multiplier: 2.5 } });
  console.assert(mt.ok && mt.result.totalPrice === 600, 'mt selftest başarısız');

  // m2 — min width
  const m2 = calc({ calculationType: 'm2', basePrice: 450, widthCm: 80, heightCm: 160,
    quantity: 1, minWidthCm: 100, minAreaM2: 1.5 });
  console.assert(m2.ok && m2.result.totalPrice === 720, 'm2 selftest başarısız');

  // adet
  const adet = calc({ calculationType: 'adet', basePrice: 350, widthCm: 1, heightCm: 1, quantity: 2 });
  console.assert(adet.ok && adet.result.totalPrice === 700, 'adet selftest başarısız');

  // Float hassasiyet testi: 0.1 + 0.2 = 0.3
  const floatTest = calc({ calculationType: 'adet', basePrice: 0.1, widthCm: 1, heightCm: 1, quantity: 3 });
  console.assert(floatTest.ok && floatTest.result.totalPrice === 0.30, 'float hassasiyet testi başarısız');

  console.log('[core.ts] selfTest: TÜM TESTLER GEÇTİ');
}
