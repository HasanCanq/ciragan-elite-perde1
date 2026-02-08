import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ProductWithCategory } from "@/types"; 
import { formatPrice } from "@/lib/utils";

interface ProductCardProps {
  
  product: ProductWithCategory; 
}

export default function ProductCard({ product }: ProductCardProps) {
  
 
  const mainImage = product.images && product.images.length > 0 ? product.images[0] : null;

  return (
    <Link href={`/urun/${product.slug}`} className="group block h-full">
      <article className="bg-white rounded-lg overflow-hidden shadow-elite transition-all duration-400 hover:shadow-elite-hover hover:-translate-y-1 h-full flex flex-col">
        
        {/* --- RESİM ALANI --- */}
        <div className="relative aspect-[2/3] md:aspect-[3/4] lg:aspect-[4/5] overflow-hidden bg-elite-bone">
          
          {/* Resim Yoksa Arkaplan */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-elite-bone to-gray-100">
            <span className="font-serif text-elite-gray/40 text-lg">
              Resim Yok
            </span>
          </div>

          {/* Gerçek Resim */}
          {mainImage && (
            <Image
              src={mainImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}

          {/* Kategori Etiketi  */}
          {product.category && (
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-block px-3 py-1 bg-elite-black/80 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                {product.category.name}
              </span>
            </div>
          )}

          {/* Stok Durumu */}
          {!product.in_stock && (
            <div className="absolute inset-0 bg-elite-black/60 flex items-center justify-center z-20">
              <span className="px-4 py-2 bg-white text-elite-black font-bold rounded-lg shadow-lg transform -rotate-12">
                TÜKENDİ
              </span>
            </div>
          )}
        </div>

        {/* --- İÇERİK ALANI --- */}
        <div className="p-5 flex flex-col flex-grow">
          
          {/* Başlık */}
          <h3 className="font-serif text-lg font-semibold text-elite-black mb-2 group-hover:text-elite-gold transition-colors duration-300 line-clamp-1">
            {product.name}
          </h3>

          {/* Kısa Açıklama */}
          <p className="text-elite-gray text-sm mb-4 line-clamp-2 flex-grow">
            {product.short_description || product.description}
          </p>

          {/* Fiyat ve Buton */}
          <div className="flex items-end justify-between mt-auto pt-4 border-t border-gray-100">
            <div>
              <span className="text-[10px] text-elite-gray uppercase tracking-wider font-medium">
                m² Başlangıç
              </span>
              <p className="text-elite-black font-serif font-semibold text-xl">
                {formatPrice(product.base_price)}
              </p>
            </div>

            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-elite-gold group-hover:bg-elite-gold group-hover:text-white transition-all duration-300">
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}