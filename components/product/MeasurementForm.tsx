'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Info, Minus, Plus } from 'lucide-react';
import {
  SIZE_LIMITS,
  type PileFactor,
  type CalculationType,
} from '@/types';
import { useCartStore } from '@/store/cartStore';

/* ──────────────────────────────────────────────────────────────
   MeasurementForm — PDP Ölçü Girişi ve Sepete Ekle
   ──────────────────────────────────────────────────────────────

   KRITIK MİMARİ KARARLAR:

   1. DİNAMİK ZOD ŞEMASI (useMemo)
      max_width_cm ve max_height_cm veritabanından (curtain_models
      tablosu) çalışma zamanında gelir. Statik şema kullanmak
      mümkün değildir; şema modelLimits prop'una göre yeniden
      inşa edilmek zorundadır.

   2. superRefine → model sınırlarını çalışma zamanında uygular.
      ctx.addIssue({ code: 'custom', path: ['en'], message: '...' })
      ile alan bazlı hata mesajları üretilir.

      ÖRNEK DAVRANIŞ:
        Plicell modeli max_width_cm = 150
        Kullanıcı 200 girer →
        "Plicell modeli için maksimum en 150 cm olabilir,
         daha geniş camlar için iki parça sipariş veriniz."

   3. TİP UYUMU:
      • z.number() (coerce DEĞİL) + valueAsNumber:true register seçeneği
        → Input ve Output tipleri aynı kalır (number)
      → zodResolver'ın Resolver<FormValues, ...> tipiyle uyuşur

   4. Ürün Türlerine Göre Form:
        mt   → En + Boy + Pile Seçimi + Adet
        m2   → En + Boy + Adet
        adet → Yalnızca Adet (boyutlar 100×100 olarak saklanır)

   5. Canlı fiyat → /api/engine/calculate (imzalı token, Decimal.js).
   ────────────────────────────────────────────────────────────── */

// ─── Engine API response tipi (POST /api/engine/calculate) ─
// CalcResponse interface'ini route.ts ile senkron tut.

interface CalcApiResponse {
  preview: {
    totalPrice:      number;
    unitPrice:       number;
    usedQuantity:    number;
    unitLabel:       string;
    breakdownText:   string;
    calculationType: CalculationType;
  };
  token:     string;
  expiresAt: number;
}

// ─── Birleşik görüntü tipi (PricePreview bileşeni alır) ────
// Tüm türler (mt, m2, adet) → /api/engine/calculate (imzalı, Decimal.js)

interface DisplayPreview {
  totalPrice:       number;
  unitPrice:        number;
  usedQuantity:     number;
  unitLabel:        string;
  quantity:         number;
  pleatMultiplier?: number;
}

// ─── Sabit temel şema (bileşen dışında) ────────────────────
//
// z.number() kullanılır (z.coerce.number() değil).
// register('en', { valueAsNumber: true }) string→number dönüşümünü
// Zod öncesinde yapar; şema tutarlı bir Input=Output=number tipine sahip olur.
// Bu, zodResolver'ın Resolver<FormValues> ile uyuşması için zorunludur.

const baseSchema = z.object({
  en:        z.number(),
  boy:       z.number(),
  pileRatio: z.string(),
  quantity:  z.number().int().min(1, 'Miktar en az 1 olmalıdır.'),
});

type FormValues = z.infer<typeof baseSchema>;

export interface ModelLimits {
  maxWidthCm:  number;
  maxHeightCm: number;
  modelName:   string;
}

export interface PleatOption {
  id:         string;
  name:       string;
  multiplier: number;
}

export interface MeasurementFormProps {
  product: {
    id:               string;
    name:             string;
    slug:             string;
    images:           string[];
    base_price:       number;
    calculation_type: CalculationType;
    min_width_cm:     number | null;
    min_area_m2:      number | null;
    in_stock:         boolean;
  };
  /**
   * Perde modeli sınırları (curtain_models tablosundan).
   * NULL = modelsiz ürün; SIZE_LIMITS genel sınırları devreye girer.
   */
  modelLimits: ModelLimits | null;
  /**
   * mt türü için pile seçenekleri (product_pleats tablosundan).
   * Boşsa pile seçici gösterilmez ve API isteği gönderilmez.
   */
  pleats: PleatOption[];
}

