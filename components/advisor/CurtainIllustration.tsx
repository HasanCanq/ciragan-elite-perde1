/* ──────────────────────────────────────────────────────────────
   Curtain Illustrations — perde model tiplerini temsil eden
   soyut SVG çizimleri. Her biri modelin karakteristik görünümünü
   taşıyan minimal line-art. Kart içinde üst bölümde gösterilir.
   ────────────────────────────────────────────────────────────── */

interface IllustrationProps {
  className?: string;
  /** Kart vurgulandığında (hover) altın rengi kullanır */
  accent?: boolean;
}

/* ── Kruvaze: pileli dalgalı düşüş ─────────────────────────── */
export function KruvazeIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 100" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" className={className} aria-hidden="true">
      {/* Korniş */}
      <line x1="4" y1="6" x2="76" y2="6" strokeWidth="2" />
      {/* Sol kanat — dalgalı düşüş */}
      <path d="M14 6 C10 28 18 28 12 50 C8 68 14 80 13 96" />
      {/* Sağ kanat */}
      <path d="M66 6 C70 28 62 28 68 50 C72 68 66 80 67 96" />
      {/* Orta pile yığılması */}
      <path d="M32 6 C30 20 34 40 32 60 C31 74 33 86 32 96" strokeOpacity="0.5" />
      <path d="M48 6 C46 20 50 40 48 60 C47 74 49 86 48 96" strokeOpacity="0.5" />
      {/* Bağ ipi — sol */}
      <path d="M8 46 Q20 42 26 48 Q20 54 8 50" strokeWidth="0.9" />
      {/* Bağ ipi — sağ */}
      <path d="M72 46 Q60 42 54 48 Q60 54 72 50" strokeWidth="0.9" />
    </svg>
  );
}

/* ── Stor: rulo düz düşüş ───────────────────────────────────── */
export function StorIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 100" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" className={className} aria-hidden="true">
      {/* Rulo silindiri */}
      <ellipse cx="40" cy="10" rx="34" ry="6" />
      {/* Düz kumaş sol kenar */}
      <line x1="6"  y1="10" x2="6"  y2="88" />
      {/* Düz kumaş sağ kenar */}
      <line x1="74" y1="10" x2="74" y2="88" />
      {/* Alt kenar */}
      <line x1="6" y1="88" x2="74" y2="88" />
      {/* Çekme zinciri */}
      <line x1="40" y1="88" x2="40" y2="98" />
      <circle cx="40" cy="99" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Blackout: yoğun dolgu, ışık geçirmez blok ─────────────── */
export function BlackoutIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 100" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" className={className} aria-hidden="true">
      {/* Üst ray */}
      <rect x="4" y="4" width="72" height="8" />
      {/* Kumaş paneli */}
      <rect x="4" y="12" width="72" height="80" />
      {/* Karartma yoğunluğunu gösteren dolgu çizgileri */}
      <line x1="4" y1="26" x2="76" y2="26" strokeOpacity="0.25" />
      <line x1="4" y1="40" x2="76" y2="40" strokeOpacity="0.25" />
      <line x1="4" y1="54" x2="76" y2="54" strokeOpacity="0.25" />
      <line x1="4" y1="68" x2="76" y2="68" strokeOpacity="0.25" />
      <line x1="4" y1="82" x2="76" y2="82" strokeOpacity="0.25" />
      {/* "Işık yok" — ince çapraz çizgi */}
      <line x1="10" y1="18" x2="22" y2="30" strokeOpacity="0.15" strokeWidth="0.8" />
    </svg>
  );
}

/* ── Zebra: şerit sistemi, yarı saydam bantlar ──────────────── */
export function ZebraIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 100" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" className={className} aria-hidden="true">
      {/* Rulo */}
      <ellipse cx="40" cy="8" rx="34" ry="5" />
      {/* Kenar çizgileri */}
      <line x1="6"  y1="8" x2="6"  y2="90" />
      <line x1="74" y1="8" x2="74" y2="90" />
      {/* Opak şeritler */}
      <rect x="6" y="13" width="68" height="10" />
      <rect x="6" y="33" width="68" height="10" />
      <rect x="6" y="53" width="68" height="10" />
      <rect x="6" y="73" width="68" height="10" />
      {/* Saydam şeritler — sadece alt çizgi */}
      <line x1="6" y1="33" x2="74" y2="33" strokeOpacity="0.4" />
      <line x1="6" y1="53" x2="74" y2="53" strokeOpacity="0.4" />
      <line x1="6" y1="73" x2="74" y2="73" strokeOpacity="0.4" />
      {/* Alt kenar */}
      <line x1="6" y1="90" x2="74" y2="90" />
      {/* Zincir */}
      <line x1="68" y1="13" x2="68" y2="90" strokeDasharray="3 4" strokeOpacity="0.5" />
    </svg>
  );
}

