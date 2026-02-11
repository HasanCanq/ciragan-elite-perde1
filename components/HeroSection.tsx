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

  useEffect(() => {
    const interval = setInterval(() => nextSlide(), 5000);
    return () => clearInterval(interval);
  }, [currentIndex]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === heroImages.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? heroImages.length - 1 : prev - 1));
  };

  return (
    /* DIŞ KAPSAYICI: 
       Üst boşluğu (pt-24) kaldırdık. Navbar artık resmin üzerine biniyor.
       Yanlardaki boşluğu (px) minimuma indirdik (Mobilde 2, Masaüstünde 4).
    */
    <section className="relative w-full bg-white px-2 md:px-4 pt-2 pb-6 transition-all duration-300">
      
      {/* VİTRİN KARTI:
          h-[75vh]: Ekranın %75'i kadar yükseklik.
          rounded-b-[3rem]: Sadece alt köşeleri genişçe yuvarlattık (Perde dökümü gibi).
          rounded-t-[1.5rem]: Üst köşeleri çok hafif yuvarlattık.
      */}
      <div className="relative h-[75vh] md:h-[85vh] w-full overflow-hidden rounded-t-[1.5rem] rounded-b-[4rem] shadow-2xl group bg-gray-900">
        
        {/* Resim Katmanı */}
        {heroImages.map((image, index) => (
          <div
            key={image}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentIndex ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
          >
            <Image
              src={image}
              alt="Çırağan Elite"
              fill
              className="object-cover transition-transform duration-[2000ms]"
              priority={index === 0}
            />
          </div>
        ))}

        {/* Gradyan Karartma: Üstten (Navbar için) ve Alttan (Yazı için) yumuşak geçiş */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 z-10" />

        {/* İçerik */}
        <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-4">
          {/* Navbar altına gelmemesi için mt-20 verdik */}
          <div className="mt-20">
            <h1 className="text-4xl md:text-7xl font-bold mb-4 text-white drop-shadow-2xl tracking-tight uppercase">
              Çırağan Elite Perde
            </h1>
            <p className="text-base md:text-xl text-white/80 mb-10 max-w-xl mx-auto font-light tracking-wide">
              Yaşam alanınıza değer katan estetik dokunuşlar.
            </p>
            <Link
              href="/kategori/tum-urunler"
              className="bg-white text-elite-brown px-12 py-4 rounded-full font-bold hover:bg-elite-gold hover:text-white transition-all duration-500 shadow-xl tracking-widest text-sm"
            >
              KEŞFET
            </Link>
          </div>
        </div>

        {/* Kontrol Okları */}
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-30 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:flex">
          <button onClick={prevSlide} className="p-3 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white hover:text-black transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={nextSlide} className="p-3 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white hover:text-black transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Noktalar */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {heroImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1 transition-all duration-500 rounded-full ${index === currentIndex ? "bg-white w-12" : "bg-white/30 w-4"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}