// ─── Dinamik Zod şema fabrikası ────────────────────────────
//
// Fonksiyon bileşen DIŞINDA tanımlanır; useMemo her render'da
// yeni bir referans oluşturmak yerine sadece bağımlılıklar
// değiştiğinde çağırır.
//
// NEDEN superRefine?
//   .min() / .max() derleme zamanı sabiti alır.
//   max_width_cm çalışma zamanında DB'den gelir → superRefine zorunludur.

function buildMeasurementSchema(
  calculationType: CalculationType,
  maxWidthCm:      number,
  maxHeightCm:     number,
  modelName:       string,
) {
  return baseSchema.superRefine((data, ctx) => {
    // ── Boyut doğrulaması (adet türü için atla) ────────────
    if (calculationType !== 'adet') {
      // En
      if (!(data.en > 0) || isNaN(data.en)) {
        ctx.addIssue({ code: 'custom', path: ['en'], message: 'En değeri giriniz.' });
      } else if (data.en < SIZE_LIMITS.MIN_WIDTH) {
        ctx.addIssue({
          code: 'custom', path: ['en'],
          message: `Minimum en ${SIZE_LIMITS.MIN_WIDTH} cm olmalıdır.`,
        });
      } else if (data.en > maxWidthCm) {
        // KRITIK: model adı ve limit prop'tan dinamik olarak enjekte edilir
        ctx.addIssue({
          code: 'custom', path: ['en'],
          message:
            `${modelName} modeli için maksimum en ${maxWidthCm} cm olabilir, ` +
            `daha geniş camlar için iki parça sipariş veriniz.`,
        });
      }

      // Boy
      if (!(data.boy > 0) || isNaN(data.boy)) {
        ctx.addIssue({ code: 'custom', path: ['boy'], message: 'Boy değeri giriniz.' });
      } else if (data.boy < SIZE_LIMITS.MIN_HEIGHT) {
        ctx.addIssue({
          code: 'custom', path: ['boy'],
          message: `Minimum boy ${SIZE_LIMITS.MIN_HEIGHT} cm olmalıdır.`,
        });
      } else if (data.boy > maxHeightCm) {
        ctx.addIssue({
          code: 'custom', path: ['boy'],
          message: `${modelName} modeli için maksimum boy ${maxHeightCm} cm olabilir.`,
        });
      }
    }

    // ── Pile: sadece mt türü için zorunlu ──────────────────
    if (calculationType === 'mt' && !data.pileRatio) {
      ctx.addIssue({
        code: 'custom', path: ['pileRatio'],
        message: 'Pile oranı seçiniz.',
      });
    }
  });
}

// ─── Ana bileşen ───────────────────────────────────────────

