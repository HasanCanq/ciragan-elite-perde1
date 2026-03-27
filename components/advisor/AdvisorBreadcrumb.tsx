'use client';

import { useRouter } from 'next/navigation';

/* ──────────────────────────────────────────────────────────────
   AdvisorBreadcrumb — Step 2'de gösterilen navigasyon çubuğu.
   ──────────────────────────────────────────────────────────────
   • "← Odalar" geri tuşu → /asistan'a döner
   • "Odalar / [Oda Adı]" breadcrumb trail gösterir
   • Server'dan prop olarak alır; useSearchParams'a gerek yok
   ────────────────────────────────────────────────────────────── */

interface AdvisorBreadcrumbProps {
  roomName: string;
  roomSlug: string;
}

export default function AdvisorBreadcrumb({ roomName, roomSlug: _roomSlug }: AdvisorBreadcrumbProps) {
  const router = useRouter();

  return (
    <nav
      aria-label="Asistan adımları"
      className="flex items-center gap-3 mb-10"
    >
      {/* Geri butonu */}
      <button
        type="button"
        onClick={() => router.push('/asistan', { scroll: false })}
        className={[
          'inline-flex items-center gap-2',
          'text-[9px] tracking-[0.36em] uppercase font-medium',
          'text-[#9CA3AF] hover:text-black',
          'transition-colors duration-200',
          'group',
        ].join(' ')}
        aria-label="Oda seçimine geri dön"
      >
        <svg
          viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.4"
          strokeLinecap="round" aria-hidden="true"
          className="w-3.5 h-3.5 translate-x-0 group-hover:-translate-x-1 transition-transform duration-200"
        >
          <path d="M13 5 H1 M5 1 L1 5 L5 9" />
        </svg>
        Odalar
      </button>

      {/* Ayırıcı */}
      <span aria-hidden="true" className="text-[#D1D5DB] text-[10px]">/</span>

      {/* Mevcut adım */}
      <span
        className="text-[9px] tracking-[0.36em] uppercase font-medium text-black"
        aria-current="step"
      >
        {roomName}
      </span>
    </nav>
  );
}
