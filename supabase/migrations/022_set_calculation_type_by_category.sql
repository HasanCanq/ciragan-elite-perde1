-- ============================================================
-- Migration 022: Ürün Fiyatlandırma Tipi — Kategoriye Göre Toplu Güncelleme
-- ============================================================
-- Kural:
--   mt    → Tül perde, Fon perde   (genişlik × pile çarpanı)
--   m2    → Plicell, Stor, Zebra, Jaluzi perde  (alan hesabı)
--   adet  → Aksesuarlar            (birim × miktar)
--
-- Strateji:
--   • categories.name / categories.slug ILIKE eşleşmesi
--   • Hem doğrudan kategori hem üst kategori (parent_id) kontrol edilir
--   • Sıra önemli: önce m2, sonra mt, sonra adet — herhangi bir
--     ürün birden fazla ILIKE ile eşleşirse son UPDATE kazanır.
--     Bu sıra kasıtlıdır: mt en spesifik, adet en genel.
-- ============================================================

BEGIN;

-- ─── Yardımcı: tüm kategori id'lerini ve üst kategori adını birleştiren view ─
-- (CTE olarak kullanılacak, geçici obje oluşturulmaz)


-- ============================================================
-- ADIM 1 — m2: Plicell, Stor, Zebra, Jaluzi
-- ============================================================
WITH m2_cats AS (
  SELECT c.id
  FROM   categories c
  LEFT JOIN categories p ON c.parent_id = p.id
  WHERE
    c.name ILIKE '%plicell%' OR c.slug ILIKE '%plicell%'
    OR c.name ILIKE '%stor%'    OR c.slug ILIKE '%stor%'
    OR c.name ILIKE '%zebra%'   OR c.slug ILIKE '%zebra%'
    OR c.name ILIKE '%jaluzi%'  OR c.slug ILIKE '%jaluzi%'
    -- üst kategori adıyla da eşleş
    OR p.name ILIKE '%plicell%' OR p.slug ILIKE '%plicell%'
    OR p.name ILIKE '%stor%'    OR p.slug ILIKE '%stor%'
    OR p.name ILIKE '%zebra%'   OR p.slug ILIKE '%zebra%'
    OR p.name ILIKE '%jaluzi%'  OR p.slug ILIKE '%jaluzi%'
)
UPDATE products
SET    calculation_type = 'm2'
WHERE  category_id IN (SELECT id FROM m2_cats)
  AND  deleted_at IS NULL;


-- ============================================================
-- ADIM 2 — mt: Tül perde, Fon perde
-- ============================================================
WITH mt_cats AS (
  SELECT c.id
  FROM   categories c
  LEFT JOIN categories p ON c.parent_id = p.id
  WHERE
    c.name ILIKE '%tül%'  OR c.slug ILIKE '%tul%'
    OR c.name ILIKE '%fon%'  OR c.slug ILIKE '%fon%'
    -- üst kategori adıyla da eşleş
    OR p.name ILIKE '%tül%'  OR p.slug ILIKE '%tul%'
    OR p.name ILIKE '%fon%'  OR p.slug ILIKE '%fon%'
)
UPDATE products
SET    calculation_type = 'mt'
WHERE  category_id IN (SELECT id FROM mt_cats)
  AND  deleted_at IS NULL;


-- ============================================================
-- ADIM 3 — adet: Aksesuarlar
-- ============================================================
WITH adet_cats AS (
  SELECT c.id
  FROM   categories c
  LEFT JOIN categories p ON c.parent_id = p.id
  WHERE
    c.name ILIKE '%aksesuar%' OR c.slug ILIKE '%aksesuar%'
    OR c.name ILIKE '%kornis%'   OR c.slug ILIKE '%kornis%'
    OR c.name ILIKE '%korniş%'   OR c.slug ILIKE '%kornis%'
    OR c.name ILIKE '%ray%'      OR c.slug ILIKE '%ray%'
    OR c.name ILIKE '%kelebek%'  OR c.slug ILIKE '%kelebek%'
    OR c.name ILIKE '%kanca%'    OR c.slug ILIKE '%kanca%'
    OR c.name ILIKE '%bant%'     OR c.slug ILIKE '%bant%'
    -- üst kategori adıyla da eşleş
    OR p.name ILIKE '%aksesuar%' OR p.slug ILIKE '%aksesuar%'
)
UPDATE products
SET    calculation_type = 'adet'
WHERE  category_id IN (SELECT id FROM adet_cats)
  AND  deleted_at IS NULL;


-- ============================================================
-- DOĞRULAMA — Güncelleme sonuçlarını göster
-- ============================================================
DO $$
DECLARE
  cnt_mt    INT;
  cnt_m2    INT;
  cnt_adet  INT;
  cnt_total INT;
BEGIN
  SELECT COUNT(*) INTO cnt_mt    FROM products WHERE calculation_type = 'mt'    AND deleted_at IS NULL;
  SELECT COUNT(*) INTO cnt_m2    FROM products WHERE calculation_type = 'm2'    AND deleted_at IS NULL;
  SELECT COUNT(*) INTO cnt_adet  FROM products WHERE calculation_type = 'adet'  AND deleted_at IS NULL;
  SELECT COUNT(*) INTO cnt_total FROM products WHERE deleted_at IS NULL;

  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'Fiyatlandırma tipi güncelleme sonuçları:';
  RAISE NOTICE '  mt    (Tül / Fon perde)   : % ürün', cnt_mt;
  RAISE NOTICE '  m2    (Plicell/Stor/Zebra/Jaluzi): % ürün', cnt_m2;
  RAISE NOTICE '  adet  (Aksesuar)           : % ürün', cnt_adet;
  RAISE NOTICE '  Toplam aktif ürün          : %', cnt_total;
  RAISE NOTICE '════════════════════════════════════════';
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK — Elle çalıştır (gerekirse)
-- ============================================================
-- BEGIN;
-- UPDATE products SET calculation_type = 'adet' WHERE deleted_at IS NULL;
-- COMMIT;
--
-- NOT: Rollback tüm ürünleri 'adet' yapar (migration öncesi default).
--      Ürün bazında geri alma gerekiyorsa yedek alındıktan sonra yapın.
