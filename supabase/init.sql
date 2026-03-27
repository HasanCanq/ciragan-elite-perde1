-- ============================================================
-- ÇIRAĞAN ELITE PERDE — MASTER INIT SCHEMA
-- ============================================================
-- Versiyon: 2.0 (tüm migration'lar birleştirildi: 000–010)
-- Amaç   : Yeni Supabase projesini tek çalıştırmayla ayağa kaldır
--
-- KULLANIM:
--   Supabase Dashboard → SQL Editor → Yeni sorgu → Yapıştır → Run
--
-- ÇALIŞMA SIRASI (bağımlılık sırasına göre):
--   1. ENUM TİPLERİ
--   2. TEMEL FONKSİYONLAR (trigger'lardan önce gelmeli)
--   3. BAĞIMSIZ TABLOLAR (profiles, categories, products, store_settings, addresses)
--   4. BAĞIMLI TABLOLAR (orders → order_items → carts → cart_items → reviews → payment_transactions)
--   5. GEÇMİŞ & OUTBOX TABLOLARI (order_status_history, cargo_outbox)
--   6. YASAL & FATURA TABLOLARI (legal_document_versions, order_legal_logs, invoice_outbox)
--   7. RLS POLİTİKALARI (tüm tablolar)
--   8. STORAGE (ürün görselleri bucket'ı)
--   9. RPC FONKSİYONLARI (update_order_status_with_history, claim_* vb.)
--  10. BAŞLANGIÇ VERİLERİ (seed data)
-- ============================================================


-- ============================================================
-- BÖLÜM 1: ENUM TİPLERİ
-- ============================================================

-- Kullanıcı rolleri
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');

-- Sipariş durumları (tüm değerler dahil — migration 008'deki genişletmeler)
CREATE TYPE order_status AS ENUM (
  'PENDING',          -- Ödeme bekleniyor
  'PAID',             -- Ödeme alındı
  'CONFIRMED',        -- Sipariş onaylandı
  'IN_PRODUCTION',    -- Üretimde
  'ON_HOLD',          -- Beklemede (kumaş eksikliği vb.)
  'READY_TO_SHIP',    -- Kargoya hazır
  'SHIPPED',          -- Kargoya verildi
  'IN_TRANSIT',       -- Taşımada
  'DELIVERED',        -- Teslim edildi
  'DELIVERY_FAILED',  -- Teslimat başarısız
  'RETURN_REQUESTED', -- İade talebi
  'REFUNDED',         -- İade edildi (terminal)
  'CANCELLED',        -- İptal edildi (terminal)
  'PROCESSING'        -- Legacy; yeni kayıtlarda kullanılmaz
);

-- Perde kıvrım faktörü (pile sıklığı)
CREATE TYPE pile_factor AS ENUM ('SEYREK', 'NORMAL', 'SIK');

-- Ödeme işlem event tipleri (migration 007)
CREATE TYPE payment_event_type AS ENUM (
  'PAYMENT_INITIATED',
  'THREEDS_INIT_SUCCESS',
  'THREEDS_INIT_FAILED',
  'CALLBACK_RECEIVED',
  'THREEDS_AUTH_SUCCESS',
  'THREEDS_AUTH_FAILED',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'AMOUNT_MISMATCH'
);

-- Kargo outbox durum tipi (migration 009)
CREATE TYPE cargo_outbox_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- Yasal belge türleri (migration 010)
CREATE TYPE legal_document_type AS ENUM (
  'ON_BILGILENDIRME',   -- Ön Bilgilendirme Formu
  'MESAFELI_SATIS',     -- Mesafeli Satış Sözleşmesi
  'KVKK_AYDINLATMA',    -- KVKK Aydınlatma Metni
  'CEREZ_POLITIKASI'    -- Çerez Politikası
);

-- Fatura outbox durum tipi (migration 010)
CREATE TYPE invoice_outbox_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- Fatura türleri (migration 010)
CREATE TYPE invoice_type AS ENUM (
  'E_ARSIV',     -- e-Arşiv Fatura (B2C)
  'E_FATURA',    -- e-Fatura (B2B, VKN zorunlu)
  'E_IRSALIYE'   -- e-İrsaliye
);


-- ============================================================
-- BÖLÜM 2: TEMEL FONKSİYONLAR
-- (Tablo ve trigger oluşturulmadan önce tanımlanmalı)
-- ============================================================

-- updated_at kolonunu otomatik güncelleyen genel trigger fonksiyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Yeni kullanıcı kayıt olduğunda otomatik profil oluştur (auth.users trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin kontrolü: mevcut kullanıcı ADMIN rolüne sahip mi?
-- SECURITY DEFINER: profiles tablosuna RLS'yi atlayarak erişir
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin() IS 'Mevcut kullanıcının ADMIN rolüne sahip olup olmadığını kontrol eder (RLS policy''lerinde kullanılır)';

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Sipariş numarası üreteci: CPE-YYYY-NNNNNN formatı
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_part  TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  SELECT LPAD(COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 10) AS INTEGER)
  ), 0) + 1, 6, '0')
  INTO seq_part
  FROM orders
  WHERE order_number LIKE 'CPE-' || year_part || '-%';

  NEW.order_number := 'CPE-' || year_part || '-' || seq_part;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Perde pile katsayısı döndüren yardımcı fonksiyon (IMMUTABLE — cache'lenebilir)
CREATE OR REPLACE FUNCTION get_pile_coefficient(pile pile_factor)
RETURNS DECIMAL AS $$
BEGIN
  CASE pile
    WHEN 'SEYREK' THEN RETURN 1.0;
    WHEN 'NORMAL' THEN RETURN 1.2;
    WHEN 'SIK'    THEN RETURN 1.3;
    ELSE RETURN 1.0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Perde fiyatı hesaplayan yardımcı fonksiyon
CREATE OR REPLACE FUNCTION calculate_curtain_price(
  width_cm          DECIMAL,
  height_cm         DECIMAL,
  pile              pile_factor,
  base_price_per_m2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  area_m2     DECIMAL;
  coefficient DECIMAL;
BEGIN
  area_m2     := (width_cm * height_cm) / 10000;
  coefficient := get_pile_coefficient(pile);
  RETURN ROUND(area_m2 * base_price_per_m2 * coefficient, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sipariş toplamını order_items değişiminde güncelleyen fonksiyon
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET
    subtotal     = (SELECT COALESCE(SUM(total_price), 0) FROM order_items WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)),
    total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM order_items WHERE order_id = COALESCE(NEW.order_id, OLD.order_id))
                   + COALESCE(orders.shipping_cost,  0)
                   - COALESCE(orders.discount_amount, 0)
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Tek varsayılan adres garantisi (kullanıcı başına)
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE addresses
    SET is_default = FALSE
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stok kontrolü ve düşme fonksiyonu
CREATE OR REPLACE FUNCTION check_and_deduct_stock(
  p_product_id UUID,
  p_quantity   INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', p_product_id;
  END IF;

  IF current_stock < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at     = NOW()
  WHERE id = p_product_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stok geri ekleme (sipariş iptalinde)
CREATE OR REPLACE FUNCTION restore_stock(
  p_product_id UUID,
  p_quantity   INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at     = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcı sepetini temizle (sipariş tamamlandıktan sonra)
CREATE OR REPLACE FUNCTION clear_user_cart(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM cart_items
  WHERE cart_id IN (
    SELECT id FROM carts WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- INSERT-ONLY legal_log koruma fonksiyonu (migration 010)
CREATE OR REPLACE FUNCTION prevent_legal_log_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'order_legal_logs tablosu insert-only''dur, kayıtlar değiştirilemez';
END;
$$;

-- Store settings updated_at trigger fonksiyonu
CREATE OR REPLACE FUNCTION update_store_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- BÖLÜM 3: BAĞIMSIZ TABLOLAR
-- (Diğer tablolara foreign key içermez)
-- ============================================================

-- ─── PROFILES ───────────────────────────────────────────────
-- auth.users ile 1:1 ilişki. Supabase Auth trigger'ı tarafından otomatik oluşturulur.
CREATE TABLE profiles (
  id                      UUID         REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                   TEXT         NOT NULL,
  full_name               TEXT,
  phone                   TEXT,
  address                 TEXT,
  role                    user_role    DEFAULT 'USER' NOT NULL,
  -- Ek profil alanları (migration 005)
  birth_date              DATE,
  is_commercial_allowed   BOOLEAN      DEFAULT false,
  is_terms_accepted       BOOLEAN      DEFAULT false,
  is_whatsapp_allowed     BOOLEAN      DEFAULT false,
  created_at              TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- auth.users'a yeni kayıt gelince profiles tablosuna otomatik satır ekle
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─── CATEGORIES ─────────────────────────────────────────────
-- Self-referencing FK ile iki seviyeli hiyerarşi desteklenir.
-- Örn: Tül (kök) → Keten / Düz / Brode (alt)
-- parent_id NULL → kök (ana) kategori
-- ON DELETE SET NULL → üst silinirse alt korunur, parent_id = NULL olur
CREATE TABLE categories (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT         NOT NULL,
  slug          TEXT         UNIQUE NOT NULL,
  description   TEXT,
  image_url     TEXT,
  display_order INT          DEFAULT 0,
  is_active     BOOLEAN      DEFAULT true NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  -- Self-referencing hierarchy (migration 011)
  parent_id     UUID         DEFAULT NULL
                  REFERENCES categories(id)
                  ON DELETE SET NULL
                  DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT categories_no_self_parent CHECK (id <> parent_id)
);

CREATE INDEX idx_categories_slug      ON categories(slug);
CREATE INDEX idx_categories_active    ON categories(is_active) WHERE is_active = true;
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_root      ON categories(display_order) WHERE parent_id IS NULL;


-- ─── PRODUCTS ───────────────────────────────────────────────
CREATE TABLE products (
  id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT          NOT NULL,
  slug                TEXT          UNIQUE NOT NULL,
  description         TEXT,
  short_description   TEXT,
  category_id         UUID          REFERENCES categories(id) ON DELETE SET NULL,
  ozellikler          TEXT,                                -- Ek özellikler/malzeme bilgisi (migration 005)
  -- Fiyat hesaplama (migration 012)
  calculation_type    calculation_type NOT NULL DEFAULT 'adet', -- mt | m2 | adet
  base_price          DECIMAL(10,2) NOT NULL,              -- Birim fiyat: TL/mt | TL/m² | TL/adet
  min_width_cm        INTEGER       DEFAULT NULL           -- m2 türü: min. genişlik (cm)
                        CHECK (min_width_cm IS NULL OR min_width_cm > 0),
  min_area_m2         DECIMAL(6,3)  DEFAULT NULL           -- m2 türü: min. alan (m²)
                        CHECK (min_area_m2 IS NULL OR min_area_m2 > 0),
  images              TEXT[]        DEFAULT '{}',
  is_published        BOOLEAN       DEFAULT false NOT NULL,
  in_stock            BOOLEAN       DEFAULT true  NOT NULL,
  stock_quantity      INTEGER       DEFAULT 999   NOT NULL, -- Stok adedi (migration 001/005)
  meta_title          TEXT,
  meta_description    TEXT,
  created_at          TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_products_slug      ON products(slug);
CREATE INDEX idx_products_category  ON products(category_id);
CREATE INDEX idx_products_published ON products(is_published) WHERE is_published = true;
CREATE INDEX idx_products_stock     ON products(stock_quantity) WHERE stock_quantity > 0;
CREATE INDEX idx_products_calc_type ON products(calculation_type);


-- ─── PRODUCT_PLEATS ──────────────────────────────────────────
-- Metre işi (mt) ürünler için pile/kıvrım çarpanları (migration 012)
CREATE TABLE product_pleats (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id    UUID          NOT NULL
                  REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT          NOT NULL,           -- "1x2.5 Normal Pile"
  multiplier    DECIMAL(4,2)  NOT NULL,           -- Kumaş çarpanı: 2.5
  display_order INT           DEFAULT 0,
  is_active     BOOLEAN       DEFAULT true NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  CONSTRAINT product_pleats_unique_multiplier
    UNIQUE (product_id, multiplier),
  CONSTRAINT product_pleats_multiplier_range
    CHECK (multiplier BETWEEN 1.0 AND 5.0)
);

CREATE INDEX idx_product_pleats_product_id ON product_pleats(product_id);
CREATE INDEX idx_product_pleats_active
  ON product_pleats(product_id, display_order)
  WHERE is_active = true;


-- ─── STORE_SETTINGS ─────────────────────────────────────────
-- Tek satırlı global mağaza ayarları tablosu (migration 003)
CREATE TABLE store_settings (
  id                       UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name                VARCHAR(255)  NOT NULL DEFAULT 'Çırağan Elite Perde',
  support_email            VARCHAR(255)  NOT NULL DEFAULT 'info@ciraganeliteperde.com',
  support_phone            VARCHAR(20)   NOT NULL DEFAULT '0532 295 95 86',
  free_shipping_threshold  NUMERIC(10,2) NOT NULL DEFAULT 5000.00,
  shipping_cost            NUMERIC(10,2) NOT NULL DEFAULT 150.00,
  maintenance_mode         BOOLEAN       NOT NULL DEFAULT FALSE,
  maintenance_message      TEXT,
  created_at               TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  updated_at               TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

-- Tek satır garantisi
CREATE UNIQUE INDEX single_settings_row ON store_settings ((id IS NOT NULL));

CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW EXECUTE FUNCTION update_store_settings_timestamp();

COMMENT ON TABLE store_settings IS 'Global mağaza ayarları — tek satır tablosu';


-- ─── ADDRESSES ──────────────────────────────────────────────
-- Kullanıcı adres defteri (migration 002)
CREATE TABLE addresses (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        VARCHAR(100) NOT NULL,        -- "Ev", "İş", "Diğer"
  full_name    VARCHAR(255) NOT NULL,
  phone        VARCHAR(20)  NOT NULL,
  address_line TEXT         NOT NULL,
  city         VARCHAR(100) NOT NULL,
  district     VARCHAR(100) NOT NULL,
  postal_code  VARCHAR(10),
  is_default   BOOLEAN      DEFAULT FALSE,
  created_at   TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ensure_single_default
  AFTER INSERT OR UPDATE OF is_default ON addresses
  FOR EACH ROW WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION ensure_single_default_address();

CREATE INDEX idx_addresses_user_id   ON addresses(user_id);
CREATE INDEX idx_addresses_is_default ON addresses(user_id, is_default);


-- ─── LEGAL_DOCUMENT_VERSIONS ────────────────────────────────
-- Yasal belge versiyonları: append-only, SHA-256 içerik hash'i ile (migration 010)
CREATE TABLE legal_document_versions (
  id             UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type  legal_document_type NOT NULL,
  version        VARCHAR(20)         NOT NULL,  -- Örn: "v2.1", "2024-03"
  content_hash   CHAR(64)            NOT NULL,  -- SHA-256 hex digest
  content_url    TEXT,                          -- Supabase Storage URL
  is_active      BOOLEAN             NOT NULL DEFAULT false,
  published_at   TIMESTAMPTZ         NOT NULL DEFAULT now(),
  created_by     UUID                REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT uq_legal_doc_version UNIQUE (document_type, version),
  CONSTRAINT uq_legal_doc_hash    UNIQUE (content_hash)
);

-- Belge tipinde en fazla bir aktif versiyon olabilir
CREATE UNIQUE INDEX uq_one_active_per_doc_type
  ON legal_document_versions (document_type)
  WHERE is_active = true;


-- ============================================================
-- BÖLÜM 4: BAĞIMLI TABLOLAR (Foreign Key'e göre sıralı)
-- ============================================================

-- ─── ORDERS ─────────────────────────────────────────────────
-- Tüm kolonlar dahil (migration 008: kargo, üretim takip alanları + migration 009: deadline)
CREATE TABLE orders (
  id                       UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number             TEXT          UNIQUE NOT NULL,
  user_id                  UUID          REFERENCES profiles(id) ON DELETE SET NULL,

  -- Müşteri bilgileri (snapshot — profil değişse sipariş etkilenmez)
  customer_email           TEXT          NOT NULL,
  customer_name            TEXT          NOT NULL,
  customer_phone           TEXT,
  shipping_address         TEXT          NOT NULL,
  billing_address          TEXT,

  -- Fiyatlandırma
  subtotal                 DECIMAL(12,2) NOT NULL,
  shipping_cost            DECIMAL(10,2) DEFAULT 0,
  discount_amount          DECIMAL(10,2) DEFAULT 0,
  total_amount             DECIMAL(12,2) NOT NULL,

  -- Durum
  status                   order_status  DEFAULT 'PENDING' NOT NULL,

  -- Notlar
  customer_note            TEXT,
  admin_note               TEXT,

  -- Ödeme
  payment_method           TEXT,
  payment_reference        TEXT,

  -- Kargo takip bilgileri (migration 008)
  cargo_company            TEXT,
  tracking_number          TEXT,
  tracking_url             TEXT,
  estimated_delivery       DATE,
  hold_reason              TEXT,

  -- Üretim SLA deadline (migration 009)
  production_deadline      TIMESTAMPTZ,

  -- Durum bazlı timestamps (migration 008)
  confirmed_at             TIMESTAMPTZ,
  production_started_at    TIMESTAMPTZ,
  production_completed_at  TIMESTAMPTZ,
  refunded_at              TIMESTAMPTZ,

  -- Genel timestamps
  created_at               TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  updated_at               TIMESTAMPTZ   DEFAULT NOW() NOT NULL,
  paid_at                  TIMESTAMPTZ,
  shipped_at               TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ
);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- order_number boşsa otomatik üret
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

CREATE INDEX idx_orders_user    ON orders(user_id);
CREATE INDEX idx_orders_status  ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);


-- ─── ORDER_ITEMS ─────────────────────────────────────────────
-- Kişiselleştirilmiş perde kalemleri (ölçü + pile snapshot)
CREATE TABLE order_items (
  id                       UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                 UUID          REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id               UUID          REFERENCES products(id) ON DELETE SET NULL,

  -- Ürün snapshot (sipariş anındaki veriler — ürün sonradan değişse bile korunur)
  product_name             TEXT          NOT NULL,
  product_slug             TEXT          NOT NULL,
  product_image            TEXT,

  -- Kişiselleştirme parametreleri
  width_cm                 DECIMAL(8,2)  NOT NULL,
  height_cm                DECIMAL(8,2)  NOT NULL,
  pile_factor              pile_factor   NOT NULL,

  -- Fiyat hesaplama detayları
  area_m2                  DECIMAL(10,4) NOT NULL,
  price_per_m2_snapshot    DECIMAL(10,2) NOT NULL,  -- Sipariş anındaki m² fiyatı
  pile_coefficient         DECIMAL(4,2)  NOT NULL,  -- Uygulanan katsayı (1.0, 1.2, 1.3)

  -- Miktar & tutar
  quantity                 INT           DEFAULT 1 NOT NULL CHECK (quantity > 0),
  unit_price               DECIMAL(12,2) NOT NULL,   -- Tek ürün toplam fiyatı
  total_price              DECIMAL(12,2) NOT NULL,   -- unit_price × quantity

  created_at               TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_order_total_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_order_total();

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);


-- ─── CARTS ──────────────────────────────────────────────────
CREATE TABLE carts (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_carts_user ON carts(user_id);


-- ─── CART_ITEMS ──────────────────────────────────────────────
CREATE TABLE cart_items (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id     UUID        REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
  product_id  UUID        REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  width_cm    INTEGER     NOT NULL CHECK (width_cm >= 50  AND width_cm  <= 600),
  height_cm   INTEGER     NOT NULL CHECK (height_cm >= 50 AND height_cm <= 400),
  pile_factor pile_factor NOT NULL,
  quantity    INTEGER     DEFAULT 1 NOT NULL CHECK (quantity > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Aynı ürün + aynı ölçü + aynı pile için tek satır
  UNIQUE (cart_id, product_id, width_cm, height_cm, pile_factor)
);

CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_cart_items_cart    ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);


-- ─── REVIEWS ────────────────────────────────────────────────
-- Ürün değerlendirmeleri (migration 006)
CREATE TABLE reviews (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID        REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating     INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE (product_id, user_id)   -- Kullanıcı başına ürün başına bir yorum
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user    ON reviews(user_id);
CREATE INDEX idx_reviews_rating  ON reviews(product_id, rating);


-- ─── PAYMENT_TRANSACTIONS ───────────────────────────────────
-- Her Iyzico/ödeme olayını kalıcı olarak kaydeder (migration 007)
CREATE TABLE payment_transactions (
  id               UUID                  DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         UUID                  REFERENCES orders(id) ON DELETE SET NULL,
  user_id          UUID                  REFERENCES profiles(id) ON DELETE SET NULL,
  event_type       payment_event_type    NOT NULL,

  -- Iyzico verileri
  payment_id       TEXT,               -- Iyzico paymentId
  conversation_id  TEXT,               -- Iyzico conversationId (= order.id)
  md_status        TEXT,               -- 3D Secure mdStatus ("1" = başarılı)
  error_code       TEXT,
  error_message    TEXT,
  auth_code        TEXT,               -- Başarılı ödeme auth kodu

  -- Tutar bilgileri
  expected_amount  DECIMAL(12,2),      -- Sipariş total_amount
  paid_amount      DECIMAL(12,2),      -- Iyzico paidPrice
  currency         TEXT                DEFAULT 'TRY',

  -- Metadata
  ip_address       TEXT,
  raw_response     JSONB,              -- Iyzico ham yanıtı (kart bilgisi HARİÇ)

  created_at       TIMESTAMPTZ         DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_pt_order_id    ON payment_transactions(order_id);
CREATE INDEX idx_pt_user_id     ON payment_transactions(user_id);
CREATE INDEX idx_pt_event_type  ON payment_transactions(event_type);
CREATE INDEX idx_pt_payment_id  ON payment_transactions(payment_id);
CREATE INDEX idx_pt_created_at  ON payment_transactions(created_at DESC);


-- ─── ORDER_STATUS_HISTORY ───────────────────────────────────
-- Sipariş durum değişikliklerinin denetim izi (migration 008)
CREATE TABLE order_status_history (
  id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id            UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status     order_status,
  new_status          order_status  NOT NULL,
  changed_by_user_id  UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role     TEXT          NOT NULL DEFAULT 'admin'
                        CHECK (changed_by_role IN ('admin', 'customer', 'system')),
  reason              TEXT,
  created_at          TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_order_status_history_order_id   ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at DESC);


-- ─── CARGO_OUTBOX ────────────────────────────────────────────
-- Transactional outbox pattern: kargo API gönderimlerini güvenilir yapar (migration 009)
CREATE TABLE cargo_outbox (
  id            UUID                DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      UUID                NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payload       JSONB               NOT NULL,              -- Kargo API payload
  status        cargo_outbox_status NOT NULL DEFAULT 'PENDING',
  retry_count   INTEGER             NOT NULL DEFAULT 0,
  max_retries   INTEGER             NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  last_error    TEXT,                                      -- Son hata mesajı
  barcode       TEXT,                                      -- Başarılı gönderim barkodu
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cargo_outbox_status_retry
  ON cargo_outbox(status, next_retry_at)
  WHERE status = 'PENDING';
CREATE INDEX idx_cargo_outbox_order_id ON cargo_outbox(order_id);


-- ─── ORDER_LEGAL_LOGS ───────────────────────────────────────
-- KVKK + Mesafeli Satış uyum kaydı. INSERT-ONLY tablo (migration 010)
CREATE TABLE order_legal_logs (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id             UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Dijital ayak izi
  ip_address           INET        NOT NULL,         -- PostgreSQL inet: IPv4/IPv6
  user_agent           TEXT        NOT NULL,
  consented_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Onaylanan belgeler: [{document_type, version_id, content_hash}]
  consented_documents  JSONB       NOT NULL DEFAULT '[]',

  -- Ek bağlam (checkout_session_id, payment_method vb.)
  metadata             JSONB       NOT NULL DEFAULT '{}',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_order_legal_log UNIQUE (order_id)  -- Sipariş başına bir kayıt
);

-- INSERT-ONLY koruma: güncelleme ve silmeyi engelle
CREATE TRIGGER trg_immutable_legal_log
  BEFORE UPDATE OR DELETE ON order_legal_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_legal_log_modification();

CREATE INDEX idx_order_legal_logs_order_id    ON order_legal_logs(order_id);
CREATE INDEX idx_order_legal_logs_user_id     ON order_legal_logs(user_id);
CREATE INDEX idx_order_legal_logs_consented_at ON order_legal_logs(consented_at DESC);


-- ─── INVOICE_OUTBOX ──────────────────────────────────────────
-- E-fatura gönderim kuyruğu: Paraşüt/Uyumsoft entegratörü (migration 010)
CREATE TABLE invoice_outbox (
  id               UUID                  DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         UUID                  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Fatura parametreleri
  invoice_type     invoice_type          NOT NULL DEFAULT 'E_ARSIV',
  provider         TEXT                  NOT NULL DEFAULT 'parasut',  -- 'parasut' | 'uyumsoft'
  invoice_data     JSONB                 NOT NULL,     -- Müşteri + kalemler

  -- Durum yönetimi
  status           invoice_outbox_status NOT NULL DEFAULT 'PENDING',
  retry_count      INTEGER               NOT NULL DEFAULT 0,
  max_retries      INTEGER               NOT NULL DEFAULT 4,
  next_retry_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  last_error       TEXT,

  -- Başarı durumunda doldurulan alanlar
  invoice_number   TEXT,        -- Entegratörden dönen fatura numarası
  invoice_uuid     TEXT,        -- GIB UUID
  invoice_pdf_url  TEXT,        -- PDF indirme linki
  invoice_html_url TEXT,        -- HTML görüntüleme linki
  issued_at        TIMESTAMPTZ,
  email_sent_at    TIMESTAMPTZ,

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Aynı sipariş için aynı tipte iki fatura oluşmasın
  CONSTRAINT uq_order_invoice_type UNIQUE (order_id, invoice_type)
);

CREATE INDEX idx_invoice_outbox_status_retry
  ON invoice_outbox(status, next_retry_at)
  WHERE status = 'PENDING';
CREATE INDEX idx_invoice_outbox_order_id ON invoice_outbox(order_id);


-- ============================================================
-- BÖLÜM 5: RLS POLİTİKALARI
-- (is_admin() fonksiyonu zaten tanımlı — yukarıda)
-- Tüm tablolar için nihai politikalar (migration 005 baz alınarak)
-- ============================================================

-- ─── PROFILES ───────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT USING (is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE USING (is_admin());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ─── CATEGORIES ─────────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view categories"
  ON categories FOR SELECT USING (true);

CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE USING (is_admin());


-- ─── PRODUCTS ───────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Anonim/authenticated kullanıcılar SADECE yayımdaki ürünleri görebilir.
-- is_published = false olan taslak ürünler PostgREST API'sinden gizlenir.
CREATE POLICY "Public can view published products"
  ON products FOR SELECT USING (is_published = true);

-- Admin tüm ürünleri (taslaklar dahil) görebilir
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT USING (is_admin());

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE USING (is_admin());


-- ─── STORE_SETTINGS ─────────────────────────────────────────
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read settings"
  ON store_settings FOR SELECT USING (true);

CREATE POLICY "Admins can update settings"
  ON store_settings FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());


-- ─── ADDRESSES ──────────────────────────────────────────────
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
  ON addresses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE USING (auth.uid() = user_id);


-- ─── ORDERS ─────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT USING (is_admin());

-- Sadece giriş yapmış kullanıcılar sipariş oluşturabilir.
-- user_id IS NULL misafir checkout senaryosu artık desteklenmiyor (güvenlik riski).
CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());


-- ─── ORDER_ITEMS ─────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT USING (is_admin());

-- Sadece kendi siparişine ait kalemleri ekleyebilir (user_id IS NULL açığı kapatıldı)
CREATE POLICY "Users can insert own order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND auth.uid() IS NOT NULL
    )
  );


-- ─── CARTS ──────────────────────────────────────────────────
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart"
  ON carts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cart"
  ON carts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart"
  ON carts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart"
  ON carts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all carts"
  ON carts FOR SELECT USING (is_admin());


-- ─── CART_ITEMS ──────────────────────────────────────────────
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all cart items"
  ON cart_items FOR SELECT USING (is_admin());


-- ─── REVIEWS ────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "Users can insert own reviews"
  ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins full access on reviews"
  ON reviews FOR ALL USING (is_admin());


-- ─── PAYMENT_TRANSACTIONS ───────────────────────────────────
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions FOR SELECT USING (auth.uid() = user_id);

-- Adminler tüm işlemlere tam erişim
CREATE POLICY "Admins full access to payment transactions"
  ON payment_transactions FOR ALL USING (is_admin());

-- Not: service_role key RLS'yi bypass eder — INSERT için ekstra policy gerekmez


-- ─── ORDER_STATUS_HISTORY ───────────────────────────────────
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order status history"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage order status history"
  ON order_status_history FOR ALL USING (is_admin());


-- ─── CARGO_OUTBOX ────────────────────────────────────────────
ALTER TABLE cargo_outbox ENABLE ROW LEVEL SECURITY;

-- Kargo outbox sadece admin/service_role tarafından erişilebilir
CREATE POLICY "Admins can manage cargo outbox"
  ON cargo_outbox FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));


-- ─── LEGAL_DOCUMENT_VERSIONS ────────────────────────────────
ALTER TABLE legal_document_versions ENABLE ROW LEVEL SECURITY;

-- Herkes aktif belgeleri okuyabilir (checkout'ta göstermek için)
CREATE POLICY "Public can read active legal documents"
  ON legal_document_versions FOR SELECT USING (is_active = true);

CREATE POLICY "Admins full access legal documents"
  ON legal_document_versions FOR ALL USING (is_admin());


-- ─── ORDER_LEGAL_LOGS ───────────────────────────────────────
ALTER TABLE order_legal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own legal logs"
  ON order_legal_logs FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can read all legal logs"
  ON order_legal_logs FOR SELECT USING (is_admin());


-- ─── INVOICE_OUTBOX ──────────────────────────────────────────
ALTER TABLE invoice_outbox ENABLE ROW LEVEL SECURITY;

-- Adminler tüm fatura kuyruğunu yönetebilir
CREATE POLICY "Admins can manage invoice outbox"
  ON invoice_outbox FOR ALL USING (is_admin());

-- Kullanıcı tamamlanan kendi fatura bilgisini görebilir
CREATE POLICY "Users can view own invoice info"
  ON invoice_outbox FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    AND status = 'COMPLETED'
  );


-- ============================================================
-- BÖLÜM 6: STORAGE — ÜRÜN GÖRSELLERİ
-- ============================================================

-- 'products' bucket: public, 5MB limit, sadece görsel formatları
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
  public              = true,
  file_size_limit     = 5242880,
  allowed_mime_types  = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Herkes ürün görsellerini görebilir (public bucket)
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

-- Admin ürün görseli yükleyebilir
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );

-- Admin ürün görselini güncelleyebilir
CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );

-- Admin ürün görselini silebilir
CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'products'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
  );


-- ============================================================
-- BÖLÜM 7: RPC FONKSİYONLARI
-- (Tablo tanımlarından sonra tanımlanmalı)
-- ============================================================

-- Sipariş durumunu atomik olarak günceller + history kaydı ekler (migration 008)
-- SECURITY DEFINER: server action'dan çağrılır, admin kontrolü orada yapılır
CREATE OR REPLACE FUNCTION update_order_status_with_history(
  p_order_id           UUID,
  p_new_status         order_status,
  p_changed_by_user_id UUID,
  p_changed_by_role    TEXT    DEFAULT 'admin',
  p_reason             TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status order_status;
  v_result          JSON;
BEGIN
  -- Mevcut durumu al (FOR UPDATE ile satırı kilitle — concurrent race condition önler)
  SELECT status INTO v_previous_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sipariş bulunamadı: %', p_order_id;
  END IF;

  -- Geçmiş kaydı ekle
  INSERT INTO order_status_history (
    order_id, previous_status, new_status, changed_by_user_id, changed_by_role, reason
  ) VALUES (
    p_order_id, v_previous_status, p_new_status, p_changed_by_user_id, p_changed_by_role, p_reason
  );

  -- Siparişi güncelle + durum bazlı timestamp'leri doldur
  UPDATE orders SET
    status                  = p_new_status,
    updated_at              = NOW(),
    paid_at                 = CASE WHEN p_new_status = 'PAID'          THEN COALESCE(paid_at, NOW())                ELSE paid_at                END,
    confirmed_at            = CASE WHEN p_new_status = 'CONFIRMED'     THEN COALESCE(confirmed_at, NOW())           ELSE confirmed_at           END,
    production_started_at   = CASE WHEN p_new_status = 'IN_PRODUCTION' THEN COALESCE(production_started_at, NOW())  ELSE production_started_at  END,
    production_completed_at = CASE WHEN p_new_status = 'READY_TO_SHIP' THEN COALESCE(production_completed_at, NOW()) ELSE production_completed_at END,
    shipped_at              = CASE WHEN p_new_status = 'SHIPPED'       THEN COALESCE(shipped_at, NOW())             ELSE shipped_at             END,
    delivered_at            = CASE WHEN p_new_status = 'DELIVERED'     THEN COALESCE(delivered_at, NOW())           ELSE delivered_at           END,
    refunded_at             = CASE WHEN p_new_status = 'REFUNDED'      THEN COALESCE(refunded_at, NOW())            ELSE refunded_at            END,
    hold_reason             = CASE WHEN p_new_status = 'ON_HOLD'       THEN COALESCE(p_reason, hold_reason)         ELSE hold_reason            END
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_order_status_with_history TO authenticated;


-- Kargo outbox için atomik claim fonksiyonu (migration 009)
-- SELECT FOR UPDATE SKIP LOCKED: aynı anda birden fazla worker aynı satırı alamaz
CREATE OR REPLACE FUNCTION claim_pending_cargo_jobs(p_limit INTEGER DEFAULT 10)
RETURNS SETOF cargo_outbox
LANGUAGE sql
AS $$
  UPDATE cargo_outbox
  SET status = 'PROCESSING', updated_at = NOW()
  WHERE id IN (
    SELECT id FROM cargo_outbox
    WHERE status     = 'PENDING'
      AND next_retry_at <= NOW()
      AND retry_count   <  max_retries
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_cargo_jobs TO service_role;


-- Sipariş yasal logunu atomik olarak ekler (migration 010)
-- checkout transaction içinde çağrılır; başarısız olursa tüm sipariş geri alınır
CREATE OR REPLACE FUNCTION insert_order_legal_log(
  p_order_id             UUID,
  p_user_id              UUID,
  p_ip_address           TEXT,
  p_user_agent           TEXT,
  p_consented_documents  JSONB,  -- [{document_type, version_id, content_hash}]
  p_metadata             JSONB   DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO order_legal_logs (
    order_id, user_id, ip_address, user_agent, consented_documents, metadata
  ) VALUES (
    p_order_id, p_user_id, p_ip_address::INET, p_user_agent, p_consented_documents, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_order_legal_log TO authenticated;


-- Fatura outbox için atomik claim fonksiyonu (migration 010)
CREATE OR REPLACE FUNCTION claim_pending_invoice_jobs(p_limit INTEGER DEFAULT 5)
RETURNS SETOF invoice_outbox
LANGUAGE sql
AS $$
  UPDATE invoice_outbox
  SET status = 'PROCESSING', updated_at = NOW()
  WHERE id IN (
    SELECT id FROM invoice_outbox
    WHERE status     = 'PENDING'
      AND next_retry_at <= NOW()
      AND retry_count   <  max_retries
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_invoice_jobs TO service_role;


-- GRANT: RPC fonksiyonları için erişim izinleri
GRANT EXECUTE ON FUNCTION check_and_deduct_stock(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_stock(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_user_cart(UUID) TO authenticated;


-- ============================================================
-- BÖLÜM 8: VİEWLER
-- ============================================================

-- Sipariş özeti view'ı (admin paneli için)
CREATE OR REPLACE VIEW order_summary AS
SELECT
  o.id,
  o.order_number,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.total_amount,
  o.status,
  o.created_at,
  o.shipping_address,
  COUNT(oi.id) AS item_count,
  json_agg(
    json_build_object(
      'product_name', oi.product_name,
      'width_cm',     oi.width_cm,
      'height_cm',    oi.height_cm,
      'pile_factor',  oi.pile_factor,
      'quantity',     oi.quantity,
      'total_price',  oi.total_price
    )
  ) AS items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id;

-- Sepet özeti view'ı (fiyat hesaplamalı)
CREATE OR REPLACE VIEW cart_summary AS
SELECT
  c.id   AS cart_id,
  c.user_id,
  ci.id  AS item_id,
  ci.product_id,
  p.name AS product_name,
  p.slug AS product_slug,
  p.images[1]  AS product_image,
  p.base_price AS price_per_m2,
  p.stock_quantity,
  ci.width_cm,
  ci.height_cm,
  ci.pile_factor,
  ci.quantity,
  ROUND((ci.width_cm * ci.height_cm)::DECIMAL / 10000, 4)                                         AS area_m2,
  get_pile_coefficient(ci.pile_factor)                                                              AS pile_coefficient,
  calculate_curtain_price(ci.width_cm, ci.height_cm, ci.pile_factor, p.base_price)                 AS unit_price,
  calculate_curtain_price(ci.width_cm, ci.height_cm, ci.pile_factor, p.base_price) * ci.quantity  AS total_price,
  ci.created_at,
  ci.updated_at
FROM carts c
JOIN cart_items ci ON c.id = ci.cart_id
JOIN products   p  ON ci.product_id = p.id
WHERE p.is_published = true;


-- ============================================================
-- BÖLÜM 9: BAŞLANGIÇ VERİLERİ (SEED DATA)
-- ============================================================

-- ─── Store Settings ──────────────────────────────────────────
INSERT INTO store_settings (
  id, site_name, support_email, support_phone,
  free_shipping_threshold, shipping_cost, maintenance_mode
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Çırağan Elite Perde',
  'info@ciraganeliteperde.com',
  '0532 295 95 86',
  5000.00,
  150.00,
  FALSE
) ON CONFLICT (id) DO NOTHING;


-- ─── Kategoriler ─────────────────────────────────────────────
INSERT INTO categories (name, slug, description, image_url, display_order) VALUES
  ('Tül Perdeler',   'tul-perdeler',   'Zarif ve şık tül perde koleksiyonumuz',   '/images/categories/tul.jpg',   1),
  ('Fon Perdeler',   'fon-perdeler',   'Lüks ve kalın fon perde modelleri',        '/images/categories/fon.jpg',   2),
  ('Stor Perdeler',  'stor-perdeler',  'Modern stor perde çeşitleri',              '/images/categories/stor.jpg',  3),
  ('Zebra Perdeler', 'zebra-perdeler', 'Şık zebra perde koleksiyonu',             '/images/categories/zebra.jpg', 4)
ON CONFLICT (slug) DO NOTHING;


-- ─── Ürünler ─────────────────────────────────────────────────
INSERT INTO products (name, slug, description, short_description, category_id, base_price, images, is_published, in_stock) VALUES
(
  'Milano Tül Perde', 'milano-tul-perde',
  'İtalyan tasarım ilhamıyla üretilen Milano Tül Perde, mekanlarınıza sofistike bir dokunuş katar.',
  'İtalyan tasarım ilhamlı, ışık süzen zarif tül perde.',
  (SELECT id FROM categories WHERE slug = 'tul-perdeler'),
  450.00, ARRAY['/images/products/milano-tul-1.jpg'], true, true
),
(
  'Royal Kadife Fon', 'royal-kadife-fon',
  'Premium kadife kumaştan üretilen bu fon perde, mükemmel karartma özelliği sunar.',
  'Premium kadife kumaşlı, tam karartma sağlayan fon perde.',
  (SELECT id FROM categories WHERE slug = 'fon-perdeler'),
  850.00, ARRAY['/images/products/royal-kadife-1.jpg'], true, true
),
(
  'Venedik Dantel Tül', 'venedik-dantel-tul',
  'Venedik dantel işçiliğinden esinlenen bu tül perde, her detayında ustalığın izlerini taşır.',
  'El işçiliği görünümlü, dantel detaylı premium tül perde.',
  (SELECT id FROM categories WHERE slug = 'tul-perdeler'),
  680.00, ARRAY['/images/products/venedik-dantel-1.jpg'], true, true
),
(
  'Premium Stor Perde', 'premium-stor-perde',
  'Minimalist tasarımın zirvesi olan Premium Stor Perde, modern yaşam alanları için idealdir.',
  'Motorlu veya mekanik, modern tasarımlı stor perde.',
  (SELECT id FROM categories WHERE slug = 'stor-perdeler'),
  520.00, ARRAY['/images/products/premium-stor-1.jpg'], true, true
),
(
  'Elite Zebra Perde', 'elite-zebra-perde',
  'Elite Zebra Perde, gündüz ve gece modları arasında zahmetsizce geçiş yapmanızı sağlar.',
  'Çift katmanlı, ayarlanabilir ışık kontrollü zebra perde.',
  (SELECT id FROM categories WHERE slug = 'zebra-perdeler'),
  620.00, ARRAY['/images/products/elite-zebra-1.jpg'], true, true
),
(
  'Osmanlı Jakar Fon', 'osmanli-jakar-fon',
  'Osmanlı saray dokumalarından ilham alan Jakar Fon Perde, geleneksel motifleri çağdaş bir yorumla sunar.',
  'Osmanlı motifli, jakar dokuma lüks fon perde.',
  (SELECT id FROM categories WHERE slug = 'fon-perdeler'),
  780.00, ARRAY['/images/products/osmanli-jakar-1.jpg'], true, true
)
ON CONFLICT (slug) DO NOTHING;


-- ─── Yasal Belge Versiyonları ─────────────────────────────────
-- NOT: Prodüksiyonda gerçek belge içerikleriyle değiştirin.
-- content_hash = sha256("placeholder") değeri
INSERT INTO legal_document_versions (document_type, version, content_hash, is_active)
VALUES
  ('ON_BILGILENDIRME', 'v1.0', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', true),
  ('MESAFELI_SATIS',   'v1.0', 'b3a8e0e1f9ab1bfe3a36f231f676f78bb28a2d0acc67ce3a1e0e8d2faad6b10c', true),
  ('KVKK_AYDINLATMA',  'v1.0', 'c0535e4be2b79ffd93291305436bf889314e4a3faec05ecffcbb7df31ad9e51a', true)
ON CONFLICT DO NOTHING;


-- ============================================================
-- KURULUM TAMAMLANDI!
-- ============================================================
-- Sonraki adımlar:
--
-- 1. İlk admin kullanıcısını Supabase Auth'dan oluşturun
--    Ardından SQL Editor'de:
--    UPDATE profiles SET role = 'ADMIN' WHERE email = 'admin@sirketiniz.com';
--
-- 2. .env.local / Vercel env vars'a ekleyin:
--    NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
--    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
--    SUPABASE_SERVICE_ROLE_KEY=eyJ...
--
-- 3. Ürün görsellerini 'products' Storage bucket'ına yükleyin.
--
-- 4. Vercel cron'ları için CRON_SECRET env var'ı ayarlayın.
--
-- Doğrulama sorgusu (tüm tablolar ve RLS durumu):
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;
-- ============================================================
