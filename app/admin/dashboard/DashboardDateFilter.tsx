'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const PRESETS = [
  { label: 'Son 7 Gün',  days: 7  },
  { label: 'Son 30 Gün', days: 30 },
  { label: 'Son 90 Gün', days: 90 },
] as const;

function DateFilterButtons() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentDays = Number(searchParams.get('days')) || 30;

  return (
    <div className="flex gap-2">
      {PRESETS.map(({ label, days }) => (
        <button
          key={days}
          onClick={() => router.push(`?days=${days}`)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            currentDays === days
              ? 'bg-[#B89947] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#B89947] hover:text-[#B89947]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// useSearchParams() Client Component için <Suspense> zorunlu (ISR ile uyum)
export function DashboardDateFilter() {
  return (
    <Suspense
      fallback={
        <div className="flex gap-2">
          {PRESETS.map(({ days }) => (
            <div key={days} className="h-8 w-24 bg-gray-100 animate-pulse" />
          ))}
        </div>
      }
    >
      <DateFilterButtons />
    </Suspense>
  );
}
