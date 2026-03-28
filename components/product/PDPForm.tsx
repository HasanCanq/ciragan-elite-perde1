'use client'

import { useState } from 'react'

/* ──────────────────────────────────────────────────────────────
   PDPForm — Sağ kolon ürün konfiguratör bileşeni
   ──────────────────────────────────────────────────────────────
   Temiz mimari:
   • Ölü kod kaldırıldı (MeasurementInput, QuantitySelector placeholder'ları)
   • Kumaş özellikleri → bağımsız SVG ikon pilleri
   • measurementSection slotu gerçek MeasurementForm'u alır
   • Link, Plus, Minus bağımlılıkları kaldırıldı
   ────────────────────────────────────────────────────────────── */

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
  colors:             Color[]
  accordions:         AccordionItem[]
  measurementSection?: React.ReactNode
}

/* ══════════════════════════════════════════════════════════════════════════
   KUMAŞ ÖZELLİK İKONLARI — sıfır bağımlılık, saf inline SVG
   ══════════════════════════════════════════════════════════════════════════ */

const FabricIcon = () => (
  <svg width="13" height="12" viewBox="0 0 13 12" fill="none" aria-hidden="true">
    <path d="M1 2.5 Q3.25 0.5 6.5 2.5 Q9.75 4.5 12 2.5"  stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <path d="M1 6   Q3.25 4   6.5 6   Q9.75 8   12 6"     stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <path d="M1 9.5 Q3.25 7.5 6.5 9.5 Q9.75 11.5 12 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
)

const LightBlockIcon = () => (
  <svg width="11" height="14" viewBox="0 0 11 14" fill="none" aria-hidden="true">
    <rect x="0.5" y="0.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1"/>
    <line x1="2.75" y1="3.5" x2="2.75" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <line x1="5.5"  y1="2.5" x2="5.5"  y2="11.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <line x1="8.25" y1="3.5" x2="8.25" y2="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
)

const WashIcon = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
    <path
      d="M6 1 C6 1 11 7.5 11 10 A5 5 0 0 1 1 10 C1 7.5 6 1 6 1Z"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
)

const EcoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path
      d="M2.5 11.5 Q2.5 3.5 11 1.5 Q11 9.5 2.5 11.5Z"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    <line x1="2.5" y1="11.5" x2="7" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
)

type FabricProp = { icon: React.ReactNode; label: string }

/* Kumaş özellikleri — ileride DB'den props olarak alınabilir */
const FABRIC_PROPS: FabricProp[] = [
  { icon: <FabricIcon />,    label: 'Linen %60 · Pamuk %40' },
  { icon: <LightBlockIcon />, label: 'Işık Filtreleyici'     },
  { icon: <WashIcon />,      label: '30°C Yıkanabilir'       },
  { icon: <EcoIcon />,       label: 'OEKO-TEX Sertifikalı'  },
]

/* ── Kumaş özellikleri (ikon pill'leri) ─────────────────────────────────── */
function FabricProperties() {
  return (
    <div className="border-t border-[#F3F4F6] pt-5">
      <div className="flex flex-wrap gap-2">
        {FABRIC_PROPS.map(({ icon, label }) => (
          <span
            key={label}
            className={[
              'inline-flex items-center gap-[7px]',
              'px-3 py-[7px]',
              'border border-[#EBEBEB]',
              'text-[10px] tracking-[0.05em] text-[#6B7280]',
            ].join(' ')}
          >
            <span className="text-[#B89947] flex-shrink-0">{icon}</span>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Akordiyon ──────────────────────────────────────────────────────────────
   max-height + opacity CSS geçişi — JS animasyon döngüsü yok.
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

/* ── Renk seçici (swatch'lar) ───────────────────────────────────────────────
   Yuvarlak doku damlaları: seçili = altın halka + offset.
   Seçili renk adı satır sağında aria-live ile güncellenir.
   ─────────────────────────────────────────────────────────────────────────── */
function ColorSwatches({ colors }: { colors: Color[] }) {
  const [selectedId, setSelectedId] = useState(colors[0]?.id ?? '')
  const selectedName = colors.find((c) => c.id === selectedId)?.name ?? ''

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-[11px] tracking-[0.15em] uppercase font-medium text-black">
          Renk
        </p>
        <p
          className="text-[12px] tracking-[0.04em] text-[#9CA3AF] transition-opacity duration-150"
          aria-live="polite"
        >
          {selectedName}
        </p>
      </div>

      <div className="flex items-center gap-3" role="group" aria-label="Renk seçimi">
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
                'shadow-[inset_0_1px_3px_rgba(0,0,0,0.12)]',
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

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT — PDPForm
   ══════════════════════════════════════════════════════════════════════════ */
export default function PDPForm({
  colors,
  accordions,
  measurementSection,
}: PDPFormProps) {
  return (
    <div className="flex flex-col gap-6">

      {/* ── 1. Kumaş özellikleri (ikon pill'leri) ─────────────────── */}
      <FabricProperties />

      {/* ── 3. Renk seçici (swatch'lar) ───────────────────────────── */}
      {colors.length > 0 && <ColorSwatches colors={colors} />}

      {/* ── İnce bölücü ───────────────────────────────────────────── */}
      <div className="h-px bg-[#F3F4F6]" aria-hidden="true" />

      {/* ── 4. Ölçü + Sepete Ekle (MeasurementForm slotu) ──────────── */}
      {measurementSection}

      {/* ── 5. Akordeonlar ────────────────────────────────────────── */}
      <div className="border-b border-[#F3F4F6]">
        {accordions.map((item) => (
          <Accordion key={item.title} {...item} />
        ))}
      </div>
    </div>
  )
}
