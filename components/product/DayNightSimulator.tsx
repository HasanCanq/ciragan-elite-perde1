'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Sun, Moon } from 'lucide-react';

interface DayNightSimulatorProps {
  images: string[];
  productName: string;
}

// ── CSS filter presets ────────────────────────────────────────────────────────

const DAY_FILTER =
  'brightness(1.08) contrast(1.03) saturate(1.05) sepia(0.04)';

const NIGHT_FILTER =
  'brightness(0.38) contrast(1.12) saturate(0.55) sepia(0.25) hue-rotate(10deg)';

// ── Bileşen ───────────────────────────────────────────────────────────────────

export default function DayNightSimulator({ images, productName }: DayNightSimulatorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isNight,       setIsNight]       = useState(false);

  const mainImage = images[selectedIndex] || null;

  return (
    <div className="select-none">

      {/* Ana görsel */}
      <div className="relative aspect-[4/5] bg-[#e8e8e4] rounded-sm overflow-hidden group shadow-pervaz">

        {mainImage ? (
          <Image
            src={mainImage}
            alt={productName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-[filter,transform] duration-700 ease-in-out group-hover:scale-[1.03]"
            style={{ filter: isNight ? NIGHT_FILTER : DAY_FILTER }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#e8e8e4]">
            <span className="text-[#9A9A9A] text-[10px] tracking-[0.3em] uppercase">Görsel Yok</span>
          </div>
        )}

        {/* Gece amber içsel parıltısı */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-700"
          style={{
            background: isNight
              ? 'radial-gradient(ellipse 70% 60% at 50% 75%, rgba(255,170,60,0.18) 0%, transparent 70%)'
              : 'transparent',
            opacity: isNight ? 1 : 0,
          }}
        />

        {/* Pervaz iç çerçeve */}
        <div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(162,145,127,0.40)' }}
        />

        {/* Gündüz / Gece toggle — sağ üst köşe */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={() => setIsNight((v) => !v)}
            aria-label={isNight ? 'Gündüz moduna geç' : 'Gece moduna geç'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px]
              tracking-[0.3em] uppercase font-medium backdrop-blur-sm
              border transition-all duration-400 shadow-sm
              ${isNight
                ? 'bg-[#1a1020]/70 border-amber-400/40 text-amber-300'
                : 'bg-white/75 border-[#B89947]/30 text-[#B89947]'
              }`}
          >
            {isNight ? (
              <><Moon className="w-3 h-3" /> Gece</>
            ) : (
              <><Sun className="w-3 h-3" /> Gündüz</>
            )}
          </button>
        </div>

        {/* Mod açıklaması — sol alt */}
        <div
          className={`absolute bottom-3 left-3 z-10 transition-opacity duration-500
            ${isNight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <p className="text-[8px] tracking-[0.3em] uppercase text-amber-200/70 backdrop-blur-sm">
            Gece ışık geçirgenliği simülasyonu
          </p>
        </div>
      </div>

      {/* Mod bilgi çubuğu */}
      <div
        className={`mt-2 px-3 py-2 rounded-sm text-[9px] tracking-[0.25em] uppercase
          flex items-center gap-2 transition-all duration-500
          ${isNight
            ? 'bg-[#111111] text-amber-400/80 border border-amber-900/40'
            : 'bg-[#FDFDFA] text-[#B89947]/70 border border-[#B89947]/15'
          }`}
      >
        {isNight ? (
          <>
            <Moon className="w-3 h-3 flex-shrink-0" />
            Gece simülasyonu — perdenin ışık geçirgenliğini görün
          </>
        ) : (
          <>
            <Sun className="w-3 h-3 flex-shrink-0" />
            Gündüz simülasyonu — doğal ışık altında görünüm
          </>
        )}
      </div>

      {/* Thumbnail'lar */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`relative aspect-square rounded-sm overflow-hidden transition-all duration-300
                ${index === selectedIndex
                  ? 'ring-2 ring-[#B89947] ring-offset-1'
                  : 'opacity-60 hover:opacity-90 hover:ring-1 hover:ring-[#B89947]/40'
                }`}
            >
              <Image
                src={img}
                alt={`${productName} - ${index + 1}`}
                fill
                className="object-cover"
                style={{ filter: isNight ? NIGHT_FILTER : DAY_FILTER }}
                sizes="100px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
