'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductImageGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const mainImage = images[selectedIndex] || null;

  return (
    <div>
      {/* Ana Görsel */}
      <div className="aspect-[4/5] bg-white rounded-lg shadow-elite overflow-hidden relative group">
        {mainImage ? (
          <Image
            src={mainImage}
            alt={productName}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-elite-bone to-gray-100">
            <span className="font-serif text-elite-gray/40 text-2xl">Resim Yok</span>
          </div>
        )}
      </div>

      {/* Thumbnail'lar */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-3 mt-4">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`aspect-square rounded-lg bg-white shadow-sm cursor-pointer overflow-hidden relative transition-all ${
                index === selectedIndex
                  ? 'ring-2 ring-elite-gold'
                  : 'hover:ring-2 hover:ring-elite-gold/50 opacity-70 hover:opacity-100'
              }`}
            >
              <Image
                src={img}
                alt={`${productName} - ${index + 1}`}
                fill
                className="object-cover"
                sizes="100px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
