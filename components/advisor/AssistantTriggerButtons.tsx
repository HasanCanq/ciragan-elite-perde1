'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAssistantStore } from '@/store/assistantStore';

/* ──────────────────────────────────────────────────────────────
   AssistantTriggerButtons
   ──────────────────────────────────────────────────────────────
   Hero bölümüne yerleştirilen iki eylem butonu:
     • "Koleksiyonu İncele"  → tüm ürün sayfasına Link
     • "Perdemi Seç"         → /asistan sayfasına yönlendirir
                               ve modal state'i açar
   ────────────────────────────────────────────────────────────── */
export default function AssistantTriggerButtons() {
  const router = useRouter();
  const openAssistantModal = useAssistantStore((s) => s.openAssistantModal);

  function handleAdvisorClick() {
    // 1. Modal state'i aç (eğer parent bir <dialog> ile sarıyorsa kullanır)
    openAssistantModal();
    // 2. Asistan sayfasına yönlendir — URL-driven flow başlar
    router.push('/asistan');
  }

  return (
    <div className="flex flex-col sm:flex-row items-start gap-3">
      {/* Birincil: Koleksiyon — normal shop */}
      <Link href="/kategori/tum-urunler" className="h-btn">
        Koleksiyonu İncele
      </Link>

      {/* İkincil: Asistan — perde seçim akışı */}
      <button
        type="button"
        onClick={handleAdvisorClick}
        className="h-btn-outline group inline-flex items-center gap-2"
        aria-label="Perde seçim asistanını aç"
      >
        {/* Basit "sihirbaz değneği" ikonu */}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          className="w-[14px] h-[14px] shrink-0 transition-transform duration-300 group-hover:rotate-12"
        >
          <path d="M2 14 L8 2" strokeLinecap="round" />
          <path d="M8 2 L14 8" strokeLinecap="round" />
          <circle cx="3.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="10"  cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="13"  cy="4"  r="0.7" fill="currentColor" stroke="none" />
        </svg>
        Perdemi Seç
      </button>
    </div>
  );
}