/* ── Plicell: bal peteği hücreleri ──────────────────────────── */
export function PlicellIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 100" fill="none" stroke="currentColor"
      strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      {/* Üst ray */}
      <rect x="4" y="4" width="72" height="6" />
      {/* Altıgen hücreler — 3 satır, 3 sütun */}
      {/* Satır 1 */}
      <path d="M14 16 L22 11 L30 16 L30 26 L22 31 L14 26 Z" />
      <path d="M30 16 L38 11 L46 16 L46 26 L38 31 L30 26 Z" />
      <path d="M46 16 L54 11 L62 16 L62 26 L54 31 L46 26 Z" />
      {/* Satır 2 — yarım aşağı kaydırılmış */}
      <path d="M6  36 L14 31 L22 36 L22 46 L14 51 L6  46 Z" />
      <path d="M22 36 L30 31 L38 36 L38 46 L30 51 L22 46 Z" />
      <path d="M38 36 L46 31 L54 36 L54 46 L46 51 L38 46 Z" />
      <path d="M54 36 L62 31 L70 36 L70 46 L62 51 L54 46 Z" />
      {/* Satır 3 */}
      <path d="M14 56 L22 51 L30 56 L30 66 L22 71 L14 66 Z" />
      <path d="M30 56 L38 51 L46 56 L46 66 L38 71 L30 66 Z" />
      <path d="M46 56 L54 51 L62 56 L62 66 L54 71 L46 66 Z" />
      {/* Satır 4 — kısmi */}
      <path d="M6  76 L14 71 L22 76 L22 86 L14 91 L6  86 Z" />
      <path d="M22 76 L30 71 L38 76 L38 86 L30 91 L22 86 Z" />
      <path d="M38 76 L46 71 L54 76 L54 86 L46 91 L38 86 Z" />
      <path d="M54 76 L62 71 L70 76 L70 86 L62 91 L54 86 Z" />
    </svg>
  );
}

/* ── Jaluzi: eğik yatay kanatlar ───────────────────────────── */
export function JaluziIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 100" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" className={className} aria-hidden="true">
      {/* Üst ray */}
      <rect x="4" y="4" width="72" height="7" />
      {/* Kanatlar — hafif açılı perspektif */}
      <path d="M6 18  L74 15" />
      <path d="M6 27  L74 24" />
      <path d="M6 36  L74 33" />
      <path d="M6 45  L74 42" />
      <path d="M6 54  L74 51" />
      <path d="M6 63  L74 60" />
      <path d="M6 72  L74 69" />
      <path d="M6 81  L74 78" />
      {/* İp kanalları */}
      <line x1="20" y1="11" x2="20" y2="90" strokeDasharray="2 5" strokeOpacity="0.4" />
      <line x1="60" y1="11" x2="60" y2="90" strokeDasharray="2 5" strokeOpacity="0.4" />
      {/* Alt ipi */}
      <line x1="6" y1="88" x2="74" y2="88" strokeOpacity="0.4" />
    </svg>
  );
}

// ─── Slug bazlı dispatch ─────────────────────────────────────

const ILLUSTRATION_MAP: Record<string, (props: IllustrationProps) => React.ReactElement> = {
  kruvaze:       KruvazeIllustration,
  stor:          StorIllustration,
  blackout:      BlackoutIllustration,
  'blackout-stor': StorIllustration,
  zebra:         ZebraIllustration,
  plicell:       PlicellIllustration,
  jaluzi:        JaluziIllustration,
  'ahsap-jaluzi': JaluziIllustration,
};

/** Perde model slug'ına göre doğru SVG illüstrasyonu döner. */
export function CurtainIllustration({
  slug,
  className,
  accent,
}: {
  slug: string;
  className?: string;
  accent?: boolean;
}) {
  const Illustration = ILLUSTRATION_MAP[slug];
  if (Illustration) return <Illustration className={className} accent={accent} />;

  // Fallback: generic stor silueti
  return <StorIllustration className={className} />;
}

import type React from 'react';
