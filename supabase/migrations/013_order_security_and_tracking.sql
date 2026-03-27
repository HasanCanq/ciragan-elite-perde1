-- ============================================================
-- Migration 013: Sipariş Güvenliği, Takip ve ACID Transaction
-- ============================================================
-- Amaç:
--   1. IDOR güvenlik açığı kapatma — ardışık sipariş numarası → rassal
--   2. Üretim + fatura takip kolonları (barcode_data, invoice_url)
--   3. order_items genişletme (pleat_ratio_id, mechanism_direction)
--   4. order_status_history müşteri notu (note, is_customer_visible)
--   5. place_order_atomic RPC — tek DB transaction'da atomik sipariş
--
-- GÜVENLİK NOTU (IDOR):
--   Eski format: CPE-2024-000001  → tahmin edilebilir, sıralı
--   Yeni format: HND-20240315-A3F7C2B1 → 4 milyar kombinasyon, tahmin imkânsız
--   Mevcut siparişlerin order_number'ı KORUNUR (güncellenmez).
--   Trigger'ın sadece YENİ siparişler için çalışacağı teyit edilmiştir.
--
-- ROLLBACK: altta hazır.
-- ============================================================

BEGIN;

-- ============================================================
-- BÖLÜM 1: IDOR FİKSİ — generate_order_number() GÜNCELLEME
-- ============================================================
-- Eski: CPE-2024-000001 (ardışık — IDOR açığı)
-- Yeni: HND-20240315-A3F7C2B1
--       └─ marka kodu + tarih + 8 haneli rassal hex (4 milyar olasılık)
--
-- Mevcut siparişler etkilenmez; trigger sadece NEW kayıtlarda çalışır.
-- Benzersizlik: UNIQUE constraint + çakışma durumunda otomatik yeniden deneme.

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part   TEXT;
  random_part TEXT;
  candidate   TEXT;
  attempts    INT := 0;
  max_attempts INT := 10;
BEGIN
  -- order_number zaten dolu gelirse dokunma (uygulama katmanı set ettiyse)
  IF NEW.order_number IS NOT NULL AND NEW.order_number != '' THEN
    RETURN NEW;
  END IF;

  date_part := TO_CHAR(NOW(), 'YYYYMMDD');

  -- Benzersiz olana kadar dene (çakışma teorik olarak < 1/4 milyar)
  LOOP
    -- encode(gen_random_bytes(4), 'hex') → 8 haneli büyük hex (PostgreSQL pgcrypto)
    random_part := UPPER(encode(gen_random_bytes(4), 'hex'));
    candidate   := 'HND-' || date_part || '-' || random_part;

    -- Benzersizlik kontrolü
    IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = candidate) THEN
      NEW.order_number := candidate;
      RETURN NEW;
    END IF;

    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      -- Kritik: 10 denemede de çakışma olduysa uuid kullan (teorik olarak imkânsız)
      NEW.order_number := 'HND-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                          UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));
      RETURN NEW;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger mevcut, fonksiyon güncellendi — trigger yeniden oluşturulmak zorunda değil.
-- Yine de WHEN koşulunu güncelle: boş string de NULL gibi davransın.
DROP TRIGGER IF EXISTS set_order_number ON orders;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

COMMENT ON FUNCTION generate_order_number() IS
  'IDOR-güvenli sipariş numarası üretir. '
  'Format: HND-YYYYMMDD-XXXXXXXX (X=rassal hex). '
  'Mevcut siparişleri etkilemez.';


-- ============================================================
-- BÖLÜM 2: ORDERS TABLOSU — YENİ KOLONLAR
-- ============================================================

-- 2a. barcode_data — üretim bandı için barkod içeriği
--     Değer: sipariş numarası, müşteri adı, ölçü özetini içerebilir
--     Format: üretim sisteminin belirlediği string/JSON
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS barcode_data TEXT DEFAULT NULL;

COMMENT ON COLUMN orders.barcode_data IS
  'Üretim bandı barkodu için veri. '
  'Genellikle order_number veya üretim sistemi formatında JSON içerir. '
  'Atlanabilir; yoksa order_number barkod olarak kullanılır.';

-- 2b. shipping_tracking_code — kargo takip kodu (tracking_number alias değil, ikincil)
--     tracking_number: kargo şirketi kodu (ör: MNG12345678)
--     shipping_tracking_code: müşteriye gönderilen tracking kodu (farklı olabilir)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_tracking_code TEXT DEFAULT NULL;

COMMENT ON COLUMN orders.shipping_tracking_code IS
  'Müşteriye gönderilen kargo takip kodu. '
  'tracking_number kargo şirketinin iç kodu iken bu alan müşteriye özeldir. '
  'Çoğu durumda aynı değeri taşır.';

