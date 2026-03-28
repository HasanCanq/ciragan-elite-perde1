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
import { JsonLd }                                    from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo/schemas";
import { buildCategoryMetadata }                     from "@/lib/seo/metadata";

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

  if (!category) return { title: "Kategori Bulunamadı | Hanedan" };

  return buildCategoryMetadata(category);
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

  // ─── JSON-LD şemaları ──────────────────────────────────────────
  // BreadcrumbList → Google'ın breadcrumb rich result'ı
  // ItemList → Kategori sayfasında ürün listesi yapısal verisi

  const breadcrumbs = [
    { label: "Anasayfa",   href: "/" },
    { label: "Koleksiyon", href: "/kategori/tum-urunler" },
  ];

  const breadcrumbSchema = buildBreadcrumbSchema(breadcrumbs, category.name);

  // Tüm ürünleri ItemList'e ekle (ilk 50 ile sınırla — şema boyutunu kontrol altında tut)
  const itemListSchema = buildItemListSchema(
    allProducts.slice(0, 50).map((p) => ({
      name:      p.name,
      slug:      p.slug,
      images:    p.images ?? [],
      base_price: p.base_price,
      in_stock:  p.in_stock,
    })),
    `${category.name} Koleksiyonu`,
  );

  return (
    <>
      {/* ── JSON-LD: BreadcrumbList (SSR) ─────────────────────────── */}
      <JsonLd data={breadcrumbSchema} />

      {/* ── JSON-LD: ItemList — kategori ürün listesi (SSR) ─────────── */}
      {allProducts.length > 0 && <JsonLd data={itemListSchema} />}

      <CategoryClient
        category={category}
        categories={categories}
        allProducts={allProducts}
      />
    </>
  );
}
