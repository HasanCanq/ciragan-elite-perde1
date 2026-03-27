-- ============================================================
-- Migration 017: Adres Normalizasyonu ve Sipariş Adres Snapshot'ı
--
-- Değişiklikler:
--   addresses  → first_name, last_name, neighbourhood ekle
--               billing_type ENUM, tax_number, tax_office ekle
--               full_name → first_name + last_name split, sonra DROP
--   orders     → shipping_address_snapshot JSONB, billing_address_snapshot JSONB ekle
--               Mevcut TEXT alanları korunur (backward compat)
--   profiles   → address TEXT kolonu DROP (addresses tablosu kullanılıyor)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. billing_type ENUM
-- ============================================================

DO $$
BEGIN
  CREATE TYPE billing_type AS ENUM ('INDIVIDUAL', 'CORPORATE');
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Zaten varsa geç
END $$;

-- ============================================================
-- 2. addresses — yeni kolonlar
-- ============================================================

-- first_name / last_name: önce nullable ekle (veri migration'dan sonra NOT NULL yapılacak)
ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS first_name    VARCHAR(150),
  ADD COLUMN IF NOT EXISTS last_name     VARCHAR(150),
  ADD COLUMN IF NOT EXISTS neighbourhood VARCHAR(150),
  ADD COLUMN IF NOT EXISTS billing_type  billing_type NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS tax_number    VARCHAR(11),   -- VKN (10) veya TCKN (11)
  ADD COLUMN IF NOT EXISTS tax_office    VARCHAR(150);

-- ============================================================
-- 3. full_name → first_name + last_name veri migrasyonu
--
-- Kural: "Ahmet Mehmet Yılmaz" → first="Ahmet", last="Mehmet Yılmaz"
--        "Ahmet"               → first="Ahmet", last=""
--        NULL / boş            → first="Bilinmiyor", last=""
-- ============================================================

UPDATE addresses
SET
  first_name = TRIM(
    SPLIT_PART(TRIM(COALESCE(full_name, '')), ' ', 1)
  ),
  last_name = TRIM(
    CASE
      WHEN TRIM(COALESCE(full_name, '')) ~ '\s'
      -- İlk kelimeyi ve arkasındaki boşlukları çıkar, gerisini al
      THEN REGEXP_REPLACE(
             TRIM(COALESCE(full_name, '')),
             E'^\\S+\\s+',
             ''
           )
      ELSE ''
    END
  )
WHERE full_name IS NOT NULL;

-- Paranoia guard: first_name boş kaldıysa (full_name NULL veya tamamen boşluk)
UPDATE addresses
SET
  first_name = 'Bilinmiyor',
  last_name  = COALESCE(last_name, '')
WHERE first_name IS NULL OR TRIM(first_name) = '';

-- last_name NULL → boş string (tekdüze veri tipi)
UPDATE addresses
SET last_name = ''
WHERE last_name IS NULL;

-- ============================================================
-- 4. NOT NULL kısıtı (veriler hazır olduğundan güvenle eklenebilir)
-- ============================================================

ALTER TABLE addresses
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name  SET NOT NULL;

-- ============================================================
-- 5. full_name DROP
-- ============================================================

ALTER TABLE addresses DROP COLUMN IF EXISTS full_name;

-- ============================================================
-- 6. orders — adres snapshot kolonları
-- (Mevcut shipping_address / billing_address TEXT kolonları korunur)
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS billing_address_snapshot  JSONB;

-- ============================================================
-- 7. Mevcut TEXT adreslerini JSONB snapshot'a çevir
--
-- shipping_address / billing_address TEXT olarak saklanmıştır.
-- Checkout.ts bunları JSON string olarak yazıyorsa doğrudan cast edilir.
-- Geçersiz JSON ise {raw: "..."} sarmalayıcıya alınır.
-- ============================================================

DO $$
DECLARE
  rec       RECORD;
  ship_json JSONB;
  bill_json JSONB;
BEGIN
  FOR rec IN
    SELECT id, shipping_address, billing_address
    FROM   orders
    WHERE  shipping_address_snapshot IS NULL
      AND  shipping_address IS NOT NULL
  LOOP
    -- shipping_address: JSON cast dene, başarısız olursa raw sarma
    BEGIN
      ship_json := rec.shipping_address::JSONB;
    EXCEPTION WHEN invalid_text_representation THEN
      ship_json := jsonb_build_object(
        'raw',          rec.shipping_address,
        'migrated_at',  NOW()
      );
    END;

    -- billing_address: aynı mantık, NULL olabilir
    IF rec.billing_address IS NOT NULL THEN
      BEGIN
        bill_json := rec.billing_address::JSONB;
      EXCEPTION WHEN invalid_text_representation THEN
        bill_json := jsonb_build_object(
          'raw',         rec.billing_address,
          'migrated_at', NOW()
        );
      END;
    ELSE
      bill_json := NULL;
    END IF;

    UPDATE orders
    SET
      shipping_address_snapshot = ship_json,
      billing_address_snapshot  = bill_json
    WHERE id = rec.id;
  END LOOP;
END $$;

-- ============================================================
-- 8. profiles.address DROP
-- (Adres yönetimi addresses tablosuna taşındı, bu kolona artık yazılmıyor)
-- ============================================================

ALTER TABLE profiles DROP COLUMN IF EXISTS address;

-- ============================================================
-- 9. İndeksler
-- ============================================================

-- B2B faturalama sorgularını hızlandırır
CREATE INDEX IF NOT EXISTS idx_addresses_billing_type
  ON addresses (billing_type);

-- VKN/TCKN ile müşteri arama
CREATE INDEX IF NOT EXISTS idx_addresses_tax_number
  ON addresses (tax_number)
  WHERE tax_number IS NOT NULL;

-- Mahalle bazlı sorgular (kargo raporları vb.)
CREATE INDEX IF NOT EXISTS idx_addresses_neighbourhood
  ON addresses (neighbourhood)
  WHERE neighbourhood IS NOT NULL;

-- JSONB snapshot GIN indexleri (alan bazlı sorgular için)
CREATE INDEX IF NOT EXISTS idx_orders_shipping_snapshot
  ON orders USING GIN (shipping_address_snapshot)
  WHERE shipping_address_snapshot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_billing_snapshot
  ON orders USING GIN (billing_address_snapshot)
  WHERE billing_address_snapshot IS NOT NULL;

-- ============================================================
-- 10. COMMENT'lar — kolon niyetini belgele
-- ============================================================

COMMENT ON COLUMN addresses.first_name
  IS 'Alıcı adı (full_name alanından migration 017 ile ayrıştırıldı)';

COMMENT ON COLUMN addresses.last_name
  IS 'Alıcı soyadı (full_name alanından migration 017 ile ayrıştırıldı)';

COMMENT ON COLUMN addresses.neighbourhood
  IS 'Mahalle — kargo etiketinde kullanılır, e-Fatura adres satırına dahil edilir';

COMMENT ON COLUMN addresses.billing_type
  IS 'INDIVIDUAL: bireysel (TCKN), CORPORATE: kurumsal (VKN)';

COMMENT ON COLUMN addresses.tax_number
  IS 'VKN (10 hane) veya TCKN (11 hane) — billing_type CORPORATE ise zorunlu';

COMMENT ON COLUMN addresses.tax_office
  IS 'Vergi dairesi adı — billing_type CORPORATE ise zorunlu (e-Fatura)';

COMMENT ON COLUMN orders.shipping_address_snapshot
  IS 'Sipariş anındaki teslimat adresi JSONB snapshot — kargo entegrasyonu için';

COMMENT ON COLUMN orders.billing_address_snapshot
  IS 'Sipariş anındaki fatura adresi JSONB snapshot — e-Fatura entegrasyonu için';

COMMIT;
