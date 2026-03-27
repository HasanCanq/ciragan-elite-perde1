-- ============================================================
-- Migration 011: Kategori Hiyerarşisi (Self-Referencing FK)
-- ============================================================
-- Amaç  : categories tablosuna parent_id kolonu ekleyerek
--         "Tül > Keten / Düz / Brode" gibi iki seviyeli hiyerarşi
--         desteği kazandırır.
--
-- Güvenlik:
--   • ON DELETE SET NULL  — üst kategori silinirse alt kategoriler
--     parent_id = NULL olur; hiçbir veri kaybolmaz.
--   • ON DELETE CASCADE KULLANILMADI (kasıtlı)
--   • CHECK kısıtı ile bir kategori kendi kendisinin üst kategorisi olamaz.
--
-- Mevcut veri etkisi:
--   • Yeni kolon NULL DEFAULT ile eklenir; tüm mevcut satırlar
--     otomatik olarak "kök kategori" (parent_id = NULL) statüsüne alınır.
--   • slug kolonu zaten UNIQUE NOT NULL — dokunulmaz.
--   • ROLLBACK bölümü: geri alma gerektiren durumlarda kopyala-yapıştır.
-- ============================================================

BEGIN;

-- ─── 1. parent_id KOLONU ─────────────────────────────────────────────────────
-- Self-referencing FK: categories.parent_id → categories.id
-- ON DELETE SET NULL: üst silindiyse alt yetim kalır, silinmez.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id UUID
    DEFAULT NULL
    REFERENCES categories(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;  -- Döngüsel insert'lerde constraint'i dönem sonuna erteler

-- ─── 2. CHECK KISITI — bir kategori kendisinin üstü olamaz ───────────────────
-- (Basit tek-adım döngüyü önler; derin döngüler uygulama katmanında kontrol edilmeli)

ALTER TABLE categories
  ADD CONSTRAINT categories_no_self_parent
    CHECK (id <> parent_id);

-- ─── 3. INDEX — parent_id üzerinde sorgular için ─────────────────────────────
-- "Bir üst kategorinin tüm alt kategorilerini getir" gibi sorgular için kritik.

CREATE INDEX IF NOT EXISTS idx_categories_parent_id
  ON categories(parent_id);

-- Kök kategorileri hızlı çekmek için kısmi index (parent_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_categories_root
  ON categories(display_order)
  WHERE parent_id IS NULL;

-- ─── 4. COMMENT'LAR (DBA dokümantasyonu) ─────────────────────────────────────

COMMENT ON COLUMN categories.parent_id IS
  'Self-referencing FK. NULL = kök (ana) kategori. '
  'ON DELETE SET NULL: üst silindiğinde alt kategoriler korunur, parent_id NULL olur.';

-- ─── 5. MEVCUT VERİ — kök kategorileri doğrula ───────────────────────────────
-- Yeni kolonu doğrulamak için: tüm mevcut kategoriler kök olmalı.
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM categories
  WHERE parent_id IS NOT NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Beklenmedik durum: % satırda parent_id dolu geldi.', orphan_count;
  ELSE
    RAISE NOTICE 'Doğrulama geçti: Tüm mevcut kategoriler kök (parent_id = NULL).';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK (geri alma — acil durum için kopyala-yapıştır)
-- ============================================================
-- BEGIN;
--   ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_no_self_parent;
--   DROP INDEX IF EXISTS idx_categories_parent_id;
--   DROP INDEX IF EXISTS idx_categories_root;
--   ALTER TABLE categories DROP COLUMN IF EXISTS parent_id;
-- COMMIT;
