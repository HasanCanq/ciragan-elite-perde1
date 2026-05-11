'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

export type GalleryImage = {
  id:    string
  url?:  string   // Supabase Storage URL — yoksa placeholder render edilir
  label: string
}

/* ── Linen texture placeholder ──────────────────────────────────────────────
   Gerçek ürün fotoğrafı geldiğinde sadece iç yapı değiştirilir,
   dış sarmalayıcı geometrisi aynı kalır.
   ─────────────────────────────────────────────────────────────────────────── */
function LinenPlaceholder({
  label,
  small = false,
}: {
  label: string
  small?: boolean
}) {
  return (
    <div className="absolute inset-0 bg-[#EDECEA] flex flex-col items-center justify-center gap-1.5 select-none pointer-events-none">
      {/* Hassas dokuma dokusu %3 opaklıkta */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(  0deg, #000 0, #000 1px, transparent 0, transparent 6px),
            repeating-linear-gradient( 90deg, #000 0, #000 1px, transparent 0, transparent 6px)
          `,
        }}
      />
      {!small ? (
        <>
          <p className="relative text-[9px] tracking-[0.52em] uppercase text-[#B5B5B0]">
            Keten Fon
          </p>
          <div className="relative w-6 h-px bg-[#CACAC4]" />
          <p className="relative text-[8px] tracking-[0.32em] uppercase text-[#C8C8C2]">
            Kandilli
          </p>
        </>
      ) : (
        <p className="relative text-[7px] tracking-[0.26em] uppercase text-[#C0C0BA]">
          {label.slice(0, 5)}
        </p>
      )}
    </div>
  )
}

/* ── Gallery ────────────────────────────────────────────────────────────────
   Desktop: dikey küçük resim şeridi (68px) + ana görsel yan yana
   Mobil:   ana görsel + alt yatay küçük resim şeridi
   Klavye:  ← → ile görsel değişimi (odaklandığında)

   NOT: Sticky davranışı kaldırıldı — page.tsx sağ kolon sticky olarak
        işaretlenmiştir. Galeri artık sayfa ile birlikte kaydırılır.
   ─────────────────────────────────────────────────────────────────────────── */
export default function PDPGallery({ images }: { images: GalleryImage[] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Klavye navigasyonu — functional update ile stale closure yok
  useEffect(() => {
    const el = containerRef.current
    if (!el || images.length <= 1) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (i + 1) % images.length)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (i - 1 + images.length) % images.length)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActiveIdx(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActiveIdx(images.length - 1)
      }
    }

    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [images.length])

  const ThumbButton = ({
    img,
    idx,
    className,
    style,
  }: {
    img: GalleryImage
    idx: number
    className?: string
    style?: React.CSSProperties
  }) => (
    <button
      type="button"
      onClick={() => setActiveIdx(idx)}
      aria-label={img.label}
      aria-pressed={activeIdx === idx}
      className={[
        'relative overflow-hidden',
        'transition-all duration-200',
        activeIdx === idx
          ? 'ring-1 ring-[#B89947] ring-offset-[2px] opacity-100'
          : 'opacity-45 hover:opacity-75',
        className ?? '',
      ].join(' ')}
      style={style}
    >
      {img.url ? (
        <Image src={img.url} alt={img.label} fill className="object-cover" sizes="80px" />
      ) : (
        <LinenPlaceholder label={img.label} small />
      )}
    </button>
  )

  return (
    <div
      ref={containerRef}
      tabIndex={images.length > 1 ? 0 : undefined}
      role="region"
      aria-label="Ürün görselleri"
      className="focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B89947]/30"
    >

      {/* Desktop: küçük resim şeridi (sol) + ana görsel (sağ) */}
      <div className="flex gap-2.5">

        {/* Dikey küçük resim kolonu — mobilde gizli */}
        <div className="hidden lg:flex flex-col gap-2 w-[66px] shrink-0">
          {images.map((img, i) => (
            <ThumbButton
              key={img.id}
              img={img}
              idx={i}
              style={{ aspectRatio: '1/1' }}
            />
          ))}
        </div>

        {/* Ana görsel */}
        <div
          className="relative flex-1 overflow-hidden min-w-0"
          style={{ aspectRatio: '1/1' }}
        >
          <div
            className={[
              'absolute inset-0',
              'transition-opacity duration-500',
              'ease-[cubic-bezier(0.25,0.1,0.25,1)]',
            ].join(' ')}
          >
            {images[activeIdx]?.url ? (
              <Image
                src={images[activeIdx].url}
                alt={images[activeIdx]?.label ?? ''}
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover"
              />
            ) : (
              <LinenPlaceholder label={images[activeIdx]?.label ?? ''} />
            )}
          </div>

          {/* Görsel sayacı — sağ alt köşe */}
          {images.length > 1 && (
            <div
              aria-hidden="true"
              className={[
                'absolute bottom-4 right-4 z-10',
                'text-[9px] tracking-[0.18em] text-[#ABABAB]',
                'font-light tabular-nums',
              ].join(' ')}
            >
              {String(activeIdx + 1).padStart(2, '0')}&nbsp;/&nbsp;
              {String(images.length).padStart(2, '0')}
            </div>
          )}

          {/* Klavye yardım ipucu — yalnızca odak alındığında */}
          {images.length > 1 && (
            <div
              aria-hidden="true"
              className={[
                'absolute bottom-4 left-4 z-10',
                'opacity-0 focus-within:opacity-100',
                'transition-opacity duration-300',
              ].join(' ')}
            >
              <span className="text-[8px] tracking-[0.12em] text-[#ABABAB]">← →</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobil: yatay küçük resim şeridi — lg+ boyutlarda gizli */}
      {images.length > 1 && (
        <div className="lg:hidden flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
          {images.map((img, i) => (
            <ThumbButton
              key={img.id}
              img={img}
              idx={i}
              className="shrink-0"
              style={{ aspectRatio: '1/1', width: '18%' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
