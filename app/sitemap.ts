/**
 * app/sitemap.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * XML Sitemap — Next.js MetadataRoute.Sitemap
 *
 * Değişiklikler:
 *   • Ürün ve kategori sayfalarına `images` alanı eklendi (Google Image Sitemap)
 *   • Ürün sayfası priority: 0.6 → 0.9 (PDP'ler dönüşüm sayfasıdır)
 *   • Kategori priority: 0.7 → 0.8 (navigasyon + SEO için kritik)
 *   • Sitemap erişim hatalarında graceful fallback
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hanedan perde.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // ── Statik sayfalar ──────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url:             BASE_URL,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        1.0,
    },
    {
      url:             `${BASE_URL}/kategori/tum-urunler`,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        0.9,
    },
    {
      url:             `${BASE_URL}/hakkimizda`,
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.4,
    },
    {
      url:             `${BASE_URL}/iletisim`,
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.4,
    },
  ];

  // ── Kategori sayfaları ───────────────────────────────────────────────────
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, created_at, image_url')
    .eq('is_active', true);

  const categoryPages: MetadataRoute.Sitemap = (categories ?? []).map((cat) => ({
    url:             `${BASE_URL}/kategori/${cat.slug}`,
    lastModified:    new Date(cat.created_at),
    changeFrequency: 'weekly' as const,
    priority:        0.8,
    // Image sitemap: kategori kapak görseli Google Image Search için bildirilir
    ...(cat.image_url
      ? {
          images: [{
            url:   cat.image_url,
            title: cat.slug,
          }],
        }
      : {}),
  }));

  // ── Ürün sayfaları ───────────────────────────────────────────────────────
  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at, name, images')
    .eq('is_published', true);

  const productPages: MetadataRoute.Sitemap = (products ?? []).map((product) => {
    // İlk görsel Google Image Sitemap için kullanılır
    const firstImage: string | undefined = Array.isArray(product.images)
      ? product.images[0]
      : undefined;

    return {
      url:             `${BASE_URL}/urun/${product.slug}`,
      lastModified:    new Date(product.updated_at),
      changeFrequency: 'weekly' as const,
      // Ürün detay sayfaları en yüksek öncelikli içerik (dönüşüm sayfası)
      priority:        0.9,
      ...(firstImage
        ? {
            images: [{
              url:   firstImage,
              title: product.name,
            }],
          }
        : {}),
    };
  });

  return [...staticPages, ...categoryPages, ...productPages];
}
