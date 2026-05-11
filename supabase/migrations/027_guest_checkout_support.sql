-- =============================================================================
-- Migration 027: Misafir Kullanıcı Ödeme (Guest Checkout) Desteği
--
-- Amaç:
--   • orders.user_id             → NULL izni (misafir sipariş için)
--   • orders.is_guest            → misafir/üye ayrımı flag'i
--   • order_legal_logs.user_id   → NULL izni (misafir legal log için)
--   • place_order_atomic         → is_guest alanını INSERT'e ekle
--   • insert_order_legal_log     → p_user_id nullable yap
--   • anon RLS                   → misafir INSERT için ek politika
--   • Performans indeksleri
--
-- Geri Alma (Rollback):
--   Dosya sonundaki ROLLBACK bloğuna bakın.
--
-- BAĞIMLILIK:
--   013_order_security_and_tracking.sql  → place_order_atomic
--   010_add_legal_and_invoice.sql        → insert_order_legal_log / order_legal_logs
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. orders.user_id — NOT NULL kısıtını kaldır
--    Mevcut RLS politikaları (005) zaten `user_id IS NULL` beklemektedir;
--    yalnızca DB seviyesindeki zorunluluk kaldırılıyor.
-- =============================================================================

ALTER TABLE orders
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN orders.user_id IS
  'Kayıtlı kullanıcı siparişlerinde auth.users(id) referansı. '
  'Misafir siparişlerinde NULL; is_guest = TRUE ile ayırt edilir.';

-- =============================================================================
-- 2. orders.is_guest — misafir sipariş flag'i
-- =============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN orders.is_guest IS
  'TRUE → misafir kullanıcı siparişi (user_id = NULL). '
  'FALSE → kayıtlı üye siparişi.';

-- İndeks: admin panelinde misafir siparişleri süzmek için
CREATE INDEX IF NOT EXISTS idx_orders_is_guest
  ON orders (is_guest)
  WHERE is_guest = TRUE AND deleted_at IS NULL;

-- =============================================================================
-- 3. order_legal_logs.user_id — NOT NULL kısıtını kaldır
--    Misafir siparişlerinde kullanıcı kimliği yoktur;
--    yasal log kaydı email + IP ile yapılır.
-- =============================================================================

ALTER TABLE order_legal_logs
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN order_legal_logs.user_id IS
  'Kayıtlı kullanıcı için auth.users(id) referansı. '
  'Misafir siparişlerinde NULL; email bilgisi metadata jsonb''de saklanır.';

-- =============================================================================
-- 4. place_order_atomic — is_guest desteği
--    Mevcut fonksiyonu güncelle: payload''dan is_guest oku, INSERT''e ekle.
--    SECURITY DEFINER korunur; anon role GRANT verilir.
-- =============================================================================

CREATE OR REPLACE FUNCTION place_order_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    is_guest,
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
    coupon_id,
    coupon_code,
    customer_note
  ) VALUES (
    NULLIF(p_payload->>'user_id', '')::UUID,           -- misafirde NULL
    COALESCE((p_payload->>'is_guest')::BOOLEAN, FALSE), -- yeni alan
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
    NULLIF(p_payload->>'coupon_id', '')::UUID,
    NULLIF(p_payload->>'coupon_code', ''),
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
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      v_item->>'product_slug',
      NULLIF(v_item->>'product_image', ''),
      (v_item->>'width_cm')::INTEGER,
      (v_item->>'height_cm')::INTEGER,
      (v_item->>'pile_factor')::pile_factor,
      NULLIF(v_item->>'pleat_ratio_id', '')::UUID,
      NULLIF(v_item->>'pleat_name_snapshot', ''),
      NULLIF(v_item->>'mechanism_direction', '')::mechanism_direction,
      (v_item->>'calculation_type_snapshot')::calculation_type,
      (v_item->>'area_m2')::DECIMAL,
      (v_item->>'price_per_m2_snapshot')::DECIMAL,
      (v_item->>'pile_coefficient')::DECIMAL,
      COALESCE((v_item->>'quantity')::INTEGER, 1),
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'total_price')::DECIMAL
    )
    RETURNING id INTO v_item_id;

    -- ── 3. STOK DÜŞME ───────────────────────────────────────────────────────
    IF NOT check_and_deduct_stock(
      (v_item->>'product_id')::UUID,
      (v_item->>'stock_deduct_m2')::DECIMAL
    ) THEN
      v_stock_error := FORMAT(
        'Yetersiz stok: %s (Talep: %s m²)',
        v_item->>'product_name',
        v_item->>'stock_deduct_m2'
      );
      RAISE EXCEPTION '%', v_stock_error;
    END IF;

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
    NULL,
    'PENDING',
    'system',
    'Siparişiniz alındı. Ödeme bekleniyor.',
    true
  );

  -- ── 5. BAŞARI DÖNÜŞÜ ──────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',      true,
    'order_id',     v_order_id,
    'order_number', v_order_number
  );

