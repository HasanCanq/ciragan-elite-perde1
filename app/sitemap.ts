import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ciraganeliteperde.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // Statik sayfalar
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/hakkimizda`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/iletisim`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/kategori/tum-urunler`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Kategorileri veritabanindan cek
  const { data: categories } = await supabase
    .from('categories')
    .select('slug, created_at')
    .eq('is_active', true);

  const categoryPages: MetadataRoute.Sitemap = (categories ?? []).map((cat) => ({
    url: `${BASE_URL}/kategori/${cat.slug}`,
    lastModified: new Date(cat.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Urunleri veritabanindan cek
  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at')
    .eq('is_published', true);

  const productPages: MetadataRoute.Sitemap = (products ?? []).map((product) => ({
    url: `${BASE_URL}/urun/${product.slug}`,
    lastModified: new Date(product.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
