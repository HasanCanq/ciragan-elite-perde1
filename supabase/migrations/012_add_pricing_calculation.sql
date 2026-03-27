-- ============================================================
-- Migration 012: Dinamik Fiyat Hesaplama Mimarisi
-- ============================================================
-- Amaç  : Tül (mt), Zebra/Stor (m2), Aksesuar (adet) gibi
--         farklı fiyatlandırma kurallarını veritabanı seviyesinde
--         modellemek.
--
-- Etkilenen tablolar:
--   1. products       — 3 yeni kolon (calculation_type, min_width_cm, min_area_m2)
--   2. product_pleats — YENİ tablo (metre işi ürünler için kıvrım çarpanları)
--
-- Güvenlik:
--   • Mevcut products satırlarına calculation_type = 'adet' atanır (SAFE DEFAULT).
--   • base_price mevcut veriyi taşır; yalnızca COMMENT güncellenir.
--   • product_pleats ON DELETE CASCADE: ürün silinince pile'lar da silinir.
--
-- ROLLBACK bölümü altta hazır.
-- ============================================================

BEGIN;

-- ============================================================
-- BÖLÜM 1: ENUM TİPİ
-- ============================================================

-- Güvenli oluşturma: tip zaten varsa atla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'calculation_type'
  ) THEN
    CREATE TYPE calculation_type AS ENUM (
      'mt',    -- Metre işi (Tül, Fon) — genişlik × pile çarpanı
      'm2',    -- Metrekare işi (Zebra, Stor, Jaluzi) — alan hesabı
      'adet'   -- Sabit fiyat (Aksesuar, Korniş, Kelebek) — miktar × birim fiyat
    );
    RAISE NOTICE 'calculation_type ENUM oluşturuldu.';
  ELSE
    RAISE NOTICE 'calculation_type ENUM zaten mevcut, atlandı.';
  END IF;
END $$;


-- ============================================================
-- BÖLÜM 2: PRODUCTS TABLOSU — YENİ KOLONLAR
-- ============================================================

-- 2a. calculation_type
--     Mevcut ürünlerin tamamına güvenli varsayılan: 'adet'
--     (Admin daha sonra doğru tipe güncelleyebilir)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS calculation_type calculation_type
    NOT NULL DEFAULT 'adet';

COMMENT ON COLUMN products.calculation_type IS
  'Fiyat hesaplama birimi: '
  'mt = metre işi (Tül/Fon, pile çarpanı gerekir), '
  'm2 = metrekare işi (Zebra/Stor, alan hesabı), '
  'adet = sabit birim fiyat (Aksesuar).';

-- 2b. base_price yorumunu güncelle
--     Kolon zaten var; sadece dokümantasyonu netleştiriyoruz.
COMMENT ON COLUMN products.base_price IS
  'Birim fiyat (TRY). '
  'mt türü → TL/metre, '
  'm2 türü → TL/m², '
  'adet türü → TL/adet.';

-- 2c. min_width_cm
--     m2 türü ürünlerde: girilen genişlik bu değerin altındaysa
--     bu değer baz alınır. Örn: Zebra min 100 cm en.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_width_cm INTEGER
    DEFAULT NULL
    CHECK (min_width_cm IS NULL OR min_width_cm > 0);

COMMENT ON COLUMN products.min_width_cm IS
  'm2 türü ürünlerde minimum genişlik (cm). '
  'NULL = sınır yok. '
  'Girilen genişlik < min_width_cm ise hesaplamada min_width_cm kullanılır.';

-- 2d. min_area_m2
--     m2 türü ürünlerde: hesaplanan alan bu değerin altındaysa
--     bu değer baz alınır. Örn: Zebra min 1.5 m².
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_area_m2 DECIMAL(6,3)
    DEFAULT NULL
    CHECK (min_area_m2 IS NULL OR min_area_m2 > 0);

COMMENT ON COLUMN products.min_area_m2 IS
  'm2 türü ürünlerde minimum alan (m²). '
  'NULL = sınır yok. '
  'Hesaplanan alan < min_area_m2 ise hesaplamada min_area_m2 kullanılır.';

