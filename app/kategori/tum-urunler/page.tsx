import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { getProducts } from "@/lib/actions";
import { formatPrice } from "@/lib/utils";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Tüm Ürünler | Çırağan Elite Perde",
  description: "Çırağan Elite Perde'nin tüm perde koleksiyonunu keşfedin. Premium kalite, modern tasarımlar ve kişiye özel ölçüler.",
  openGraph: {
    title: "Tüm Ürünler | Çırağan Elite Perde",
    description: "Çırağan Elite Perde'nin tüm perde koleksiyonunu keşfedin. Premium kalite, modern tasarımlar ve kişiye özel ölçüler.",
  },
};

export default async function AllProductsPage() {
  const { data: products, success } = await getProducts();
  const allProducts = success && products ? products : [];

  return (
    <div className="bg-elite-bone min-h-screen">
      <div className="bg-white border-b border-gray-100">
        <div className="elite-container py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/"
              className="text-elite-gray hover:text-elite-gold transition-colors duration-300"
            >
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-gray" />
            <span className="text-elite-black font-medium">Tüm Ürünler</span>
          </nav>
        </div>
      </div>

      <div className="elite-container py-12">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-elite-black mb-4">
            Tüm Koleksiyon
          </h1>
          <p className="text-elite-gray text-lg max-w-2xl mx-auto leading-relaxed">
            Evinize zarafet katan, premium kalite perde koleksiyonumuzu keşfedin.
            Her biri özenle seçilmiş kumaşlardan, kişiye özel ölçülerinize göre üretilmektedir.
          </p>
        </div>

        {allProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow-elite">
            <div className="w-20 h-20 bg-elite-bone rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-10 h-10 text-elite-gray"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                />
              </svg>
            </div>
            <h2 className="font-serif text-2xl font-semibold text-elite-black mb-3">
              Henüz ürün bulunamadı
            </h2>
            <p className="text-elite-gray mb-8 max-w-md mx-auto">
              Şu anda gösterilecek ürün bulunmuyor. Lütfen daha sonra tekrar kontrol edin.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-elite-black text-white px-8 py-3 rounded-full font-medium hover:bg-elite-gold transition-colors duration-300"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        ) : (
          <>
            <p className="text-elite-gray text-sm mb-8">
              {allProducts.length} ürün bulundu
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/urun/${product.slug}`}
                  className="bg-white rounded-lg shadow-elite hover:shadow-xl transition-shadow duration-300 overflow-hidden group"
                >
                  <div className="relative aspect-[4/3] bg-elite-bone">
                    {product.images && product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-elite-bone to-gray-100">
                        <span className="font-serif text-elite-gray/40 text-lg">
                          Resim Yok
                        </span>
                      </div>
                    )}
                    {!product.in_stock && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Tükendi
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="text-xs text-elite-gold font-medium uppercase tracking-wider mb-2">
                      {product.category?.name || "Genel"}
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-elite-black mb-2 group-hover:text-elite-gold transition-colors duration-300 line-clamp-2">
                      {product.name}
                    </h3>
                    {product.short_description && (
                      <p className="text-elite-gray text-sm mb-4 line-clamp-2">
                        {product.short_description}
                      </p>
                    )}
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-serif text-xl font-semibold text-elite-black">
                          {formatPrice(product.base_price)}
                        </span>
                        <span className="text-xs text-elite-gray ml-1">/m²</span>
                      </div>
                      <div className="w-10 h-10 bg-elite-black rounded-full flex items-center justify-center group-hover:bg-elite-gold transition-colors duration-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-5 h-5 text-white"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
