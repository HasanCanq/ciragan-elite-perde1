'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Minus } from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────────────────── */
export type Color = {
  id:   string
  name: string
  hex:  string
}

export type AccordionItem = {
  title:   string
  content: string
}

export type PDPFormProps = {
  price:      number
  colors:     Color[]
  accordions: AccordionItem[]
  /**
   * Ölçü + sepet formu slotu.
   * Geçilirse statik placeholder ölçü bölümünün ve sepete ekle butonunun
   * yerine render edilir — gerçek MeasurementForm bileşeni buraya enjekte edilir.
   * Geçilmezse orijinal statik placeholder gösterilir (tasarım aşaması).
   */
  measurementSection?: React.ReactNode
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Accordion ──────────────────────────────────────────────────────────────
   Uses max-height + opacity CSS transition — no JS animation loop.
   +/- are Unicode math minus (U+2212) and plus for optical balance.
   ─────────────────────────────────────────────────────────────────────────── */
function Accordion({ title, content }: AccordionItem) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-[#F3F4F6]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-[15px] text-left group"
      >
        <span className="text-[11px] tracking-[0.18em] uppercase font-medium text-black">
          {title}
        </span>
        {/* +/- — elegant, no icon dependency */}
        <span
          aria-hidden="true"
          className={[
            'ml-4 shrink-0 text-[18px] font-light leading-none',
            'text-black group-hover:text-[#B89947]',
            'transition-colors duration-200',
          ].join(' ')}
        >
          {open ? '−' : '+'}
        </span>
      </button>

      <div
        className={[
          'overflow-hidden',
          'transition-[max-height,opacity] duration-300 ease-out',
          open ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <p className="text-[13px] text-[#6B7280] leading-[1.85] tracking-[0.02em] pb-5 pr-4">
          {content}
        </p>
      </div>
    </div>
  )
}

/* ── Color swatches ─────────────────────────────────────────────────────────
   Circular toggles: selected state = gold ring with offset.
   Selected color name appears right-aligned on the same row as the label.
   ─────────────────────────────────────────────────────────────────────────── */
function ColorSwatches({ colors }: { colors: Color[] }) {
  const [selectedId, setSelectedId] = useState(colors[0]?.id ?? '')
  const selectedName = colors.find((c) => c.id === selectedId)?.name ?? ''

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-[11px] tracking-[0.15em] uppercase font-medium text-black">
          Renk
        </p>
        <p
          className="text-[12px] tracking-[0.04em] text-[#9CA3AF] transition-[opacity] duration-150"
          aria-live="polite"
        >
          {selectedName}
        </p>
      </div>

      {/* Swatch row */}
      <div className="flex items-center gap-3">
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            onClick={() => setSelectedId(color.id)}
            aria-label={color.name}
            aria-pressed={selectedId === color.id}
            className="relative shrink-0"
          >
            <span
              className={[
                'block w-[22px] h-[22px] rounded-full',
                'border border-black/10',
                'transition-all duration-150',
                selectedId === color.id
                  ? 'ring-[1.5px] ring-[#B89947] ring-offset-[3px]'
                  : 'hover:ring-1 hover:ring-black/20 hover:ring-offset-[3px]',
              ].join(' ')}
              style={{ backgroundColor: color.hex }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Quantity selector ──────────────────────────────────────────────────────
   Fixed 120px width. Sits in a 2-col grid with the CTA button.
   Min qty = 1. Minus button disabled and visually fades at min.
   ─────────────────────────────────────────────────────────────────────────── */
function QuantitySelector() {
  const [qty, setQty] = useState(1)

  return (
    <div
      className="flex items-center border border-[#E5E7EB] h-[50px] w-[120px]"
      role="group"
      aria-label="Adet seçici"
    >
      <button
        type="button"
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        disabled={qty <= 1}
        aria-label="Adeti azalt"
        className={[
          'flex items-center justify-center w-10 h-full shrink-0',
          'text-black hover:text-[#B89947]',
          'disabled:opacity-[0.22] disabled:cursor-default',
          'transition-colors duration-200',
        ].join(' ')}
      >
        <Minus size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <span
        className="flex-1 text-center text-[14px] tracking-[0.08em] text-black select-none tabular-nums"
        aria-live="polite"
        aria-label={`Seçilen adet: ${qty}`}
      >
        {qty}
      </span>

      <button
        type="button"
        onClick={() => setQty((q) => q + 1)}
        aria-label="Adeti artır"
        className={[
          'flex items-center justify-center w-10 h-full shrink-0',
          'text-black hover:text-[#B89947]',
          'transition-colors duration-200',
        ].join(' ')}
      >
        <Plus size={13} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}

/* ── Measurement input ──────────────────────────────────────────────────────
   Design rules per spec:
   • Label above, input below
   • Placeholder "0"
   • "cm" suffix right-aligned inside the input — achieved via absolute span
     + right padding on the input so typed numbers never overlap the suffix
   • Border: 1px border-gray-200 (#E5E7EB)
   • Focus: ring-1 ring-[#B89947] + border-[#B89947]
   • Native spinner arrows removed (appearance-none)
   ─────────────────────────────────────────────────────────────────────────── */
function MeasurementInput({ label, id }: { label: string; id: string }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] tracking-[0.14em] uppercase font-medium text-black mb-2.5"
      >
        {label}
      </label>

      {/* Wrapper — needed to absolutely position the "cm" suffix */}
      <div className="relative">
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          placeholder="0"
          min="0"
          max="600"
          className={[
            /* Layout */
            'w-full px-4 pr-11 py-[14px]',
            /* Typography */
            'text-[15px] text-black tracking-[0.04em]',
            /* Colors */
            'bg-white',
            /* Border — 1px, gray-200 per spec */
            'border border-gray-200',
            /* Placeholder */
            'placeholder:text-[#DADADA]',
            /* Focus — gold ring + gold border per spec */
            'focus:outline-none',
            'focus:ring-1 focus:ring-[#B89947]',
            'focus:border-[#B89947]',
            /* Smooth transition */
            'transition-colors duration-200',
            /* Remove native number spinner arrows */
            '[appearance:textfield]',
            '[&::-webkit-inner-spin-button]:appearance-none',
            '[&::-webkit-outer-spin-button]:appearance-none',
          ].join(' ')}
        />

        {/* "cm" unit — right-aligned inside the input, non-interactive */}
        <span
          aria-hidden="true"
          className={[
            'absolute right-4 top-1/2 -translate-y-1/2',
            'text-[11px] font-normal tracking-[0.04em]',
            'text-[#ADADAD]',
            'select-none pointer-events-none leading-none',
          ].join(' ')}
        >
          cm
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT — PDPForm
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PDPForm({ price, colors, accordions, measurementSection }: PDPFormProps) {
  /* Price formatted in Turkish locale */
  const formattedPrice = new Intl.NumberFormat('tr-TR', {
    style:                'currency',
    currency:             'TRY',
    maximumFractionDigits: 0,
  }).format(price)

  return (
    <div className="flex flex-col gap-6">

      {/* ── 1. Price ──────────────────────────────────────────────────────── */}
      <div>
        <p
          className="text-[30px] lg:text-[32px] font-medium tracking-[0.01em] leading-none"
          style={{ color: 'var(--accent)' }}   /* STRICTLY #B89947 */
        >
          {formattedPrice}
        </p>
        <p className="mt-[9px] text-[11px] tracking-[0.06em] text-[#9CA3AF]">
          m² başına fiyat · KDV dahil
        </p>
      </div>

      {/* ── 2. Fabric description ─────────────────────────────────────────── */}
      <div className="border-t border-[#F3F4F6] pt-5">
        <p className="text-[13px] text-[#6B7280] leading-[1.85] tracking-[0.02em]">
          Hassas dokuma tekniğiyle üretilen keten-pamuk karışımı kumaş, ışığı tam
          olarak keser. Canlı renkleri ve doğal lif yapısıyla mekânlarınıza huzur katar.
        </p>
        <p className="mt-2.5 text-[11px] tracking-[0.06em] text-[#AAAAAA]">
          Linen %60&nbsp;·&nbsp;Pamuk %40
        </p>
      </div>

      {/* ── 3. Color swatches ─────────────────────────────────────────────── */}
      <ColorSwatches colors={colors} />

      {/* ── Thin divider ──────────────────────────────────────────────────── */}
      <div className="h-px bg-[#F3F4F6]" aria-hidden="true" />

      {/* ── 4 & 5. Ölçü + Sepete Ekle ────────────────────────────────────────
          measurementSection prop geçildiyse gerçek MeasurementForm render edilir.
          Geçilmezse tasarım aşamasına ait statik placeholder gösterilir.
          ─────────────────────────────────────────────────────────────────── */}
      {measurementSection ?? (
        <>
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
              <MeasurementInput label="En"  id="pdp-en"  />
              <MeasurementInput label="Boy" id="pdp-boy" />
            </div>
            <p className="mt-3 text-[10px] tracking-[0.04em] text-[#C8C8C8]">
              Min 60 × 100 cm · Maks 600 × 600 cm
            </p>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3">
            <QuantitySelector />
            <button
              type="button"
              className="h-[50px] bg-black text-white hover:bg-[#B89947] text-[11px] tracking-[0.38em] uppercase font-medium transition-colors duration-300"
            >
              Sepete Ekle
            </button>
          </div>
        </>
      )}

      {/* ── 6. Accordions ─────────────────────────────────────────────────── */}
      <div className="border-b border-[#F3F4F6]">
        {accordions.map((item) => (
          <Accordion key={item.title} {...item} />
        ))}
      </div>
    </div>
  )
}
