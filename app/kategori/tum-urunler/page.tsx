// Server Component — ISR aktif (revalidate = 3600)
// searchParams burada OKUNMUYOR → sayfa önbelleğe alınır.
// Filtreleme CategoryClient (client-side) tarafından yapılır.

import { getAllProductsFiltered } from "@/lib/actions";
import { getCategoriesPublic } from "@/lib/data/public-queries";
import { Category } from "@/types";
import CategoryClient from "@/components/shop/CategoryClient";
import type { Metadata } from "next";

export const revalidate = 3600; // 1 saat ISR — searchParams yoksa çalışır

export const metadata: Metadata = {
  title: "Tüm Ürünler | Çırağan Elite Perde",
  description:
    "Çırağan Elite Perde'nin tüm perde koleksiyonunu keşfedin. Premium kalite, modern tasarımlar ve kişiye özel ölçüler.",
  openGraph: {
    title: "Tüm Ürünler | Çırağan Elite Perde",
    description:
      "Çırağan Elite Perde'nin tüm perde koleksiyonunu keşfedin. Premium kalite, modern tasarımlar ve kişiye özel ölçüler.",
  },
};

// Sanal "Tüm Koleksiyon" kategorisi — DB'den gelmiyor
const ALL_PRODUCTS_CATEGORY: Category = {
  id: "all",
  name: "Tüm Koleksiyon",
  slug: "tum-urunler",
  description:
    "Evinize zarafet katan, premium kalite perde koleksiyonumuzu keşfedin. Her biri özenle seçilmiş kumaşlardan, kişiye özel ölçülerinize göre üretilmektedir.",
  image_url: null,
  parent_id: null,
  display_order: 0,
  is_active: true,
  created_at: new Date().toISOString(),
};

export default async function AllProductsPage() {
  // Filtre YOK → ISR cache'e girer, revalidate = 3600 çalışır
  const [productsResponse, categories] = await Promise.all([
    getAllProductsFiltered(), // filtreler CategoryClient'ta client-side uygulanır
    getCategoriesPublic(),
  ]);

  const allProducts =
    productsResponse.success && productsResponse.data
      ? productsResponse.data
      : [];

  return (
    <CategoryClient
      category={ALL_PRODUCTS_CATEGORY}
      categories={categories}
      allProducts={allProducts}
    />
  );
}
