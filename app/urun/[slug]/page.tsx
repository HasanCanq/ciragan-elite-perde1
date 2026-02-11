import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Check, Truck, Shield, RotateCcw } from "lucide-react";
import { getProduct } from "@/lib/actions";
import { formatPrice } from "@/lib/utils";
import PriceCalculator from "@/components/PriceCalculator";
import ProductImageGallery from "@/components/ProductImageGallery";
import ProductReviews from "@/components/ProductReviews";
import type { Metadata } from "next";


export const dynamic = "force-dynamic";
export const dynamicParams = true; 
export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// SEO (Metadata) Ayarları
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: product } = await getProduct(slug);
  
  if (!product) {
    return {
      title: "Ürün Bulunamadı | Çırağan Elite Perde",
    };
  }

  return {
    title: `${product.name} | Çırağan Elite Perde`,
    description: product.description || product.short_description,
    openGraph: {
      images: product.images && product.images.length > 0 ? [product.images[0]] : [],
    },
  };
}
 
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  
  
  console.log(`[ProductPage] İstenen Slug: ${slug}`);

  const { data: product, error } = await getProduct(slug);

  if (error) {
    console.error(`[ProductPage] Supabase Hatası:`, error);
  }

  if (!product) {
    console.warn(`[ProductPage] Ürün bulunamadı (404).`);
    notFound();
  }

  
  // const features = [
  //   "Premium kalite kumaş",
  //   "Solmaya karşı dayanıklı",
  //   "Kolay temizlenebilir",
  //   "2 yıl garanti",
  // ];
 
 
  const features = (product as any)?.ozellikler || [];
  const categoryData = (product as any)?.category;
  const finalCategory = typeof categoryData === 'object' 
    ? categoryData?.name 
    : (categoryData || 'Diğer');
  const mainImage = product.images && product.images.length > 0 ? product.images[0] : null;
   
  return (
    <div className="bg-elite-bone min-h-screen">
      {/* Breadcrumb (Navigasyon Yolu) */}
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
            
            {product.category && (
              <>
                <Link
                  href={`/kategori/${product.category.slug}`}
                  className="text-elite-gray hover:text-elite-gold transition-colors duration-300"
                >
                  {product.category.name}
                </Link>
                <ChevronRight className="w-4 h-4 text-elite-gray" />
              </>
            )}
            <span className="text-elite-black font-medium line-clamp-1">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Content */}
      <div className="elite-container py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* SOL TARAF - RESİMLER */}
          <ProductImageGallery
            images={product.images || []}
            productName={product.name}
          />

          {/* SAĞ TARAF - DETAYLAR VE HESAPLAMA */}
          <div>
            {/* Kategori Etiketi */}
            {product.category && (
              <Link
                href={`/kategori/${product.category.slug}`}
                className="inline-block text-elite-gold font-medium text-sm uppercase tracking-wider mb-2 hover:opacity-70 transition-opacity duration-300"
              >
                {product.category.name}
              </Link>
            )}

            {/* Ürün Başlığı */}
            <h1 className="font-serif text-3xl lg:text-4xl font-semibold text-elite-black mb-4">
              {product.name}
            </h1>

            {/* Fiyat Bilgisi */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-elite-gray text-sm">m² başlangıç fiyatı:</span>
              <span className="font-serif text-2xl font-semibold text-elite-gold">
                {formatPrice(product.base_price)}
              </span>
            </div>

            {/* Açıklama */}
            <p className="text-elite-gray leading-relaxed mb-6">
              {product.description || product.short_description || "Bu ürün için açıklama bulunmuyor."}
            </p>
            {features.length > 0 && (
      <div className="mb-8">
        <h3 className="font-medium text-elite-black mb-3">Özellikler</h3>
        <ul className="grid grid-cols-2 gap-2">
          {/* TypeScript kızmasın diye feature: string olarak belirttik */}
          {features.map((feature: string, index: number) => (
            <li
              key={index}
              className="flex items-center gap-2 text-sm text-elite-gray"
            >
              <Check className="w-4 h-4 text-elite-gold" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    )}
   
    


            {/* Fiyat Hesaplayıcı Componenti */}
            <PriceCalculator
              productId={product.id}
              productName={product.name}
              productSlug={product.slug}
              productImage={mainImage}
              m2Price={product.base_price}
              category={finalCategory}
            />

            {/* Güven Rozetleri */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="text-center p-4 bg-white rounded-lg border border-gray-100">
                <Truck className="w-6 h-6 text-elite-gold mx-auto mb-2" />
                <span className="text-xs text-elite-gray block font-medium">Ücretsiz Kargo</span>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-gray-100">
                <Shield className="w-6 h-6 text-elite-gold mx-auto mb-2" />
                <span className="text-xs text-elite-gray block font-medium">2 Yıl Garanti</span>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-gray-100">
                <RotateCcw className="w-6 h-6 text-elite-gold mx-auto mb-2" />
                <span className="text-xs text-elite-gray block font-medium">Kolay İade</span>
              </div>
            </div>

          </div>
        </div>

        {/* YORUMLAR */}
        <div className="mt-12">
          <ProductReviews productId={product.id} />
        </div>
      </div>
    </div>
  );
}