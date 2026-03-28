-- ============================================================
-- Migration 023: mt Türü Ürünlere Varsayılan Pile Seçenekleri Ekle
-- ============================================================
-- Amaç  : calculation_type = 'mt' olan tüm ürünlere
--         Seyrek / Normal / Sık pile seçeneklerini ekler.
--         Zaten kaydı olan ürünler atlanır (idempotent).
--
-- Pile katsayıları (types/index.ts ile senkron):
--   Seyrek : ×1.0  — Hafif, sade görünüm
--   Normal : ×1.2  — Dengeli, klasik görünüm
--   Sık    : ×1.3  — Tam, volümlü görünüm
-- ============================================================

BEGIN;

-- Geçici tablo: eklenecek (ürün, pile) çiftleri
-- Zaten product_pleats'te olan ürünler hariç tutulur.

WITH mt_products AS (
  -- Pile kaydı olmayan mt ürünler
  SELECT p.id
  FROM   products p
  WHERE  p.calculation_type = 'mt'
    AND  p.is_published  = true
    AND  p.deleted_at   IS NULL
    AND  NOT EXISTS (
           SELECT 1 FROM product_pleats pp WHERE pp.product_id = p.id
         )
),
pile_options (name, multiplier, display_order) AS (
  VALUES
    ('Seyrek Pile', 1.0::numeric, 1),
    ('Normal Pile', 1.2::numeric, 2),
    ('Sık Pile',    1.3::numeric, 3)
)
INSERT INTO product_pleats (product_id, name, multiplier, display_order, is_active)
SELECT mp.id, po.name, po.multiplier, po.display_order, true
FROM   mt_products mp
CROSS JOIN pile_options po;


-- ── Doğrulama ─────────────────────────────────────────────────
DO $$
DECLARE
  affected_products INT;
  total_pleats      INT;
BEGIN
  SELECT COUNT(DISTINCT product_id) INTO affected_products
  FROM product_pleats pp
  JOIN products p ON pp.product_id = p.id
  WHERE p.calculation_type = 'mt';

  SELECT COUNT(*) INTO total_pleats
  FROM product_pleats pp
  JOIN products p ON pp.product_id = p.id
  WHERE p.calculation_type = 'mt';

  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'mt ürünler için pile seçenekleri:';
  RAISE NOTICE '  Pile sahibi ürün sayısı : %', affected_products;
  RAISE NOTICE '  Toplam pile kaydı       : %', total_pleats;
  RAISE NOTICE '════════════════════════════════════════';
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK — Elle çalıştır
-- ============================================================
-- BEGIN;
-- DELETE FROM product_pleats
-- WHERE product_id IN (
--   SELECT id FROM products WHERE calculation_type = 'mt'
-- );
-- COMMIT;
