'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { MeasurementGuide } from '@/types';

interface MeasurementGuideModalProps {
  guide:   MeasurementGuide;
  onClose: () => void;
}

export default function MeasurementGuideModal({ guide, onClose }: MeasurementGuideModalProps) {
  // ESC tuşu ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Modal açıkken arka plan scroll'unu kilitle
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={guide.title}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 bg-white w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Başlık */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[11px] tracking-[0.18em] uppercase font-medium text-black">
            {guide.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-1.5 text-[#9CA3AF] hover:text-black transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Görsel */}
        <div className="flex-1 overflow-y-auto">
          {guide.image_url ? (
            <div className="relative w-full aspect-[4/3]">
              <Image
                src={guide.image_url}
                alt={guide.title}
                fill
                className="object-contain p-4"
                sizes="(max-width: 640px) 100vw, 512px"
                priority
              />
            </div>
          ) : (
            <div className="flex items-center justify-center aspect-[4/3] bg-[#FAFAFA]">
              <p className="text-[12px] tracking-[0.04em] text-[#9CA3AF]">
                Kılavuz görseli henüz yüklenmedi.
              </p>
            </div>
          )}
        </div>

        {/* Alt bilgi */}
        <div className="px-6 py-3 border-t border-[#F3F4F6]">
          <p className="text-[10px] tracking-[0.04em] text-[#9CA3AF]">
            Ölçülerinizi net değerlere yuvarlayın · Montaj payı bırakmayın
          </p>
        </div>
      </div>
    </div>
  );
}