-- 2c. invoice_url — fatura PDF/e-Arşiv bağlantısı
--     e-Arşiv faturanın Supabase Storage veya GIB URL'i
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS invoice_url TEXT DEFAULT NULL;

COMMENT ON COLUMN orders.invoice_url IS
  'e-Arşiv / e-Fatura URL''si. '
  'invoice_outbox tablosu üzerinden işlenip, '
  'COMPLETED durumuna gelince bu alana yazılır.';

-- Index: fatura URL'i olan siparişleri hızlı bulmak için
CREATE INDEX IF NOT EXISTS idx_orders_invoice_url
  ON orders(id)
  WHERE invoice_url IS NOT NULL;


-- ============================================================
-- BÖLÜM 3: mechanism_direction ENUM + order_items GENİŞLETME
-- ============================================================

-- 3a. mechanism_direction ENUM (Zebra/Stor zincir yönü)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'mechanism_direction'
  ) THEN
    CREATE TYPE mechanism_direction AS ENUM (
      'sag',   -- Sağ zincir (operatör sağda)
      'sol',   -- Sol zincir (operatör solda)
      'cift'   -- Çift taraflı / merkez
    );
    RAISE NOTICE 'mechanism_direction ENUM oluşturuldu.';
  ELSE
    RAISE NOTICE 'mechanism_direction ENUM zaten mevcut.';
  END IF;
END $$;