export default function MeasurementForm({ product, modelLimits, pleats }: MeasurementFormProps) {
  const [added, setAdded]   = useState(false);
  const addToCart           = useCartStore((s) => s.addToCart);
  const calculationType     = product.calculation_type;

  const maxWidthCm  = modelLimits?.maxWidthCm  ?? SIZE_LIMITS.MAX_WIDTH;
  const maxHeightCm = modelLimits?.maxHeightCm ?? SIZE_LIMITS.MAX_HEIGHT;
  const modelName   = modelLimits?.modelName   ?? 'Bu perde';

  // KRITIK: Şema useMemo içinde inşa edilir.
  // maxWidthCm veya maxHeightCm değiştiğinde otomatik yeniden oluşturulur.
  const schema = useMemo(
    () => buildMeasurementSchema(calculationType, maxWidthCm, maxHeightCm, modelName),
    [calculationType, maxWidthCm, maxHeightCm, modelName],
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode:     'onTouched',
    defaultValues: {
      en:        calculationType === 'adet' ? 100 : NaN,
      boy:       calculationType === 'adet' ? 100 : NaN,
      pileRatio: '',
      quantity:  1,
    },
  });

  // Canlı önizleme için değerleri izle
  const watchedEn        = useWatch({ control, name: 'en' });
  const watchedBoy       = useWatch({ control, name: 'boy' });
  const watchedPileRatio = useWatch({ control, name: 'pileRatio' });
  const watchedQuantity  = useWatch({ control, name: 'quantity' });

  // ── Tüm türler: API'den imzalı token + önizleme ────────────
  const [apiResult,  setApiResult]  = useState<CalcApiResponse | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // mt → pile UUID seçilmeden API'ye gitme
    if (calculationType === 'mt' && !watchedPileRatio) {
      setApiResult(null);
      return;
    }

    const widthCm  = calculationType === 'adet' ? 100 : Math.round(Number(watchedEn)  || 0);
    const heightCm = calculationType === 'adet' ? 100 : Math.round(Number(watchedBoy) || 0);
    const qty      = Number(watchedQuantity) || 1;

    // Boyut eksikse önizlemeyi temizle
    if (calculationType !== 'adet' && (widthCm <= 0 || heightCm <= 0)) {
      setApiResult(null);
      return;
    }

    // 450 ms debounce — kullanıcı yazarken her tuşta istek gitmez
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setIsFetching(true);

      try {
        const res = await fetch('/api/engine/calculate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            productId: product.id,
            widthCm,
            heightCm,
            quantity:  qty,
            pleatId:   calculationType === 'mt' ? watchedPileRatio : null,
          }),
          signal: abortRef.current.signal,
        });

        if (res.ok) {
          const data: CalcApiResponse = await res.json();
          setApiResult(data);
        } else {
          setApiResult(null);
        }
      } catch {
        // AbortError veya ağ hatası — sessizce geç, önizleme temizlenir
        setApiResult(null);
      } finally {
        setIsFetching(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [calculationType, product.id, watchedEn, watchedBoy, watchedPileRatio, watchedQuantity]);

  // ── Birleşik görüntü ────────────────────────────────────────
  const displayPreview = useMemo((): DisplayPreview | null => {
    const qty = Number(watchedQuantity) || 1;
    if (!apiResult) return null;

    const selectedPleat = calculationType === 'mt'
      ? pleats.find((p) => p.id === watchedPileRatio)
      : undefined;

    return {
      totalPrice:      apiResult.preview.totalPrice,
      unitPrice:       apiResult.preview.unitPrice,
      usedQuantity:    apiResult.preview.usedQuantity,
      unitLabel:       apiResult.preview.unitLabel,
      quantity:        qty,
      pleatMultiplier: selectedPleat?.multiplier,
    };
  }, [calculationType, apiResult, watchedQuantity, watchedPileRatio, pleats]);

  // ── Sepete Ekle ───────────────────────────────────────────
  function onSubmit(data: FormValues) {
    if (!product.in_stock) return;
    if (!apiResult) return; // İmzalı token olmadan sepete ekleme

    const width  = calculationType !== 'adet' ? data.en  : 100;
    const height = calculationType !== 'adet' ? data.boy : 100;
    const pleatId = calculationType === 'mt' ? (data.pileRatio || null) : null;

    // Pile faktörü: mt → seçili pile multiplier'ından türet; diğerleri → SEYREK
    let pileFactor: PileFactor = 'SEYREK';
    let pileCoefficient = 1;
    if (calculationType === 'mt') {
      const selectedPleat = pleats.find((p) => p.id === pleatId);
      pileCoefficient = selectedPleat?.multiplier ?? 1;
      pileFactor = pileCoefficient >= 1.3 ? 'SIK' : pileCoefficient >= 1.2 ? 'NORMAL' : 'SEYREK';
    }

    const cartAdded = addToCart({
      productId:      product.id,
      productName:    product.name,
      productSlug:    product.slug,
      productImage:   product.images?.[0] ?? null,
      width,
      height,
      pileFactor,
      calculationType,
      pleatId,
      areaM2:         apiResult.preview.usedQuantity,
      pileCoefficient,
      unitPrice:      apiResult.preview.unitPrice,
      priceToken:     apiResult.token,
      tokenExpiresAt: apiResult.expiresAt,
      quantity:       data.quantity,
    });

    if (!cartAdded) return; // store: süresi dolmuş token reddedildi

    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  const isMt   = calculationType === 'mt';
  const isAdet = calculationType === 'adet';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">

      {/* ── 1. Birim fiyat başlığı ───────────────────────── */}
      <UnitPriceHeader
        basePrice={product.base_price}
        calculationType={calculationType}
      />

      <div className="h-px bg-[#F3F4F6]" aria-hidden="true" />

      {/* ── 2. Boyut girişleri (adet hariç) ─────────────── */}
      {!isAdet && (
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-black">
              Ölçü Girin
            </p>
            <Link
              href="/olcu-kilavuzu"
              className={[
                'text-[10px] tracking-[0.08em] text-[#9CA3AF]',
                'border-b border-[#E0E0E0] pb-[1px]',
                'hover:text-[#B89947] hover:border-[#B89947]',
                'transition-colors duration-200 shrink-0',
              ].join(' ')}
            >
              Ölçü Nasıl Alınır?
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MeasureInput
              id="pdp-en"
              label="En"
              registration={register('en', { valueAsNumber: true })}
              error={errors.en?.message}
            />
            <MeasureInput
              id="pdp-boy"
              label="Boy"
              registration={register('boy', { valueAsNumber: true })}
              error={errors.boy?.message}
            />
          </div>

          <p className="mt-3 text-[10px] tracking-[0.04em] text-[#C8C8C8]">
            Min {SIZE_LIMITS.MIN_WIDTH} × {SIZE_LIMITS.MIN_HEIGHT} cm
            {' · '}
            Maks {maxWidthCm} × {maxHeightCm} cm
            {modelLimits ? ` (${modelName})` : ''}
          </p>
        </div>
      )}

      {/* ── 3. Pile seçici (sadece mt) ───────────────────── */}
      {isMt && (
        <PileSelector
          registration={register('pileRatio')}
          error={errors.pileRatio?.message}
          pleats={pleats}
        />
      )}

      {/* ── 4. Canlı fiyat paneli ────────────────────────── */}
      {isFetching && !displayPreview && (
        <div
          className="border border-[#F3F4F6] bg-[#FAFAFA] px-5 py-4 h-[120px] animate-pulse"
          aria-label="Fiyat hesaplanıyor"
          aria-busy="true"
        />
      )}
      {displayPreview && (
        <PricePreview
          preview={displayPreview}
          calculationType={calculationType}
          isFetching={isFetching}
        />
      )}

      {/* ── 5. Adet + Sepete Ekle ───────────────────────── */}
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <QuantityInput
          register={register}
          control={control}
          setValue={setValue}
        />

        <button
          type="submit"
          disabled={!product.in_stock || added}
          className={[
            'h-[50px] text-[11px] tracking-[0.38em] uppercase font-medium',
            'transition-colors duration-300',
            added
              ? 'bg-black text-white cursor-default'
              : product.in_stock
                ? 'bg-black text-white hover:bg-[#B89947]'
                : 'bg-[#F5F5F5] text-[#ADADAD] border border-[#E5E5E5] cursor-not-allowed',
          ].join(' ')}
        >
          {!product.in_stock
            ? 'Stokta Yok'
            : added
              ? '✓  Sepete Eklendi'
              : 'Sepete Ekle'}
        </button>
      </div>

      {!product.in_stock && (
        <p className="text-[10px] tracking-[0.06em] text-[#9CA3AF] -mt-3">
          Bu ürün şu an stokta yok.{' '}
          <Link
            href="/kategori/tum-urunler"
            className="underline hover:text-black transition-colors"
          >
            Benzer ürünleri inceleyin
          </Link>
        </p>
      )}
    </form>
  );
}

