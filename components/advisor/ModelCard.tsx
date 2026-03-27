'use client';

import { useRouter } from 'next/navigation';
import { CurtainIllustration } from './CurtainIllustration';
import type { CurtainModel } from '@/types';

/* ──────────────────────────────────────────────────────────────
   ModelCard — Step 2 interaktif perde model kartı
   ──────────────────────────────────────────────────────────────
   Tıklanınca kullanıcıyı PLP'ye yönlendirir:
     /kategori/tum-urunler?model=[slug]&oda=[roomSlug]

   Kart anatomisi (yukarıdan aşağı):
     1. SVG illüstrasyon alanı (~%45 yükseklik)
     2. Altın çizgi ayırıcı
     3. Model adı (serif, büyük)
     4. Marketing text (muted, satır sınırlamalı)
     5. Boyut chip'leri (max genişlik × yükseklik)
     6. "Ürünleri Gör →" aksiyonu

   Hover:
     • Üst kenarda altın çizgi açılır (scale transform)
     • SVG ikonu altın rengi alır
     • Arka plan çok hafif gri — kartı "kaldırır"
   ────────────────────────────────────────────────────────────── */

interface ModelCardProps {
  model: CurtainModel;
  /** room_models_mapping'den gelen oda + model kombinasyonu pazarlama metni */
  marketingText: string | null;
  /** Mevcut oda slug'ı — PLP URL'ine eklenir */
  roomSlug: string;
}

export default function ModelCard({ model, marketingText, roomSlug }: ModelCardProps) {
  const router = useRouter();

  function handleClick() {
    // PLP'ye yönlendir; oda bağlamını da URL'e ekle
    router.push(`/urunler?model=${model.slug}&oda=${roomSlug}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${model.name} modeli ürünlerini gör`}
      className={[
        'group relative w-full text-left',
        'flex flex-col',
        'border border-[#E5E5E5]',
        /* Hover */
        'hover:border-black',
        'hover:shadow-ring', // tailwind.config: ring = 0 0 0 1px #000
        'transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B89947]',
        'cursor-pointer',
        'overflow-hidden',
      ].join(' ')}
    >
      {/* Altın üst çizgi */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px] bg-[#B89947] scale-x-0 group-hover:scale-x-100 transition-transform duration-400 origin-left z-10"
      />

      {/* ── İllüstrasyon Alanı ───────────────────────────────── */}
      <div
        className={[
          'relative flex items-center justify-center',
          'bg-[#FAFAFA] group-hover:bg-[#F3F4F6]',
          'transition-colors duration-300',
          'py-8 px-6',
          /* Sabit oran: illüstrasyon her zaman kare yakını alanda görünür */
          'min-h-[160px]',
        ].join(' ')}
        aria-hidden="true"
      >
        <CurtainIllustration
          slug={model.slug}
          className={[
            'w-[80px] h-[100px]',
            'text-[#C0C0C0] group-hover:text-[#B89947]',
            'transition-colors duration-300',
          ].join(' ')}
        />
      </div>

      {/* ── Metin Bölümü ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 px-5 py-5">
        {/* İnce ayırıcı */}
        <div className="w-6 h-px bg-[#B89947] mb-4" />

        {/* Model adı */}
        <h3
          className={[
            'font-serif font-light',
            'text-[22px] leading-none tracking-[0.03em]',
            'text-black mb-3',
          ].join(' ')}
        >
          {model.name}
        </h3>

        {/* Marketing text — oda + model kombinasyonuna özgü */}
        <p
          className={[
            'text-[12px] leading-[1.7] tracking-[0.03em]',
            'text-[#6B7280]',
            'mb-5 flex-1',
            /* Maksimum 3 satır */
            'line-clamp-3',
          ].join(' ')}
        >
          {marketingText ?? model.description ?? ''}
        </p>

        {/* Boyut chip'leri */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <DimensionChip label="Maks. En" value={`${model.max_width_cm} cm`} />
          <span className="text-[#D1D5DB] text-[10px]">×</span>
          <DimensionChip label="Maks. Boy" value={`${model.max_height_cm} cm`} />
        </div>

        {/* Aksiyon satırı */}
        <div
          className={[
            'flex items-center gap-1.5',
            'text-[10px] tracking-[0.38em] uppercase font-medium',
            'text-black group-hover:text-[#B89947]',
            'transition-colors duration-200',
            'border-b border-black group-hover:border-[#B89947]',
            'pb-px w-fit',
          ].join(' ')}
          aria-hidden="true"
        >
          Ürünleri Gör
          <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform duration-200">
            <path d="M1 5 H11 M7 1 L11 5 L7 9" />
          </svg>
        </div>
      </div>
    </button>
  );
}

/* ── Dimension chip ─────────────────────────────────────────── */
function DimensionChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex flex-col items-center px-2.5 py-1 bg-[#F3F4F6]">
      <span className="text-[8px] tracking-[0.3em] uppercase text-[#9CA3AF] leading-none mb-0.5">
        {label}
      </span>
      <span className="text-[11px] tracking-[0.06em] text-black font-medium leading-none">
        {value}
      </span>
    </span>
  );
}