-- 3b. order_items.pleat_ratio_id — FK → product_pleats
--     NULL: adet veya m2 türü ürünler (pile seçimi olmayan)
--     ON DELETE SET NULL: pile seçeneği silinirse kalem korunur,
--                         name snapshot'tan okunur
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS pleat_ratio_id UUID DEFAULT NULL
    REFERENCES product_pleats(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN order_items.pleat_ratio_id IS
  'Seçilen pile/kıvrım seçeneği (FK → product_pleats). '
  'NULL = adet veya m2 türü ürün (pile seçimi yok). '
  'ON DELETE SET NULL: pile silinirse kalem korunur.';

-- 3c. pleat_name_snapshot — pile silinse bile görünen ad korunur
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS pleat_name_snapshot TEXT DEFAULT NULL;

COMMENT ON COLUMN order_items.pleat_name_snapshot IS
  'Sipariş anındaki pile adı. pleat_ratio_id NULL olsa bile bu alan silinmez.';

-- 3d. mechanism_direction — zebra/stor için zincir yönü
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS mechanism_direction mechanism_direction DEFAULT NULL;

COMMENT ON COLUMN order_items.mechanism_direction IS
  'Mekanizmalı ürünlerde zincir/operatör yönü. '
  'NULL = yön seçimi gerekmeyen ürünler (tül, aksesuar vb.)';

-- 3e. calculated_price — hesaplama tipi snapshot
--     unit_price zaten sabit kalıyor (sipariş snapshot); bu alan
--     hesaplama mantığını da saklar (m2/mt/adet + kullanılan formül)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS calculation_type_snapshot TEXT DEFAULT NULL;

COMMENT ON COLUMN order_items.calculation_type_snapshot IS
  'Sipariş anındaki hesaplama türü: mt | m2 | adet. '
  'Fiyatlandırma mantığının denetim izi için saklanır.';

-- Index: pile ile sipariş sorgularında
CREATE INDEX IF NOT EXISTS idx_order_items_pleat
  ON order_items(pleat_ratio_id)
  WHERE pleat_ratio_id IS NOT NULL;


-- ============================================================
-- BÖLÜM 4: order_status_history — MÜŞTERİ NOTU
-- ============================================================

-- 4a. note — müşteriye gösterilecek açıkça yazılmış not
--     reason: admin/sistem iç notu (mevcut, değiştirilmedi)
--     note:   müşteriye gösterilebilecek açıklama (yeni)
ALTER TABLE order_status_history
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL;

COMMENT ON COLUMN order_status_history.note IS
  'Müşteriye gösterilebilecek durum açıklaması. '
  'Örn: "Siparişiniz üretime alındı, tahmini teslim 5-7 iş günü." '
  'reason kolonu ise admin/sistem iç notudur.';

-- 4b. is_customer_visible — müşteri panelinde görünürlük kontrolü
ALTER TABLE order_status_history
  ADD COLUMN IF NOT EXISTS is_customer_visible BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN order_status_history.is_customer_visible IS
  'true = müşteri sipariş sayfasında bu kaydı görebilir. '
  'false = yalnızca admin panelinde görünür.';


-- ============================================================
-- BÖLÜM 5: ACID — place_order_atomic RPC
-- ============================================================
-- Tüm sipariş oluşturma adımlarını TEK TRANSACTION içinde yürütür.
-- Herhangi bir adım başarısız olursa PostgreSQL otomatik ROLLBACK yapar.
--
-- Parametre: p_payload JSONB (aşağıda açıklanmıştır)
-- Dönüş    : JSONB { order_id, order_number, success }
--
-- p_payload yapısı:
-- {
--   "user_id":        "uuid",
--   "customer_email": "...",
--   "customer_name":  "...",
--   "customer_phone": "...",    // opsiyonel
--   "shipping_address": "...",
--   "billing_address":  "...",
--   "subtotal":       100.00,
--   "shipping_cost":  0.00,
--   "discount_amount": 0.00,
--   "total_amount":   100.00,
--   "payment_method": "credit_card",
--   "customer_note":  "...",   // opsiyonel
--   "items": [
--     {
--       "product_id": "uuid",
--       "product_name": "Beyaz Tül",
--       "product_slug": "beyaz-tul",
--       "product_image": "url",
--       "width_cm": 200.0,
--       "height_cm": 260.0,
--       "pile_factor": "NORMAL",
--       "pleat_ratio_id": "uuid",       // opsiyonel
--       "pleat_name_snapshot": "1x2.5", // opsiyonel
--       "mechanism_direction": "sag",   // opsiyonel
--       "calculation_type_snapshot": "mt",
--       "area_m2": 0.0,
--       "price_per_m2_snapshot": 120.0,
--       "pile_coefficient": 1.2,
--       "quantity": 1,
--       "unit_price": 624.0,
--       "total_price": 624.0,
--       "stock_deduct_m2": 6.24  // check_and_deduct_stock için
--     }
--   ]
-- }

CREATE OR REPLACE FUNCTION place_order_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- auth.uid() çağrısını güvenli yapar
AS $$
DECLARE
  v_order_id      UUID;
  v_order_number  TEXT;
  v_item          JSONB;
  v_item_id       UUID;
  v_stock_error   TEXT;
BEGIN
  -- ── 1. SİPARİŞ KAYDI ──────────────────────────────────────────────────────
  INSERT INTO orders (
    user_id,
    customer_email,
    customer_name,
    customer_phone,
    shipping_address,
    billing_address,
    subtotal,
    shipping_cost,
    discount_amount,
    total_amount,
    status,
    payment_method,
    customer_note
  ) VALUES (
    (p_payload->>'user_id')::UUID,
    p_payload->>'customer_email',
    p_payload->>'customer_name',
    NULLIF(p_payload->>'customer_phone', ''),
    p_payload->>'shipping_address',
    COALESCE(p_payload->>'billing_address', p_payload->>'shipping_address'),
    (p_payload->>'subtotal')::DECIMAL,
    COALESCE((p_payload->>'shipping_cost')::DECIMAL, 0),
    COALESCE((p_payload->>'discount_amount')::DECIMAL, 0),
    (p_payload->>'total_amount')::DECIMAL,
    'PENDING',
    p_payload->>'payment_method',
    NULLIF(p_payload->>'customer_note', '')
  )
  RETURNING id, order_number
  INTO v_order_id, v_order_number;

  -- ── 2. SİPARİŞ KALEMLERİ ──────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      product_slug,
      product_image,
      width_cm,
      height_cm,
      pile_factor,
      pleat_ratio_id,
      pleat_name_snapshot,
      mechanism_direction,
      calculation_type_snapshot,
      area_m2,
      price_per_m2_snapshot,
      pile_coefficient,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      v_item->>'product_slug',
      NULLIF(v_item->>'product_image', ''),
      (v_item->>'width_cm')::DECIMAL,
      (v_item->>'height_cm')::DECIMAL,
      (v_item->>'pile_factor')::pile_factor,
      NULLIF(v_item->>'pleat_ratio_id', '')::UUID,
      NULLIF(v_item->>'pleat_name_snapshot', ''),
      NULLIF(v_item->>'mechanism_direction', '')::mechanism_direction,
      NULLIF(v_item->>'calculation_type_snapshot', ''),
      (v_item->>'area_m2')::DECIMAL,
      (v_item->>'price_per_m2_snapshot')::DECIMAL,
      (v_item->>'pile_coefficient')::DECIMAL,
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'total_price')::DECIMAL
    );

    -- ── 3. STOK DÜŞÜRME ─────────────────────────────────────────────────────
    -- check_and_deduct_stock zaten RAISE EXCEPTION kullandığı için
    -- herhangi bir stok hatası tüm transaction'ı otomatik ROLLBACK yapar.
    PERFORM check_and_deduct_stock(
      (v_item->>'product_id')::UUID,
      (v_item->>'stock_deduct_m2')::DECIMAL
    );

  END LOOP;

  -- ── 4. İLK DURUM TARİHÇESİ ────────────────────────────────────────────────
  INSERT INTO order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by_role,
    note,
    is_customer_visible
  ) VALUES (
    v_order_id,
    NULL,           -- ilk kayıt; önceki durum yok
    'PENDING',
    'system',
    'Siparişiniz alındı. Ödeme bekleniyor.',
    true            -- müşteriye göster
  );

  -- ── 5. BAŞARI DÖNÜŞÜ ──────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',      true,
    'order_id',     v_order_id,
    'order_number', v_order_number
  );

