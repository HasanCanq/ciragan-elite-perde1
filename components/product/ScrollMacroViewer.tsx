'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface ScrollMacroViewerProps {
  image: string;      // Doku görseli (ana ürün görseli)
  productName: string;
  fabricType?: string; // "Fon Perde", "Stor Perde", vs.
}

// ── Bileşen ───────────────────────────────────────────────────────────────────

export default function ScrollMacroViewer({ image, productName, fabricType }: ScrollMacroViewerProps) {
  const sectionRef  = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0 → 1
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // IntersectionObserver — bölüm görünce animasyon başlar
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(section);

    // Scroll-driven parallax progress
    const handleScroll = () => {
      if (!section) return;
      const rect   = section.getBoundingClientRect();
      const vh     = window.innerHeight;
      // 0 = bölümün tepesi ekranın altında, 1 = bölümün altı ekranın tepesinde
      const raw    = 1 - (rect.bottom / (vh + rect.height));
      setProgress(Math.min(1, Math.max(0, raw)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // ilk değeri ayarla

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // scale: 1.0 → 1.25 scroll ilerledikçe
  const scale = 1 + progress * 0.25;

  // Overlay opacity: 0.45 → 0.72 (daha görünür hale gelir)
  const overlayOpacity = 0.45 + progress * 0.27;

  // Metin görünürlüğü: görünür olduğunda fade-in
  const textOpacity = isVisible ? 1 : 0;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden rounded-sm"
      style={{ aspectRatio: '16/9', minHeight: '240px' }}
      aria-label={`${productName} — Kumaş dokusu yakın plan`}
    >
      {/* Arka plan görsel — scroll parallax zoom */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `scale(${scale})`,
          transition: 'transform 0.05s linear',
        }}
      >
        <Image
          src={image}
          alt={`${productName} — Kumaş dokusu`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Karanlık overlay — derinleşir */}
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: overlayOpacity, transition: 'opacity 0.1s linear' }}
      />

      {/* Pervaz iç çerçeve */}
      <div
        className="absolute inset-0 pointer-events-none rounded-sm"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(162,145,127,0.45)' }}
      />

      {/* İçerik — fade-in */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{
          opacity:    textOpacity,
          transform:  isVisible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        {/* Eyebrow */}
        <p className="text-[#B89947]/80 text-[8px] tracking-[0.5em] uppercase mb-4">
          {fabricType ?? 'Kumaş Dokusu'}
        </p>

        {/* Başlık */}
        <h3 className="font-['Cinzel',_serif] text-white text-lg sm:text-2xl tracking-[0.08em] leading-snug mb-4 max-w-sm">
          {productName}
        </h3>

        {/* İnce altın çizgi */}
        <div className="w-12 h-px bg-[#B89947]/60 mb-4" />

        {/* Alt metin */}
        <p className="text-white/55 text-[10px] tracking-[0.28em] uppercase max-w-xs leading-relaxed">
          El dokuması iplik yapısı &middot; Premium kalite
        </p>
      </div>
    </section>
  );
}
