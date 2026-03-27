/**
 * Kategori Veri Katmanı — Hiyerarşik Sorgular
 *
 * Self-referencing FK (parent_id → id, ON DELETE SET NULL) ile
 * iki seviyeli ağaç yapısını Supabase üzerinden okur/yazar.
 *
 * Kullanım örnekleri:
 *   - getRootCategoriesWithChildren()   → Navbar / mega-menu
 *   - getCategoryTreeFlat()             → Admin yönetim ekranı
 *   - getCategoryBreadcrumb(slug)       → SEO breadcrumb
 *   - generateCategorySlug(name)        → Admin form (otomatik slug)
 */

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Category, CategoryWithChildren, CategoryWithParent } from '@/types';

// ─── Slug Üretici ─────────────────────────────────────────────────────────────

/**
 * Kategori adından URL-safe, Türkçe karakterleri normalleştirilmiş slug üretir.
 * Örn: "Tül Perdeler" → "tul-perdeler"
 */
export function generateCategorySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ─── Okuma Sorguları ──────────────────────────────────────────────────────────

/**
 * Tüm AKTİF kök kategorileri, her birinin aktif alt kategorileriyle birlikte getirir.
 *
 * SQL eşdeğeri (Supabase nested select):
 *   SELECT *, children:categories!parent_id(*)
 *   FROM categories
 *   WHERE parent_id IS NULL AND is_active = true
 *   ORDER BY display_order;
 *
 * Kullanım: Navbar, anasayfa kategori listesi, mega-menu
 */
export async function getRootCategoriesWithChildren(): Promise<CategoryWithChildren[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .select(`
      *,
      children:categories!parent_id(*)
    `)
    .is('parent_id', null)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[categories] getRootCategoriesWithChildren hatası:', error);
    return [];
  }

  // Yalnızca aktif alt kategorileri filtrele (DB'de nested WHERE yok)
  return (data as CategoryWithChildren[]).map((cat) => ({
    ...cat,
    children: (cat.children ?? [])
      .filter((c) => c.is_active)
      .sort((a, b) => a.display_order - b.display_order),
  }));
}

/**
 * Bir alt kategoriyi, üst kategorisiyle birlikte getirir.
 * Breadcrumb ve <title> üretimi için kullanılır.
 *
 * Örn: slug="keten" → { name:"Keten", parent:{ name:"Tül Perdeler", slug:"tul-perdeler" } }
 */
export async function getCategoryWithParent(
  slug: string
): Promise<CategoryWithParent | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .select(`
      *,
      parent:categories!parent_id(*)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[categories] getCategoryWithParent hatası:', error);
    return null;
  }

  return data as CategoryWithParent | null;
}

/**
 * Admin paneli için TÜM kategorileri (aktif/pasif dahil) düz liste halinde getirir.
 * parent_id doluysa "alt kategori" olduğunu gösterir.
 *
 * Ağaç yapısı istemcide buildCategoryTree() ile inşa edilir.
 */
export async function getAllCategoriesFlat(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[categories] getAllCategoriesFlat hatası:', error);
    return [];
  }

  return data as Category[];
}

/**
 * Slug zincirinden breadcrumb yolu üretir.
 * Örn: ["Anasayfa", "Tül Perdeler", "Keten"]
 */
export async function getCategoryBreadcrumb(
  slug: string
): Promise<{ name: string; slug: string }[]> {
  const category = await getCategoryWithParent(slug);
  if (!category) return [];

  const crumbs: { name: string; slug: string }[] = [];

  if (category.parent) {
    crumbs.push({ name: category.parent.name, slug: category.parent.slug });
  }

  crumbs.push({ name: category.name, slug: category.slug });
  return crumbs;
}

// ─── İstemci Tarafı Ağaç İnşası ──────────────────────────────────────────────

/**
 * Düz kategori listesinden bellek içinde ağaç yapısı inşa eder.
 * DB'ye ek sorgu atmadan çalışır — getAllCategoriesFlat() çıktısıyla kullanılır.
 *
 * Algoritma: O(n) — önce map, sonra tek geçişte parent-child ilişkilendirmesi.
 *
 * @example
 * const flat = await getAllCategoriesFlat();
 * const tree = buildCategoryTree(flat);
 * // tree = [
 * //   { id, name: "Tül Perdeler", children: [
 * //     { id, name: "Keten", children: [] },
 * //     { id, name: "Düz",   children: [] },
 * //   ]},
 * //   ...
 * // ]
 */
export function buildCategoryTree(flat: Category[]): CategoryWithChildren[] {
  // id → node haritası
  const nodeMap = new Map<string, CategoryWithChildren>(
    flat.map((cat) => ({ ...cat, children: [] })).map((cat) => [cat.id, cat])
  );

  const roots: CategoryWithChildren[] = [];

  for (const cat of flat) {
    const node = nodeMap.get(cat.id)!;

    if (cat.parent_id === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(cat.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Üst kategori pasif/silinmiş — yetim node'u kök olarak ekle
        roots.push(node);
      }
    }
  }

  return roots;
}

// ─── Yazma Yardımcıları ───────────────────────────────────────────────────────

/**
 * Slug benzersizliğini kontrol eder.
 * Admin form'da "Kaydet" öncesi çağrılır.
 * excludeId: güncelleme senaryosunda kendi ID'sini hariç tutar.
 */
export async function isCategorySlugUnique(
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const supabase = await createClient();

  let query = supabase
    .from('categories')
    .select('id')
    .eq('slug', slug);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data } = await query.maybeSingle();
  return data === null; // null → benzersiz
}
