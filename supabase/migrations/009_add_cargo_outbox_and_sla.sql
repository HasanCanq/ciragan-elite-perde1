-- ============================================================
-- Migration 009: Kargo Outbox + SLA Deadline Kolonu
-- ============================================================

-- 1. CARGO_OUTBOX tablosu
--    Kargo API çağrılarını güvenilir hale getiren transactional outbox.
--    Sipariş READY_TO_SHIP olduğunda buraya yazılır;
--    cron worker okuyup kargo API'sine iletir, retry mekanizması sağlar.

CREATE TYPE cargo_outbox_status AS ENUM (
  'PENDING',     -- İşlem bekliyor
  'PROCESSING',  -- Worker tarafından alındı (in-flight lock)
  'COMPLETED',   -- Kargo API başarıyla yanıtladı
  'FAILED'       -- Max retry aşıldı, manuel müdahale gerekli
);

CREATE TABLE IF NOT EXISTS cargo_outbox (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payload         jsonb         NOT NULL,            -- Kargo API'sine gönderilecek veri
  status          cargo_outbox_status NOT NULL DEFAULT 'PENDING',
  retry_count     integer       NOT NULL DEFAULT 0,
  max_retries     integer       NOT NULL DEFAULT 5,
  next_retry_at   timestamptz   NOT NULL DEFAULT now(),
  last_error      text,                              -- Son hata mesajı (debug için)
  barcode         text,                              -- Başarı sonrası kargo barkodu
  completed_at    timestamptz,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargo_outbox_status_retry
  ON cargo_outbox(status, next_retry_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_cargo_outbox_order_id
  ON cargo_outbox(order_id);

-- 2. ORDERS tablosuna SLA deadline kolonu ekle
--    IN_PRODUCTION statüsüne geçince üretim son tarihi belirlenir.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS production_deadline timestamptz;

-- 3. RLS
ALTER TABLE cargo_outbox ENABLE ROW LEVEL SECURITY;

-- Sadece admin erişebilir (müşteriler kargo outbox'ı göremez)
CREATE POLICY "Admins can manage cargo outbox"
  ON cargo_outbox FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 4. Atomik "claim" fonksiyonu: cron worker işlemeden önce kilitler
--    SELECT FOR UPDATE SKIP LOCKED ile aynı anda birden fazla worker
--    aynı satırı almasını önler (poison pill protection).
CREATE OR REPLACE FUNCTION claim_pending_cargo_jobs(p_limit integer DEFAULT 10)
RETURNS SETOF cargo_outbox
LANGUAGE sql
AS $$
  UPDATE cargo_outbox
  SET status = 'PROCESSING', updated_at = now()
  WHERE id IN (
    SELECT id FROM cargo_outbox
    WHERE status = 'PENDING'
      AND next_retry_at <= now()
      AND retry_count < max_retries
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_cargo_jobs TO service_role;
