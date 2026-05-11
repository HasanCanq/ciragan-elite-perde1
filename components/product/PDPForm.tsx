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
  colors:              Color[]
  accordions:          AccordionItem[]
  fabricProperties:    string[]
  measurementSection?: React.ReactNode
}

/* ── Kumaş özellikleri (metin pill'leri — DB'den dinamik) ───────────────── */
function FabricProperties({ items }: { items: string[] }) {
  if (items.length === 0) return null

  return (
    <div className="border-t border-[#F3F4F6] pt-5">
      <div className="flex flex-wrap gap-2">
        {items.map((label) => (
          <span
            key={label}
            className={[
              'inline-flex items-center',
              'px-3 py-[7px]',
              'border border-[#EBEBEB]',
              'text-[10px] tracking-[0.05em] text-[#6B7280]',
            ].join(' ')}
          >
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
  fabricProperties,
  measurementSection,
}: PDPFormProps) {
  return (
    <div className="flex flex-col gap-6">

      {/* ── 1. Kumaş özellikleri (metin pill'leri) ────────────────── */}
      <FabricProperties items={fabricProperties} />

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