EXCEPTION
  -- PostgreSQL otomatik ROLLBACK yapar; biz sadece hata mesajını iletiyoruz
  WHEN OTHERS THEN
    RAISE WARNING '[place_order_atomic] Hata: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error',   SQLERRM,
      'code',    SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION place_order_atomic(JSONB) IS
  'Sipariş + kalemler + stok düşürme + ilk durum tarihçesini '
  'TEK TRANSACTION içinde atomik olarak yürütür. '
  'Herhangi bir adım başarısız olursa PostgreSQL otomatik ROLLBACK yapar. '
  'SECURITY DEFINER ile çalışır.';

-- RPC erişim izni: yalnızca authenticated kullanıcılar
GRANT EXECUTE ON FUNCTION place_order_atomic(JSONB) TO authenticated;


-- ============================================================
-- BÖLÜM 6: check_and_deduct_stock DECIMAL DESTEĞI
-- ============================================================
-- Mevcut fonksiyon INTEGER alıyor; m2 hesaplama için DECIMAL gerekiyor.
-- Mevcut INTEGER versiyonu korunur (geriye uyumluluk).
-- Yeni DECIMAL versiyonu overload olarak eklenir.

CREATE OR REPLACE FUNCTION check_and_deduct_stock(
  p_product_id UUID,
  p_quantity   DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_stock DECIMAL;
BEGIN
  -- FOR UPDATE SKIP LOCKED: eş zamanlı istekler için row-level lock
  SELECT stock_quantity INTO v_current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', p_product_id;
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Yetersiz stok. Ürün: %, Mevcut: %, İstenen: %',
      p_product_id, v_current_stock, p_quantity;
  END IF;

  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_deduct_stock(UUID, DECIMAL) TO authenticated;


-- ============================================================
-- BÖLÜM 7: DOĞRULAMA
-- ============================================================

DO $$
DECLARE col_count INT;
BEGIN
  -- orders yeni kolonlar
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'orders'
    AND column_name IN ('barcode_data', 'shipping_tracking_code', 'invoice_url');
  IF col_count = 3 THEN
    RAISE NOTICE 'orders: 3 yeni kolon eklendi ✓';
  ELSE
    RAISE WARNING 'orders: beklenen 3 kolon, bulunan %', col_count;
  END IF;

  -- order_items yeni kolonlar
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'order_items'
    AND column_name IN ('pleat_ratio_id', 'mechanism_direction',
                        'pleat_name_snapshot', 'calculation_type_snapshot');
  IF col_count = 4 THEN
    RAISE NOTICE 'order_items: 4 yeni kolon eklendi ✓';
  ELSE
    RAISE WARNING 'order_items: beklenen 4 kolon, bulunan %', col_count;
  END IF;

  -- order_status_history yeni kolonlar
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'order_status_history'
    AND column_name IN ('note', 'is_customer_visible');
  IF col_count = 2 THEN
    RAISE NOTICE 'order_status_history: 2 yeni kolon eklendi ✓';
  ELSE
    RAISE WARNING 'order_status_history: beklenen 2 kolon, bulunan %', col_count;
  END IF;

  RAISE NOTICE 'Migration 013 tamamlandı.';
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK (acil geri alma)
-- ============================================================
-- BEGIN;
--   DROP FUNCTION IF EXISTS place_order_atomic(JSONB);
--   DROP FUNCTION IF EXISTS check_and_deduct_stock(UUID, DECIMAL);
--   ALTER TABLE order_status_history DROP COLUMN IF EXISTS is_customer_visible;
--   ALTER TABLE order_status_history DROP COLUMN IF EXISTS note;
--   ALTER TABLE order_items DROP COLUMN IF EXISTS calculation_type_snapshot;
--   ALTER TABLE order_items DROP COLUMN IF EXISTS mechanism_direction;
--   ALTER TABLE order_items DROP COLUMN IF EXISTS pleat_name_snapshot;
--   ALTER TABLE order_items DROP COLUMN IF EXISTS pleat_ratio_id;
--   ALTER TABLE orders DROP COLUMN IF EXISTS invoice_url;
--   ALTER TABLE orders DROP COLUMN IF EXISTS shipping_tracking_code;
--   ALTER TABLE orders DROP COLUMN IF EXISTS barcode_data;
--   DROP INDEX IF EXISTS idx_orders_invoice_url;
--   DROP INDEX IF EXISTS idx_order_items_pleat;
--   DROP TYPE  IF EXISTS mechanism_direction;
-- COMMIT;
