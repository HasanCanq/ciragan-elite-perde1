// Server Component — ISR aktif (revalidate = 3600)
// searchParams burada OKUNMUYOR → sayfa önbelleğe alınır.
// Filtreleme CategoryClient (client-side) tarafından yapılır.

import { notFound } from "next/navigation";
import {
  getCategoryPublic,
  getCategoriesPublic,
  getAllCategorySlugsPublic,
} from "@/lib/data/public-queries";
import { getProductsByCategory } from "@/lib/actions";
import CategoryClient from "@/components/shop/CategoryClient";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugsPublic();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = true;
export const revalidate = 3600; // 1 saat ISR — searchParams yoksa çalışır

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryPublic(slug);

  if (!category) return { title: "Kategori Bulunamadı | Çırağan Elite Perde" };

  return {
    title: `${category.name} | Çırağan Elite Perde`,
    description:
      category.description ||
      `${category.name} kategorisindeki tüm ürünleri keşfedin. Çırağan Elite Perde'de kaliteli perde modelleri.`,
    openGraph: {
      title: `${category.name} | Çırağan Elite Perde`,
      description:
        category.description ||
        `${category.name} kategorisindeki tüm ürünleri keşfedin.`,
      images: category.image_url ? [category.image_url] : [],
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  // Filtre YOK → ISR cache'e girer, revalidate = 3600 çalışır
  const [category, productsResponse, categories] = await Promise.all([
    getCategoryPublic(slug),
    getProductsByCategory(slug), // filtreler CategoryClient'ta client-side uygulanır
    getCategoriesPublic(),
  ]);

  if (!category) notFound();

  const allProducts =
    productsResponse.success && productsResponse.data
      ? productsResponse.data
      : [];

  return (
    <CategoryClient
      category={category}
      categories={categories}
      allProducts={allProducts}
    />
  );
}
