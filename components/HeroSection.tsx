"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const heroImages = [
  "https://httjlhbvqksbdutrqoju.supabase.co/storage/v1/object/public/hero/3.jpg",
  "https://httjlhbvqksbdutrqoju.supabase.co/storage/v1/object/public/hero/2.jpg",
  "https://httjlhbvqksbdutrqoju.supabase.co/storage/v1/object/public/hero/1.jpg",
];

export default function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Otomatik geçiş
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex]); // currentIndex değiştiğinde sayacı sıfırlasın ki kullanıcı tıkladıktan hemen sonra resim değişmesin

  const prevSlide = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? heroImages.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const nextSlide = () => {
    const isLastSlide = currentIndex === heroImages.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  return (
    <section className="relative h-[600px] md:h-[700px] overflow-hidden group">
      {/* Resimler */}
      {heroImages.map((image, index) => (
        <div
          key={image}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={image}
            alt={`Çırağan Elite Perde - ${index + 1}`}
            fill
            className="object-cover"
            priority={index === 0}
            sizes="100vw"
          />
        </div>
      ))}

      {/* Siyah Opak Katman */}
      <div className="absolute inset-0 bg-black/50 z-10" />

      {/* İçerik */}
      <div className="relative z-20 h-full flex items-center justify-center text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Çırağan Elite Perde
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-md">
            Evinize zarafet katan, kişiye özel ölçü perdeler ve modern
            tasarımlar.
          </p>
          <Link
            href="/kategori/tum-urunler"
            className="inline-block bg-white text-black px-8 py-4 rounded-full font-semibold hover:bg-elite-gold hover:text-white transition-colors duration-300 shadow-lg"
          >
            Alışverişe Başla
          </Link>
        </div>
      </div>

      {/* --- SOL OK BUTONU --- */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white hover:text-black transition-all duration-300 border border-white/20 hidden group-hover:block md:block"
        aria-label="Önceki Slayt"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
      </button>

      {/* --- SAĞ OK BUTONU --- */}
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white hover:text-black transition-all duration-300 border border-white/20 hidden group-hover:block md:block"
        aria-label="Sonraki Slayt"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
      </button>

      {/* Alt Noktalar (Dots) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {heroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "bg-white w-8"
                : "bg-white/50 hover:bg-white/75"
            }`}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}