'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import type { MeasurementGuide } from '@/types';

interface Props {
  guides: MeasurementGuide[];
  labels: Record<string, string>;
}

export default function MeasurementAccordion({ guides, labels }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(guides[0]?.guide_key ?? null);

  return (
    <div className="divide-y divide-[#F3F4F6] border border-[#F3F4F6]">
      {guides.map((guide) => {
        const isOpen = openKey === guide.guide_key;
        const label  = labels[guide.guide_key] ?? guide.guide_key;

        return (
          <div key={guide.guide_key}>
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : guide.guide_key)}
              className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-[#FAFAFA] transition-colors"
            >
              <span className="font-serif text-lg font-semibold text-black">{label}</span>
              <ChevronDown
                className={`w-5 h-5 text-[#B89947] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                strokeWidth={1.5}
              />
            </button>

            {isOpen && (
              <div className="px-6 pb-8 bg-[#FAFAFA]">
                {guide.image_url ? (
                  <div className="relative w-full aspect-[4/3] mt-2">
                    <Image
                      src={guide.image_url}
                      alt={`${label} ölçü kılavuzu`}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 672px"
                    />
                  </div>
                ) : (
                  <p className="py-8 text-center text-[#9CA3AF] text-sm">
                    Bu kategori için kılavuz görseli henüz yüklenmedi.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
