-- ============================================================
-- Migration 008: Genişletilmiş Sipariş Durumları ve Geçmiş Tablosu
-- ============================================================

-- 1. ORDER STATUS ENUM'a yeni değerler ekle
--    Not: PostgreSQL'de enum değerleri silinip değiştirilemez, sadece eklenir.
--    Mevcut değerler korunur: PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, CANCELLED

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'READY_TO_SHIP';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'REFUNDED';

-- 2. ORDERS tablosuna yeni kolonlar ekle
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cargo_company       text,
  ADD COLUMN IF NOT EXISTS tracking_number     text,
  ADD COLUMN IF NOT EXISTS tracking_url        text,
  ADD COLUMN IF NOT EXISTS estimated_delivery  date,
  ADD COLUMN IF NOT EXISTS hold_reason         text,
  ADD COLUMN IF NOT EXISTS confirmed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS production_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS production_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at         timestamptz;

-- 3. ORDER_STATUS_HISTORY tablosu oluştur (Denetim izi)
CREATE TABLE IF NOT EXISTS order_status_history (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id            uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status     order_status,
  new_status          order_status NOT NULL,
  changed_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role     text        NOT NULL DEFAULT 'admin'
                        CHECK (changed_by_role IN ('admin', 'customer', 'system')),
  reason              text,
  created_at          timestamptz DEFAULT now() NOT NULL
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
  ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at
  ON order_status_history(created_at DESC);

-- 4. RLS Aktifleştir
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Politikalar (varsa önce sil)
DROP POLICY IF EXISTS "Users can view own order status history" ON order_status_history;
DROP POLICY IF EXISTS "Admins can manage order status history"  ON order_status_history;

-- Kullanıcı kendi siparişinin geçmişini görebilir
CREATE POLICY "Users can view own order status history"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth.uid()
    )
  );

-- Admin her şeyi yapabilir
CREATE POLICY "Admins can manage order status history"
  ON order_status_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 5. Atomik güncelleme için PostgreSQL fonksiyonu
--    Bu fonksiyon tek transaction içinde hem orders hem history günceller.
CREATE OR REPLACE FUNCTION update_order_status_with_history(
  p_order_id          uuid,
  p_new_status        order_status,
  p_changed_by_user_id uuid,
  p_changed_by_role   text    DEFAULT 'admin',
  p_reason            text    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status   order_status;
  v_result            json;
BEGIN
  -- Mevcut durumu al (FOR UPDATE ile kilitler)
  SELECT status INTO v_previous_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sipariş bulunamadı: %', p_order_id;
  END IF;

  -- Geçmiş kaydı ekle
  INSERT INTO order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by_user_id,
    changed_by_role,
    reason
  ) VALUES (
    p_order_id,
    v_previous_status,
    p_new_status,
    p_changed_by_user_id,
    p_changed_by_role,
    p_reason
  );

  -- Siparişi güncelle + durum bazlı timestamp'ler
  UPDATE orders SET
    status                   = p_new_status,
    updated_at               = now(),
    paid_at                  = CASE WHEN p_new_status = 'PAID'         THEN COALESCE(paid_at, now())         ELSE paid_at               END,
    confirmed_at             = CASE WHEN p_new_status = 'CONFIRMED'    THEN COALESCE(confirmed_at, now())    ELSE confirmed_at          END,
    production_started_at    = CASE WHEN p_new_status = 'IN_PRODUCTION'THEN COALESCE(production_started_at, now()) ELSE production_started_at END,
    production_completed_at  = CASE WHEN p_new_status = 'READY_TO_SHIP'THEN COALESCE(production_completed_at, now()) ELSE production_completed_at END,
    shipped_at               = CASE WHEN p_new_status = 'SHIPPED'      THEN COALESCE(shipped_at, now())      ELSE shipped_at            END,
    delivered_at             = CASE WHEN p_new_status = 'DELIVERED'    THEN COALESCE(delivered_at, now())    ELSE delivered_at          END,
    refunded_at              = CASE WHEN p_new_status = 'REFUNDED'     THEN COALESCE(refunded_at, now())     ELSE refunded_at           END,
    hold_reason              = CASE WHEN p_new_status = 'ON_HOLD'      THEN COALESCE(p_reason, hold_reason)  ELSE hold_reason           END
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Authenticated kullanıcıların çağırabilmesi için yetki ver
-- (Gerçek admin kontrolü server action içinde yapılır)
GRANT EXECUTE ON FUNCTION update_order_status_with_history TO authenticated;
