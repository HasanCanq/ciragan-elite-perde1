import Link from 'next/link';
import Image from 'next/image';
import type { ProductWithCategory, CalculationType } from '@/types';

/* ──────────────────────────────────────────────────────────────
   AdvisorProductCard — Perde Danışmanı PLP ürün kartı
   ──────────────────────────────────────────────────────────────
   KRITIK FİYAT KURALI:
     Kullanıcı henüz ölçü girmediği için toplam fiyat hesaplanamaz.
     Sepet terk oranını artıran "sticker shock" riskini önlemek için
     kesinlikle toplam fiyat gösterilmez. Yalnızca birim fiyat:

       mt   → "₺X / metre"
       m2   → "₺X / m²"
       adet → "₺X / adet"

     + "Fiyat, ölçülerinize göre hesaplanır" yardım metni.
   ──────────────────────────────────────────────────────────────
   Kart anatomisi (üstten aşağı):
     1. Ürün görseli — 4:3 oranı, object-cover
     2. Stok durumu chip'i (sağ alt köşe)
     3. Kategori etiketi (eyebrow)
     4. Ürün adı (serif)
     5. Kısa açıklama
     6. Birim fiyat + hesaplama hint'i
     7. "İncele →" link satırı

   Hover:
     • Üst kenarda altın çizgi açılır
     • Görsel hafifçe büyür (scale)
     • İsim altın rengi alır
   ────────────────────────────────────────────────────────────── */

interface AdvisorProductCardProps {
  product: ProductWithCategory;
}

export default function AdvisorProductCard({ product }: AdvisorProductCardProps) {
  const firstImage = product.images?.[0] ?? null;

  return (
    <Link
      href={`/urun/${product.slug}`}
      aria-label={`${product.name} — ürün detayını gör`}
      className={[
        'group relative flex flex-col',
        'border border-[#E5E5E5] hover:border-black',
        'overflow-hidden',
        'transition-colors duration-300',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B89947]',
      ].join(' ')}
    >
      {/* Altın üst çizgi */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px] bg-[#B89947] scale-x-0 group-hover:scale-x-100 transition-transform duration-400 origin-left z-10"
      />

      {/* ── Görsel alanı ──────────────────────────────────────── */}
      <div
        className={[
          'relative overflow-hidden',
          'bg-[#F9F9F9]',
          /* 4:3 oranı */
          'aspect-[1/1]',
        ].join(' ')}
        aria-hidden="true"
      >
        {firstImage ? (
          <Image
            src={firstImage}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
          />
        ) : (
          /* Görsel yokken placeholder */
          <div className="absolute inset-0 flex items-center justify-center">
            <ImagePlaceholder />
          </div>
        )}

        {/* Stok durumu chip'i */}
        {!product.in_stock && (
          <span
            className={[
              'absolute bottom-3 right-3 z-10',
              'px-2.5 py-1',
              'text-[8px] tracking-[0.3em] uppercase',
              'bg-[#111111] text-white',
            ].join(' ')}
          >
            Tükendi
          </span>
        )}
      </div>

      {/* ── Metin bölümü ──────────────────────────────────────── */}
      <div className="flex flex-col flex-1 px-5 py-5">
        {/* Kategori etiketi */}
        {product.category && (
          <p className="text-[8px] tracking-[0.4em] uppercase text-[#9CA3AF] mb-2">
            {product.category.name}
          </p>
        )}

        {/* Ürün adı */}
        <h3
          className={[
            'font-serif font-light',
            'text-[18px] leading-snug tracking-[0.02em]',
            'text-black group-hover:text-[#B89947]',
            'transition-colors duration-200',
            'mb-2',
          ].join(' ')}
        >
          {product.name}
        </h3>

        {/* Kısa açıklama */}
        {product.short_description && (
          <p
            className={[
              'text-[11px] leading-[1.7] tracking-[0.025em]',
              'text-[#6B7280]',
              'mb-4 flex-1',
              'line-clamp-2',
            ].join(' ')}
          >
            {product.short_description}
          </p>
        )}

        {/* ── Fiyat bloğu ───────────────────────────────────── */}
        <div className="mt-auto pt-4 border-t border-[#F3F4F6]">
          <UnitPrice
            price={product.base_price}
            calculationType={product.calculation_type}
          />
        </div>

        {/* Aksiyon satırı */}
        <div
          className={[
            'flex items-center gap-1.5 mt-4',
            'text-[9px] tracking-[0.38em] uppercase font-medium',
            'text-black group-hover:text-[#B89947]',
            'transition-colors duration-200',
            'w-fit',
          ].join(' ')}
          aria-hidden="true"
        >
          İncele
          <svg
            viewBox="0 0 12 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform duration-200"
          >
            <path d="M1 5 H11 M7 1 L11 5 L7 9" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ── Birim fiyat gösterimi ───────────────────────────────────── */
function UnitPrice({
  price,
  calculationType,
}: {
  price: number;
  calculationType: CalculationType;
}) {
  const formatted = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  const unitLabel =
    calculationType === 'mt'   ? 'metre' :
    calculationType === 'm2'   ? 'm²'    :
    /* adet */                   'adet';

  return (
    <div>
      {/* Birim fiyat */}
      <p
        className={[
          'text-[17px] font-medium tracking-[0.01em]',
          'text-[#111111]',
          'leading-none mb-1',
        ].join(' ')}
      >
        {formatted}
        <span className="text-[11px] font-normal tracking-[0.04em] text-[#9CA3AF] ml-1">
          / {unitLabel}
        </span>
      </p>

      {/* Hesaplama ipucu — KRITIK: toplam fiyat asla gösterilmez */}
      <p className="text-[9px] tracking-[0.06em] text-[#B0B0B0] leading-none">
        Fiyat, ölçülerinize göre hesaplanır
      </p>
    </div>
  );
}

/* ── Görsel placeholder ─────────────────────────────────────── */
function ImagePlaceholder() {
  return (
    <svg
      viewBox="0 0 80 60"
      fill="none"
      stroke="#D1D5DB"
      strokeWidth="1"
      aria-hidden="true"
      className="w-16 h-16 opacity-40"
    >
      {/* Perde silueti */}
      <rect x="10" y="5" width="60" height="50" rx="0" />
      <line x1="40" y1="5" x2="40" y2="55" />
      {/* Kıvrım çizgileri - sol panel */}
      <path d="M10 15 Q22 20 18 30 Q14 40 22 50" />
      <path d="M18 15 Q30 22 26 32 Q22 42 30 50" />
      {/* Kıvrım çizgileri - sağ panel */}
      <path d="M70 15 Q58 20 62 30 Q66 40 58 50" />
      <path d="M62 15 Q50 22 54 32 Q58 42 50 50" />
    </svg>
  );
}
