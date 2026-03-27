'use client'

import { useState } from 'react'
import Image from 'next/image'

export type GalleryImage = {
  id:    string
  url?:  string   // Supabase Storage URL — yoksa placeholder render edilir
  label: string
}

/* ── Linen texture placeholder ──────────────────────────────────────────────
   Swap the entire inner structure for a real <Image ... fill> when
   product photography is available. The outer wrapper geometry stays intact.
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
      {/* Fine weave texture at 3% opacity */}
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
   Desktop: vertical thumbnail strip (68px) + main image side-by-side
   Mobile:  main image + horizontal thumb strip below
   Sticky: wraps with `lg:sticky lg:top-[88px] lg:self-start`
   ─────────────────────────────────────────────────────────────────────────── */
export default function PDPGallery({ images }: { images: GalleryImage[] }) {
  const [activeIdx, setActiveIdx] = useState(0)

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
    /*  lg:sticky + lg:self-start = gallery sticks to the top of the viewport
        while the right-side product form scrolls past it on desktop.
        top-[88px] = 64px nav + 24px breathing room                           */
    <div className="lg:sticky lg:top-[88px] lg:self-start">

      {/* Desktop: flex row — thumbnail strip left, main image right */}
      <div className="flex gap-2.5">

        {/* Vertical thumbnail column — hidden on mobile */}
        <div className="hidden lg:flex flex-col gap-2 w-[66px] shrink-0">
          {images.map((img, i) => (
            <ThumbButton
              key={img.id}
              img={img}
              idx={i}
              style={{ aspectRatio: '2/3' }}
            />
          ))}
        </div>

        {/* Main image */}
        <div
          className="relative flex-1 overflow-hidden min-w-0"
          style={{ aspectRatio: '2/3' }}
        >
          {/* Scaleable inner layer */}
          <div
            className={[
              'absolute inset-0',
              'transition-transform duration-700',
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

          {/* Zero-index counter — bottom-right chip */}
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
        </div>
      </div>

      {/* Mobile: horizontal thumbnail strip — hidden on lg+ */}
      <div className="lg:hidden flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
        {images.map((img, i) => (
          <ThumbButton
            key={img.id}
            img={img}
            idx={i}
            className="shrink-0"
            style={{ aspectRatio: '2/3', width: '18%' }}
          />
        ))}
      </div>
    </div>
  )
}
