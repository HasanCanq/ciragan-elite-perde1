/* ──────────────────────────────────────────────────────────────
   Room Icons — minimal line-art SVGs, current-color stroked.
   Tasarım dili: mimari, keskin, gölgesiz — Hanedan tasarım sistemiyle uyumlu.
   ────────────────────────────────────────────────────────────── */

interface IconProps {
  className?: string;
}

export function SalonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 38" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Koltuk sırtlığı */}
      <rect x="5" y="11" width="38" height="15" />
      {/* Orta yastık çizgisi */}
      <line x1="24" y1="11" x2="24" y2="26" />
      {/* Sol kol yastığı */}
      <rect x="3" y="17" width="6" height="9" />
      {/* Sağ kol yastığı */}
      <rect x="39" y="17" width="6" height="9" />
      {/* Ayaklar */}
      <line x1="10" y1="26" x2="9"  y2="33" />
      <line x1="38" y1="26" x2="39" y2="33" />
    </svg>
  );
}

export function BedroomIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Yatak başlığı */}
      <rect x="6" y="9" width="36" height="7" />
      {/* Yatak gövdesi */}
      <rect x="6" y="16" width="36" height="18" />
      {/* Sol yastık */}
      <rect x="9"  y="19" width="11" height="7" rx="1" />
      {/* Sağ yastık */}
      <rect x="28" y="19" width="11" height="7" rx="1" />
      {/* Ayaklar */}
      <line x1="11" y1="34" x2="11" y2="38" />
      <line x1="37" y1="34" x2="37" y2="38" />
    </svg>
  );
}

export function KitchenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 44" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Pencere çerçevesi */}
      <rect x="7" y="8" width="34" height="26" />
      {/* Yatay çapraz */}
      <line x1="7" y1="21" x2="41" y2="21" />
      {/* Dikey çapraz */}
      <line x1="24" y1="8" x2="24" y2="34" />
      {/* Pencere tablası */}
      <line x1="4" y1="34" x2="44" y2="34" />
      {/* Saksı gövdesi — alt */}
      <path d="M19 34 L16 42 L32 42 L29 34" />
      {/* Çiçek sapı */}
      <line x1="24" y1="34" x2="24" y2="30" />
      <circle cx="24" cy="29" r="2" />
    </svg>
  );
}

export function KidsRoomIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* 5 köşeli yıldız */}
      <polygon points="24,5 28.9,18.2 43,18.2 31.6,26.5 35.6,40 24,31.8 12.4,40 16.4,26.5 5,18.2 19.1,18.2" />
    </svg>
  );
}

export function BathroomIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Küvet gövdesi */}
      <path d="M7 20 C7 20 7 36 24 36 C41 36 41 20 41 20" />
      {/* Küvet kenarı */}
      <line x1="5" y1="20" x2="43" y2="20" />
      {/* Batarya kolu */}
      <line x1="15" y1="20" x2="15" y2="11" />
      <rect x="11" y="8" width="8" height="3" />
      {/* Gider */}
      <circle cx="24" cy="32" r="2" />
      <line x1="24" y1="34" x2="24" y2="38" />
    </svg>
  );
}

export function OfficeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 44" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {/* Monitör çerçevesi */}
      <rect x="5" y="7" width="38" height="24" />
      {/* Ekran içi */}
      <rect x="8" y="10" width="32" height="18" />
      {/* Sehpa ayağı */}
      <line x1="24" y1="31" x2="24" y2="37" />
      {/* Sehpa tabanı */}
      <line x1="16" y1="37" x2="32" y2="37" />
    </svg>
  );
}

// ─── Slug bazlı dispatch ─────────────────────────────────────

const ICON_MAP: Record<string, (props: IconProps) => React.ReactElement> = {
  salon:       SalonIcon,
  'yatak-odasi': BedroomIcon,
  mutfak:      KitchenIcon,
  'cocuk-odasi': KidsRoomIcon,
  banyo:       BathroomIcon,
  ofis:        OfficeIcon,
};

/** Oda slug'ına karşılık gelen ikonu döner. Bilinmeyen slug için genel ev ikonu gösterir. */
export function RoomIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICON_MAP[slug];
  if (Icon) return <Icon className={className} />;

  // Fallback: genel pencere ikonu
  return (
    <svg viewBox="0 0 48 44" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" className={className} aria-hidden="true">
      <rect x="7" y="8" width="34" height="26" />
      <line x1="7"  y1="21" x2="41" y2="21" />
      <line x1="24" y1="8"  x2="24" y2="34" />
    </svg>
  );
}

import type React from 'react';