// ─── Alt bileşenler ────────────────────────────────────────

function UnitPriceHeader({
  basePrice,
  calculationType,
}: {
  basePrice:       number;
  calculationType: CalculationType;
}) {
  const label =
    calculationType === 'mt'    ? 'metre başına fiyat · KDV dahil' :
    calculationType === 'm2'    ? 'm² başına fiyat · KDV dahil'     :
    /* adet */                    'adet fiyatı · KDV dahil';

  return (
    <div>
      <p
        className="text-[30px] lg:text-[32px] font-medium tracking-[0.01em] leading-none"
        style={{ color: 'var(--accent)' }}
      >
        {formatTRY(basePrice)}
      </p>
      <p className="mt-[9px] text-[11px] tracking-[0.06em] text-[#9CA3AF]">{label}</p>
    </div>
  );
}

/* ── Ölçü input alanı ──────────────────────────────────────
   Hata: kırmızı sınır + hata mesajı
   Odak: altın ring (tasarım sistemi)
   ────────────────────────────────────────────────────────── */
function MeasureInput({
  id,
  label,
  registration,
  error,
}: {
  id:           string;
  label:        string;
  registration: ReturnType<UseFormRegister<FormValues>>;
  error?:       string;
}) {
  const hasError = !!error;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] tracking-[0.14em] uppercase font-medium text-black mb-2.5"
      >
        {label}
      </label>

      <div className="relative">
        <input
          {...registration}
          id={id}
          type="number"
          inputMode="decimal"
          placeholder="0"
          min={0}
          className={[
            'w-full px-4 pr-11 py-[14px]',
            'text-[15px] text-black tracking-[0.04em]',
            'bg-white placeholder:text-[#DADADA]',
            'focus:outline-none transition-colors duration-200',
            '[appearance:textfield]',
            '[&::-webkit-inner-spin-button]:appearance-none',
            '[&::-webkit-outer-spin-button]:appearance-none',
            hasError
              ? 'border border-red-400 focus:ring-1 focus:ring-red-400 focus:border-red-400'
              : 'border border-gray-200 focus:ring-1 focus:ring-[#B89947] focus:border-[#B89947]',
          ].join(' ')}
          aria-describedby={hasError ? `${id}-error` : undefined}
          aria-invalid={hasError || undefined}
        />
        <span
          aria-hidden="true"
          className={[
            'absolute right-4 top-1/2 -translate-y-1/2',
            'text-[11px] font-normal tracking-[0.04em] leading-none',
            'select-none pointer-events-none',
            hasError ? 'text-red-400' : 'text-[#ADADAD]',
          ].join(' ')}
        >
          cm
        </span>
      </div>

      {/* KRITIK: model adı ve limit bu mesajda dinamik olarak yer alır */}
      {hasError && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-[10px] leading-[1.5] tracking-[0.03em] text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Pile seçici ───────────────────────────────────────────
   has-[:checked] CSS ile radio buton seçili stillemesi.
   Sadece mt türü ürünlerde gösterilir.
   Seçenekler product_pleats tablosundan DB'den gelir.
   ────────────────────────────────────────────────────────── */
function PileSelector({
  registration,
  error,
  pleats,
}: {
  registration: ReturnType<UseFormRegister<FormValues>>;
  error?:       string;
  pleats:       PleatOption[];
}) {
  if (pleats.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3.5">
        <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-black">
          Pile Oranı
        </p>
        <div className="group relative">
          <Info size={13} strokeWidth={1.5} className="text-[#ADADAD] cursor-help" aria-hidden="true" />
          <div
            className="invisible group-hover:visible absolute left-0 top-6 z-20 w-60 p-4 bg-[#111111] text-white text-[9px] tracking-[0.05em] leading-relaxed"
            role="tooltip"
          >
            <p className="text-white/60">Pile oranı, perdenin dalgalılık yoğunluğunu belirler. Daha yüksek oran daha volümlü görünüm sağlar.</p>
          </div>
        </div>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${pleats.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label="Pile oranı seçimi"
      >
        {pleats.map((pleat) => (
          <label
            key={pleat.id}
            className={[
              'flex flex-col items-center justify-center gap-0.5',
              'py-3 px-2 border text-center cursor-pointer',
              'border-[#E5E5E5] hover:border-black',
              'has-[:checked]:border-black has-[:checked]:bg-[#111111] has-[:checked]:text-white',
              'transition-colors duration-200',
            ].join(' ')}
          >
            <input {...registration} type="radio" value={pleat.id} className="sr-only" />
            <span className="text-[10px] tracking-[0.18em] uppercase font-medium">
              {pleat.name}
            </span>
            <span className="text-[9px] opacity-60">×{pleat.multiplier}</span>
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-[10px] text-red-500">{error}</p>
      )}
    </div>
  );
}

/* ── Canlı fiyat paneli ─────────────────────────────────────
   aria-live="polite" → hesap değişince ekran okuyucuya bildirilir.
   DisplayPreview → mt (yerel) ve m2/adet (API) için ortak tip.
   ────────────────────────────────────────────────────────── */
function PricePreview({
  preview,
  calculationType,
  isFetching,
}: {
  preview:         DisplayPreview;
  calculationType: CalculationType;
  isFetching:      boolean;
}) {
  return (
    <div
      className={[
        'border border-[#F3F4F6] bg-[#FAFAFA] px-5 py-4 space-y-2.5',
        isFetching ? 'opacity-60' : '',
      ].join(' ')}
      aria-live="polite"
      aria-label="Fiyat özeti"
      aria-busy={isFetching}
    >
      <p className="text-[8px] tracking-[0.4em] uppercase text-[#9CA3AF] mb-3">
        Fiyat Özeti
      </p>

      {calculationType !== 'adet' && (
        <PriceRow
          label={
            calculationType === 'mt' && preview.pleatMultiplier !== undefined
              ? `Hesaplanan kumaş (pile ×${preview.pleatMultiplier})`
              : 'Toplam alan'
          }
          value={`${preview.usedQuantity.toFixed(2)} ${preview.unitLabel}`}
        />
      )}

      {preview.quantity > 1 && (
        <PriceRow label="Adet" value={`×${preview.quantity}`} />
      )}

      <div className="border-t border-[#EBEBEB] pt-3 flex items-center justify-between">
        <span className="text-[9px] tracking-[0.3em] uppercase text-[#9CA3AF]">Toplam</span>
        <span className="font-serif font-light text-[22px] tracking-[0.02em] text-black leading-none">
          {formatTRY(preview.totalPrice)}
        </span>
      </div>

      <p className="text-[9px] tracking-[0.04em] text-[#C0C0C0]">
        Fiyatlar KDV dahildir · Montaj ücreti ayrıca hesaplanır
      </p>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] tracking-[0.08em] text-[#9CA3AF]">{label}</span>
      <span className="text-[11px] tracking-[0.06em] text-[#4A4A4A]">{value}</span>
    </div>
  );
}

/* ── Adet kontrolü ─────────────────────────────────────────
   setValue ile react-hook-form ile entegre.
   +/- butonları setValue üzerinden değeri günceller.
   ────────────────────────────────────────────────────────── */
function QuantityInput({
  register,
  control,
  setValue,
}: {
  register:  UseFormRegister<FormValues>;
  control:   Control<FormValues>;
  setValue:  UseFormSetValue<FormValues>;
}) {
  const currentQty = useWatch({ control, name: 'quantity' }) ?? 1;

  return (
    <div
      className="flex items-center border border-[#E5E7EB] h-[50px] w-[120px]"
      role="group"
      aria-label="Adet seçici"
    >
      <button
        type="button"
        onClick={() => setValue('quantity', Math.max(1, currentQty - 1), { shouldValidate: true })}
        disabled={currentQty <= 1}
        aria-label="Adeti azalt"
        className="flex items-center justify-center w-10 h-full shrink-0 text-black hover:text-[#B89947] disabled:opacity-[0.22] disabled:cursor-default transition-colors duration-200"
      >
        <Minus size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <input
        {...register('quantity', { valueAsNumber: true })}
        type="number"
        min={1}
        className="flex-1 min-w-0 text-center text-[14px] tracking-[0.08em] text-black tabular-nums bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-live="polite"
        aria-label={`Seçilen adet: ${currentQty}`}
      />

      <button
        type="button"
        onClick={() => setValue('quantity', currentQty + 1, { shouldValidate: true })}
        aria-label="Adeti artır"
        className="flex items-center justify-center w-10 h-full shrink-0 text-black hover:text-[#B89947] transition-colors duration-200"
      >
        <Plus size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Yardımcı ──────────────────────────────────────────────

function formatTRY(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style:                 'currency',
    currency:              'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
