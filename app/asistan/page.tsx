import type { Metadata } from 'next';
import { Suspense } from 'react';
import RoomStep  from '@/components/advisor/RoomStep';
import ModelStep from '@/components/advisor/ModelStep';

/* ──────────────────────────────────────────────────────────────
   /asistan — Perde Seçim Asistanı Ana Sayfası
   ──────────────────────────────────────────────────────────────
   URL yapısı:
     /asistan              → Step 1: Oda seç
     /asistan?oda=mutfak   → Step 2: Model seç

   Server Component: searchParams'ı doğrudan okur (Next.js 14).
   İç async bileşenler Suspense ile streaming SSR'a açıktır.
   ────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Perde Seçim Asistanı | Hanedan Perde',
  description:
    'Odanızı ve perde modelinizi seçin; odanıza özel ürünleri birkaç adımda keşfedin.',
  robots: { index: false }, // Asistan sayfaları indekslenmemeli
};

interface Props {
  searchParams: { oda?: string };
}

export default function AssistantPage({ searchParams }: Props) {
  const roomSlug = searchParams.oda?.trim() || null;

  return (
    <main className="min-h-[calc(100vh-64px)]">
      {/* ── Üst alan: markalama ────────────────────────────────── */}
      <div className="border-b border-[#F3F4F6]">
        <div className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-5 flex items-center justify-between">
          <p className="text-[9px] tracking-[0.45em] uppercase text-[#9CA3AF]">
            Perde Seçim Asistanı
          </p>
          {/* Adım göstergesi */}
          <StepIndicator currentStep={roomSlug ? 2 : 1} totalSteps={2} />
        </div>
      </div>

      {/* ── Ana içerik ────────────────────────────────────────── */}
      <section
        aria-label="Perde seçim adımları"
        className="max-w-8xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-14 lg:py-20"
      >
        {roomSlug ? (
          <Suspense fallback={<ModelStepSkeleton />}>
            <ModelStep roomSlug={roomSlug} />
          </Suspense>
        ) : (
          <Suspense fallback={<RoomStepSkeleton />}>
            <RoomStep />
          </Suspense>
        )}
      </section>
    </main>
  );
}

/* ── Adım göstergesi ────────────────────────────────────────── */
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div
      aria-label={`${totalSteps} adımdan ${currentStep}. adım`}
      className="flex items-center gap-1.5"
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isDone   = step < currentStep;
        return (
          <span
            key={step}
            aria-current={isActive ? 'step' : undefined}
            className={[
              'block h-px transition-all duration-400',
              isActive ? 'w-8 bg-[#B89947]' : isDone ? 'w-4 bg-black' : 'w-4 bg-[#E5E5E5]',
            ].join(' ')}
          />
        );
      })}
      <span className="text-[9px] tracking-[0.3em] text-[#9CA3AF] ml-1">
        {currentStep}/{totalSteps}
      </span>
    </div>
  );
}

/* ── Streaming yükleme iskeletleri ──────────────────────────── */

function RoomStepSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {/* Başlık iskeleti */}
      <div className="mb-10 space-y-4">
        <div className="h-2.5 w-24 bg-[#F3F4F6]" />
        <div className="h-10 w-72 bg-[#F3F4F6]" />
        <div className="h-10 w-52 bg-[#F3F4F6]" />
        <div className="h-px w-10 bg-[#E5E5E5] mt-2" />
      </div>
      {/* Kart grid iskeleti */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-[1px]">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[180px] bg-[#F3F4F6]" />
        ))}
      </div>
    </div>
  );
}

function ModelStepSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {/* Breadcrumb iskeleti */}
      <div className="h-2.5 w-36 bg-[#F3F4F6] mb-10" />
      {/* Başlık iskeleti */}
      <div className="mb-10 space-y-4">
        <div className="h-2.5 w-28 bg-[#F3F4F6]" />
        <div className="h-10 w-64 bg-[#F3F4F6]" />
        <div className="h-10 w-44 bg-[#F3F4F6]" />
        <div className="h-px w-10 bg-[#E5E5E5] mt-2" />
      </div>
      {/* Kart grid iskeleti */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[1px]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-[360px] bg-[#F3F4F6]" />
        ))}
      </div>
    </div>
  );
}