-- 2e. Filtreleme için index
CREATE INDEX IF NOT EXISTS idx_products_calc_type
  ON products(calculation_type);

-- ============================================================
-- BÖLÜM 3: product_pleats TABLOSU
-- ============================================================
-- Metre işi (mt) ürünlere ait pile/kıvrım seçenekleri.
-- Örn: "1x2 Seyrek Pile" (multiplier: 2.0), "1x3 Sık Pile" (multiplier: 3.0)
--
-- ON DELETE CASCADE: ürün silinince tüm pile seçenekleri de silinir.
-- Bu "sahiplik" ilişkisidir — pilenin ürün olmadan anlamı yok.

CREATE TABLE IF NOT EXISTS product_pleats (
  id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   UUID          NOT NULL
                 REFERENCES products(id)
                 ON DELETE CASCADE,
  name         TEXT          NOT NULL,           -- Görünen ad: "1x2.5 Normal Pile"
  multiplier   DECIMAL(4,2)  NOT NULL,           -- Kumaş çarpanı: 2.5
  display_order INT          DEFAULT 0,          -- Dropdown sıralaması
  is_active    BOOLEAN       DEFAULT true NOT NULL,
  created_at   TIMESTAMPTZ   DEFAULT NOW() NOT NULL,

  -- Aynı ürünün aynı çarpanı iki kez tanımlanamaz
  CONSTRAINT product_pleats_unique_multiplier
    UNIQUE (product_id, multiplier),

  -- Çarpan makul aralıkta olmalı (1.0 = pile yok, 5.0 pratik üst sınır)
  CONSTRAINT product_pleats_multiplier_range
    CHECK (multiplier BETWEEN 1.0 AND 5.0)
);

COMMENT ON TABLE product_pleats IS
  'Metre işi (mt) ürünlerin pile/kıvrım seçenekleri. '
  'multiplier: kullanılacak kumaş = genişlik × multiplier / 100.';

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_product_pleats_product_id
  ON product_pleats(product_id);

CREATE INDEX IF NOT EXISTS idx_product_pleats_active
  ON product_pleats(product_id, display_order)
  WHERE is_active = true;

-- ============================================================
-- BÖLÜM 4: RLS POLİTİKALARI
-- ============================================================

ALTER TABLE product_pleats ENABLE ROW LEVEL SECURITY;

-- Herkes (anonim dahil) aktif pile'ları okuyabilir
CREATE POLICY "product_pleats_select_public"
  ON product_pleats
  FOR SELECT
  USING (is_active = true);

-- Yalnızca admin yazabilir / güncelleyebilir / silebilir
CREATE POLICY "product_pleats_insert_admin"
  ON product_pleats
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "product_pleats_update_admin"
  ON product_pleats
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "product_pleats_delete_admin"
  ON product_pleats
  FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- BÖLÜM 5: DOĞRULAMA
-- ============================================================

DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'products'
    AND column_name IN ('calculation_type', 'min_width_cm', 'min_area_m2');

  IF col_count = 3 THEN
    RAISE NOTICE 'Doğrulama geçti: products tablosuna 3 kolon başarıyla eklendi.';
  ELSE
    RAISE WARNING 'Beklenen 3 kolon, bulunan: %. Manuel kontrol gerekli.', col_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_pleats') THEN
    RAISE NOTICE 'Doğrulama geçti: product_pleats tablosu oluşturuldu.';
  ELSE
    RAISE WARNING 'product_pleats tablosu bulunamadı!';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK (acil geri alma — kopyala-yapıştır)
-- ============================================================
-- BEGIN;
--   DROP TABLE IF EXISTS product_pleats;
--   ALTER TABLE products DROP COLUMN IF EXISTS min_area_m2;
--   ALTER TABLE products DROP COLUMN IF EXISTS min_width_cm;
--   ALTER TABLE products DROP COLUMN IF EXISTS calculation_type;
--   DROP INDEX IF EXISTS idx_products_calc_type;
--   DROP TYPE  IF EXISTS calculation_type;
-- COMMIT;
