import Link from "next/link";
import Image from "next/image"; // Resimler için Next.js Image bileşeni
import { getCategories, getFeaturedProducts } from "@/lib/actions"; 
import HeroSection from "@/components/HeroSection";


export default async function Home() {
 
  // 1. Veritabanından Kategorileri ve Öne Çıkan Ürünleri paralel olarak çekiyoruz
  const [categoriesResponse, productsResponse] = await Promise.all([
    getCategories(),
    getFeaturedProducts(),
  ]);

  // 2. Gelen veriyi kontrol ediyoruz. Hata varsa veya veri yoksa boş dizi [] atıyoruz ki sayfa çökmesin.
  const categories = categoriesResponse.success && categoriesResponse.data ? categoriesResponse.data : [];
  const featuredProducts = productsResponse.success && productsResponse.data ? productsResponse.data : [];
 
  return (
    <main className="min-h-screen">
      
    {/* --- HERO SLIDER BÖLÜMÜ --- */}
      {/* Eski statik kod yerine artık bu bileşeni kullanıyoruz */}
      <HeroSection />

      {/* --- KATEGORİLER BÖLÜMÜ --- */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Kategoriler</h2>
          <Link href="/kategori/tum-urunler" className="text-gray-600 hover:text-black font-medium">
            Tümünü Gör →
          </Link>
        </div>
        
        {categories.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Henüz kategori bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link 
                key={category.id} 
                href={`/kategori/${category.slug}`}
                className="group block relative h-64 overflow-hidden rounded-xl bg-gray-200 shadow-sm hover:shadow-md transition"
              >
                {/* Kategori Resmi */}
                {category.image_url ? (
                  <Image
                    src={category.image_url}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500">
                    Resim Yok
                  </div>
                )}
                
                {/* Üzerindeki Yazı */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6">
                  <h3 className="text-white text-xl font-bold group-hover:translate-x-2 transition-transform">
                    {category.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --- ÖNE ÇIKAN ÜRÜNLER BÖLÜMÜ --- */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900">Öne Çıkan Ürünler</h2>
          
          {featuredProducts.length === 0 ? (
            <p className="text-center text-gray-500">Öne çıkan ürün bulunamadı.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProducts.map((product) => (
                <Link 
                  key={product.id} 
                  href={`/urun/${product.slug}`} 
                  className="bg-white rounded-lg shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden group"
                >
                  <div className="relative aspect-[4/3] bg-gray-200">
                     {/* Ürün Resmi (İlk resim) */}
                    {product.images && product.images[0] ? (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">Resim Yok</div>
                    )}
                    {/* Stok Durumu Etiketi */}
                    {!product.in_stock && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                        Tükendi
                      </div>
                    )}
                  </div>
                  
                  <div className="p-5">
                    <div className="text-sm text-gray-500 mb-1">
                      {product.category?.name || 'Genel'}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex justify-between items-center mt-4">
                      <span className="font-bold text-xl text-gray-900">
                        {product.base_price.toLocaleString('tr-TR')} ₺
                        <span className="text-xs font-normal text-gray-500 ml-1">/m²</span>
                      </span>
                      <button className="bg-gray-900 text-white p-2 rounded-full hover:bg-blue-600 transition-colors">
                        {/* Sağ Ok İkonu (Basit SVG) */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

    </main>
  );
}
