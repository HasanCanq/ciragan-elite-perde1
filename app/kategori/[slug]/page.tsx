import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getCategory,
  getProductsByCategory,
  getCategories,
  ProductFilters as ProductFiltersType,
} from "@/lib/actions";
import { formatPrice } from "@/lib/utils";
import CategoryLayout from "@/components/shop/CategoryLayout";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const dynamicParams = true;
export const revalidate = 60;

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    inStock?: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: category } = await getCategory(slug);

  if (!category) {
    return {
      title: "Kategori Bulunamadı | Çırağan Elite Perde",
    };
  }

  return {
    title: `${category.name} | Çırağan Elite Perde`,
    description: category.description || `${category.name} kategorisindeki tüm ürünleri keşfedin. Çırağan Elite Perde'de kaliteli perde modelleri.`,
    openGraph: {
      title: `${category.name} | Çırağan Elite Perde`,
      description: category.description || `${category.name} kategorisindeki tüm ürünleri keşfedin.`,
      images: category.image_url ? [category.image_url] : [],
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  // Parse filters from URL
  const filters: ProductFiltersType = {
    minPrice: search.minPrice ? parseFloat(search.minPrice) : undefined,
    maxPrice: search.maxPrice ? parseFloat(search.maxPrice) : undefined,
    sortOrder: (search.sort as ProductFiltersType['sortOrder']) || 'recommended',
    inStockOnly: search.inStock === 'true',
  };

  const [categoryResponse, productsResponse, categoriesResponse] = await Promise.all([
    getCategory(slug),
    getProductsByCategory(slug, filters),
    getCategories(),
  ]);

  const category = categoryResponse.success && categoryResponse.data ? categoryResponse.data : null;
  const products = productsResponse.success && productsResponse.data ? productsResponse.data : [];
  const categories = categoriesResponse.success && categoriesResponse.data ? categoriesResponse.data : [];

  if (!category) {
    notFound();
  }

  // Current filters for the layout
  const currentFilters = {
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    sortOrder: search.sort || 'recommended',
  };

  return (
    <CategoryLayout
      category={category}
      categories={categories}
      products={products}
      currentFilters={currentFilters}
    >
      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
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
            Ürün Bulunamadı
          </h2>
          <p className="text-elite-gray mb-8 max-w-md mx-auto">
            {currentFilters.minPrice || currentFilters.maxPrice
              ? 'Seçtiğiniz filtrelere uygun ürün bulunamadı. Filtreleri değiştirmeyi deneyin.'
              : 'Bu kategoride henüz ürün bulunmuyor. Diğer kategorilerimize göz atabilirsiniz.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-elite-black text-white px-8 py-3 rounded-full font-medium hover:bg-elite-gold transition-colors duration-300"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/urun/${product.slug}`}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] bg-elite-bone overflow-hidden">
                {product.images && product.images[0] ? (
                  <Image
                    src={product.images[0]}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-elite-bone to-gray-100">
                    <span className="font-serif text-elite-gray/40 text-lg">
                      Resim Yok
                    </span>
                  </div>
                )}

                {/* Out of Stock Badge */}
                {!product.in_stock && (
                  <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Tükendi
                  </div>
                )}

                {/* Quick View Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              </div>

              {/* Content */}
              <div className="p-5">
                {/* Category Badge */}
                <div className="text-xs text-elite-gold font-medium uppercase tracking-wider mb-2">
                  {product.category?.name || category.name}
                </div>

                {/* Product Name */}
                <h3 className="font-serif text-lg font-semibold text-elite-black mb-2 group-hover:text-elite-gold transition-colors duration-300 line-clamp-2">
                  {product.name}
                </h3>

                {/* Short Description */}
                {product.short_description && (
                  <p className="text-elite-gray text-sm mb-4 line-clamp-2">
                    {product.short_description}
                  </p>
                )}

                {/* Price and CTA */}
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <div>
                    <span className="font-serif text-xl font-semibold text-elite-black">
                      {formatPrice(product.base_price)}
                    </span>
                    <span className="text-xs text-elite-gray ml-1">/m²</span>
                  </div>

                  {/* Arrow Button */}
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
      )}
    </CategoryLayout>
  );
}
