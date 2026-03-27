import Link from 'next/link'
import AssistantTriggerButtons from '@/components/advisor/AssistantTriggerButtons'

/* ── HeroSection ───────────────────────────────────────────────────────────
   Minimalist 2-column split layout.
   • Left  — brand statement copy + CTAs
   • Right — full-height image placeholder (swap with next/image in prod)

   Responsive behaviour:
   • Mobile (< lg) : image stacks above content, image height = 60vw
   • Desktop (lg+) : side-by-side 50 / 50, fills remaining viewport height
   ─────────────────────────────────────────────────────────────────────────── */
export default function HeroSection() {
  return (
    <section
      aria-label="Ana sayfa hero"
      className="grid lg:grid-cols-2 min-h-[calc(100vh-64px)]"
    >
      {/* ── Left: Content ─────────────────────────────────────────────────
          Stacks below image on mobile (order-2), appears left on desktop
          ────────────────────────────────────────────────────────────────── */}
      <div
        className={[
          'flex flex-col justify-center',
          'order-2 lg:order-1',
          'py-16 lg:py-0',
          'px-6 sm:px-10 lg:px-14 xl:px-20 2xl:px-24',
        ].join(' ')}
      >
        {/* Eyebrow */}
        <p className="h-eyebrow mb-7">
          Yeni Koleksiyon&nbsp;&nbsp;·&nbsp;&nbsp;2025
        </p>

        {/* Display heading — Cormorant Garamond, weight 300
            "Zarafet" in italic for editorial contrast              */}
        <h1
          className={[
            'font-serif font-light text-black',
            'text-[48px] leading-[1.0] tracking-[0.02em]',
            'sm:text-[56px]',
            'lg:text-[64px]',
            'xl:text-[76px]',
            'mb-7',
          ].join(' ')}
        >
          Zamansız
          <br />
          <em className="not-italic italic">Zarafet</em>
        </h1>

        {/* Thin rule below heading */}
        <div className="w-10 h-px bg-[#B89947] mb-7" />

        {/* Subtitle */}
        <p
          className={[
            'text-[13px] leading-[1.9] tracking-[0.025em]',
            'text-[#6B7280]',
            'max-w-[360px]',
            'mb-10',
          ].join(' ')}
        >
          Evinizin ruhunu yansıtan, özenle seçilmiş
          minimalist perde koleksiyonumuzu keşfedin.
        </p>

        {/* CTA buttons — AssistantTriggerButtons koleksiyonu + asistan aksiyonlarını içerir */}
        <AssistantTriggerButtons />

        {/* Scroll indicator — desktop only */}
        <div
          aria-hidden="true"
          className="hidden lg:flex items-center gap-3 mt-14 xl:mt-20"
        >
          <div className="w-6 h-px bg-black/25" />
          <span className="text-[9px] tracking-[0.42em] uppercase text-[#9CA3AF]">
            Aşağı Kaydır
          </span>
        </div>
      </div>

      {/* ── Right: Image placeholder ───────────────────────────────────────
          Replace the inner <div> with:
            <Image src="..." alt="..." fill className="object-cover" />
          when a real product image is available.

          The outer wrapper keeps overflow hidden for future image zoom-hover.
          ────────────────────────────────────────────────────────────────── */}
      <div
        className={[
          'relative overflow-hidden',
          'order-1 lg:order-2',
          'bg-[#F3F4F6]',
          /* Mobile: proportional height; Desktop: fills grid row via stretch */
          'h-[62vw] lg:h-auto',
        ].join(' ')}
      >
        {/* Placeholder interior — remove entirely when using real image */}
        <PlaceholderVisual />

        {/* Product label chip — bottom-left */}
        <div className="absolute bottom-6 left-6 z-10">
          <span
            className={[
              'inline-block px-3 py-1.5',
              'text-[9px] tracking-[0.3em] uppercase text-black',
              'bg-white/85 backdrop-blur-sm',
              'border border-[#F3F4F6]',
            ].join(' ')}
          >
            Keten Tül Koleksiyonu
          </span>
        </div>

        {/* Subtle corner markers — purely decorative */}
        <CornerMarkers />
      </div>
    </section>
  )
}

/* ── Placeholder visual ─────────────────────────────────────────────────── */
function PlaceholderVisual() {
  return (
    <>
      {/* Cross-hair guides */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-px bg-black/5 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px bg-black/5 pointer-events-none"
      />

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none select-none">
        <p className="text-[9px] tracking-[0.52em] uppercase text-[#B0B0B0]">
          Keten Tül
        </p>
        <p className="text-[9px] tracking-[0.3em] uppercase text-[#C8C8C8]">
          2025 · Koleksiyon
        </p>
      </div>
    </>
  )
}

/* ── Corner markers ─────────────────────────────────────────────────────── */
function CornerMarkers() {
  const corners = [
    'top-4 left-4 border-t border-l',
    'top-4 right-4 border-t border-r',
    'bottom-4 left-4 border-b border-l',
    'bottom-4 right-4 border-b border-r',
  ] as const

  return (
    <>
      {corners.map((cls) => (
        <div
          key={cls}
          aria-hidden="true"
          className={`absolute w-4 h-4 border-black/12 ${cls}`}
        />
      ))}
    </>
  )
}