EXCEPTION
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
  'is_guest=true payload ile misafir kullanıcı siparişlerini destekler. '
  'SECURITY DEFINER ile çalışır.';

-- Mevcut grant koru; service_role zaten tam yetkiye sahip
REVOKE ALL ON FUNCTION place_order_atomic(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_order_atomic(JSONB) TO authenticated;
-- NOT: Misafir siparişleri server action''dan admin/service_role client ile
--      çağrıldığı için anon grant gerekmez.

-- =============================================================================
-- 5. insert_order_legal_log — p_user_id nullable
--    Misafir siparişlerinde user_id NULL gelir; metadata''da guest_email var.
-- =============================================================================

CREATE OR REPLACE FUNCTION insert_order_legal_log(
  p_order_id            uuid,
  p_user_id             uuid,          -- NULL = misafir
  p_ip_address          text,
  p_user_agent          text,
  p_consented_documents jsonb,
  p_metadata            jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO order_legal_logs (
    order_id,
    user_id,
    ip_address,
    user_agent,
    consented_documents,
    metadata
  ) VALUES (
    p_order_id,
    p_user_id,               -- NULL kabul edilir
    p_ip_address::inet,
    p_user_agent,
    p_consented_documents,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION insert_order_legal_log(uuid,uuid,text,text,jsonb,jsonb) IS
  'Sipariş yasal log kaydını ekler. '
  'p_user_id NULL olabilir (misafir sipariş). '
  'Misafir bilgisi p_metadata.guest_email alanında saklanır.';

REVOKE ALL ON FUNCTION insert_order_legal_log(uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_order_legal_log(uuid,uuid,text,text,jsonb,jsonb) TO authenticated;
-- service_role zaten tam yetkiye sahip

-- =============================================================================
-- 6. RLS — Misafir sipariş INSERT için anon politikası
--    Mevcut "Users can insert own orders" politikası user_id IS NULL'' a
--    zaten izin veriyor. Bu bölüm politikayı açıkça belgeliyor.
-- =============================================================================

-- Politika zaten mevcut ve doğru:
--   WITH CHECK (auth.uid() = user_id OR user_id IS NULL)
-- Ekstra değişiklik gerekmez; sadece doğrulayıp devam ediyoruz.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'orders'
      AND policyname = 'Users can insert own orders'
  ) THEN
    -- Politika yoksa oluştur (tamamen yeni ortamlarda)
    CREATE POLICY "Users can insert own orders"
      ON orders FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        OR user_id IS NULL
      );
  END IF;
END $$;

-- order_items INSERT için misafir siparişi desteği
-- Mevcut: orders.user_id = auth.uid()  →  misafir için başarısız
-- Yeni:   OR orders.user_id IS NULL    →  misafir için çalışır
-- NOT: place_order_atomic SECURITY DEFINER olduğu için bu politikayı
--      bypass eder; güvenlik açığı yoktur. Doğrudan INSERT için gerekli.

DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;
CREATE POLICY "Users can insert own order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

-- =============================================================================
-- 7. TypeScript tip uyumu — orders.is_guest için index
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_guest_email_is_guest
  ON orders (customer_email, is_guest)
  WHERE is_guest = TRUE AND deleted_at IS NULL;

-- =============================================================================
-- COMMIT
-- =============================================================================

COMMIT;


-- =============================================================================
-- ROLLBACK (çalıştırma: BEGIN; <aşağıdaki komutlar> COMMIT;)
-- =============================================================================
/*
BEGIN;

-- 1. is_guest kolonunu kaldır
ALTER TABLE orders DROP COLUMN IF EXISTS is_guest;

-- 2. user_id NOT NULL geri ekle
--    DİKKAT: Mevcut NULL değerli satırlar varsa bu satır HATA verir.
--    Önce NULL satırları kontrol edin: SELECT * FROM orders WHERE user_id IS NULL;
ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;

-- 3. order_legal_logs user_id NOT NULL geri ekle
ALTER TABLE order_legal_logs ALTER COLUMN user_id SET NOT NULL;

-- 4. place_order_atomic eski versiyona geri dön
--    (013_order_security_and_tracking.sql'den kopyalayın)

-- 5. insert_order_legal_log eski versiyona geri dön
--    (010_add_legal_and_invoice.sql'den kopyalayın)

-- 6. order_items INSERT politikasını eski haline getir
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;
CREATE POLICY "Users can insert own order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- 7. İndeksler
DROP INDEX IF EXISTS idx_orders_is_guest;
DROP INDEX IF EXISTS idx_orders_guest_email_is_guest;

COMMIT;
*/
