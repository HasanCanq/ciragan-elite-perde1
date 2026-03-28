-- ============================================================
-- Migration 021: pg_cron — Bekleyen Siparişlerin Otomatik Temizliği
--
-- Amaç:
--   30 dakikadan uzun süredir PENDING kalan siparişleri her 5 dakikada
--   bir otomatik olarak CANCELLED yapıp stoğu iade eder.
--
-- Bağımlılık:
--   Migration 016 — expire_pending_orders(uuid[]) fonksiyonu gerekli.
--
-- Fonksiyon:
--   cleanup_stale_pending_orders() → expire_pending_orders'ı sarmalayan
--   bir SECURITY DEFINER wrapper; dinamik ID listesini kendisi oluşturur.
--
-- Cron job:
--   '*/5 * * * *' — her 5 dakikada bir (00, 05, 10, …)
--
-- NOT: pg_cron eklentisi Supabase'de varsayılan olarak aktif gelir.
--      Aktif değilse: Dashboard → Extensions → pg_cron → Enable
-- ============================================================

-- ── Wrapper fonksiyon ─────────────────────────────────────────────────────────
-- expire_pending_orders(uuid[]) sadece service_role tarafından çağrılabilir;
-- pg_cron job'ları da service_role context'inde çalışır — bu nedenle wrapper
-- SECURITY DEFINER gerekmez, doğrudan çağrı yeterlidir.
-- Yine de anlaşılabilirlik için ayrı bir fonksiyon olarak tanımlıyoruz.

CREATE OR REPLACE FUNCTION cleanup_stale_pending_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids  uuid[];
  v_result     jsonb;
  v_count      int;
BEGIN
  -- 30 dakikadan uzun süredir PENDING olan siparişleri topla
  SELECT ARRAY_AGG(id ORDER BY id)
  INTO   v_order_ids
  FROM   orders
  WHERE  status     = 'PENDING'
    AND  created_at < NOW() - INTERVAL '30 minutes';

  -- Temizlenecek sipariş yoksa boş sonuç dön (log kirliliği önleme)
  v_count := COALESCE(array_length(v_order_ids, 1), 0);
  IF v_count = 0 THEN
    RETURN jsonb_build_object('processed', 0, 'results', '[]'::jsonb);
  END IF;

  -- Atomik iptal + stok iadesi (migration 016)
  v_result := expire_pending_orders(v_order_ids);

  RETURN jsonb_build_object(
    'processed', v_count,
    'results',   v_result
  );
END;
$$;

COMMENT ON FUNCTION cleanup_stale_pending_orders() IS
  'Cron wrapper: 30 dakikadan uzun PENDING kalan siparişleri expire_pending_orders() '
  'ile atomik olarak iptal eder ve stoğu iade eder. '
  'pg_cron tarafından her 5 dakikada bir çağrılır.';

-- Sadece service_role (pg_cron worker) çağırabilir
REVOKE EXECUTE ON FUNCTION cleanup_stale_pending_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_stale_pending_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_stale_pending_orders() FROM authenticated;
GRANT  EXECUTE ON FUNCTION cleanup_stale_pending_orders() TO service_role;


-- ── pg_cron job ───────────────────────────────────────────────────────────────
-- Mevcut job varsa önce kaldır (idempotent migration için)
SELECT cron.unschedule('cleanup-stale-pending-orders')
WHERE  EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-pending-orders'
);

-- Her 5 dakikada bir çalıştır
SELECT cron.schedule(
  'cleanup-stale-pending-orders',            -- job adı (unique)
  '*/5 * * * *',                             -- dakika cron ifadesi
  $$SELECT cleanup_stale_pending_orders()$$  -- çalıştırılacak SQL
);


-- ── ROLLBACK (gerekirse) ──────────────────────────────────────────────────────
-- SELECT cron.unschedule('cleanup-stale-pending-orders');
-- DROP FUNCTION IF EXISTS cleanup_stale_pending_orders();
