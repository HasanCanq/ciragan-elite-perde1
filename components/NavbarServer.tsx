import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryWithChildren } from "@/types";
import NavbarClient from "./NavbarClient";

// ─── Flat listeyi ağaç yapısına dönüştür ─────────────────────────────────────
function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const roots: CategoryWithChildren[] = [];
  const map = new Map<string, CategoryWithChildren>();

  // Önce tüm node'ları map'e ekle
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  // Sonra parent-child ilişkisini kur
  for (const node of Array.from(map.values())) {
    if (node.parent_id === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  // display_order'a göre sırala
  roots.sort((a, b) => a.display_order - b.display_order);
  for (const root of roots) {
    root.children.sort((a, b) => a.display_order - b.display_order);
  }

  return roots;
}

export default async function NavbarServer() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const tree = error || !data ? [] : buildCategoryTree(data as Category[]);

  return <NavbarClient categories={tree} />;
}
