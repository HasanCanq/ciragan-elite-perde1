import { getCategoriesPublic } from '@/lib/data/public-queries';
import HeaderClient from './HeaderClient';

/**
 * Header — Async Server Component
 * Kök kategorileri DB'den çeker, HeaderClient'a iletir.
 * cookies() çağrılmaz → ISR cache çalışır.
 */
export default async function Header() {
  const categories = await getCategoriesPublic();

  // Yalnızca kök (parent_id = NULL) ve aktif kategoriler navbar'a girer
  const navItems = categories
    .filter((c) => c.parent_id === null)
    .map((c) => ({ label: c.name, href: `/kategori/${c.slug}` }));

  return <HeaderClient navItems={navItems} />;
}
