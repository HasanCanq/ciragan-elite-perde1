-- ============================================================
-- Migration 034: Ahşap Jaluzi kategorisini ekle
-- ============================================================
-- Amaç: categories tablosuna "Ahşap Jaluzi" kök kategorisi
--       eklenir. calculation_type = 'm2' olarak ayarlanır.
-- ============================================================

BEGIN;

INSERT INTO categories (name, slug, description, display_order, is_active, parent_id, measurement_guide_key)
VALUES (
  'Ahşap Jaluzi',
  'ahsap-jaluzi',
  'Doğal ahşap veya ahşap görünümlü PVC kanatlı jaluzi perdeler. Sıcak ve doğal doku.',
  70,
  true,
  NULL,
  'zebra-stor-ahsap'
)
ON CONFLICT (slug) DO NOTHING;

-- Yeni kategorideki ürünlerin calculation_type'ını m2 yap (henüz ürün yoksa etki etmez)
UPDATE products
SET calculation_type = 'm2'
WHERE category_id = (SELECT id FROM categories WHERE slug = 'ahsap-jaluzi')
  AND calculation_type != 'm2';

-- Doğrulama
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM categories WHERE slug = 'ahsap-jaluzi') INTO v_exists;
  RAISE NOTICE '=== Migration 034 Doğrulama ===';
  RAISE NOTICE 'Ahşap Jaluzi kategorisi: %', CASE WHEN v_exists THEN 'EKLENDI ✓' ELSE 'EKSIK ✗' END;
END $$;

COMMIT;
