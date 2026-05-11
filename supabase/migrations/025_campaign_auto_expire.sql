-- ============================================================
-- CAMPAIGN AUTO-EXPIRE — Migration 025
--
-- Soru: "Süresi dolunca kaldırıyor mu?"
-- Cevap: HAYIR — kayıtlar hiçbir zaman silinmez.
--
-- Felsefe (Soft Management):
--   - Tüm kampanya ve kupon kayıtları DB'de kalıcı olarak tutulur.
--   - Silme yok; deactivate/expire var.
--   - Redemption geçmişi, analitik ve yasal kayıt amaçlı korunur.
--   - Süresi dolmuş kuponlar validateCoupon() tarafından reddedilir
--     (is_active + expires_at + campaign.ends_at runtime kontrolü).
--
-- Bu migration 2 şey yapar:
--   1. expire_campaigns_and_coupons() fonksiyonu — bitiş tarihi
--      geçmiş kampanyaları EXPIRED yapar, kuponları is_active = false yapar.
--      Kayıtları SILMEZ.
--   2. pg_cron job — bu fonksiyonu her gece 02:00'de çalıştırır.
-- ============================================================

-- ── 1. Auto-Expire Function ───────────────────────────────────

CREATE OR REPLACE FUNCTION expire_campaigns_and_coupons()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_campaigns INT := 0;
  v_expired_coupons   INT := 0;
BEGIN
  -- Bitiş tarihi geçmiş kampanyaları EXPIRED'a çek
  -- (DRAFT / PAUSED olanlar da dahil — ends_at geçmişse expire olur)
  UPDATE campaigns
  SET    status = 'EXPIRED'
  WHERE  ends_at < now()
    AND  status != 'EXPIRED';

  GET DIAGNOSTICS v_expired_campaigns = ROW_COUNT;

  -- Kupon bazlı bitiş tarihi geçmişleri devre dışı bırak
  -- (campaign'dan bağımsız kupon-level expires_at kontrolü)
  UPDATE coupons
  SET    is_active = FALSE
  WHERE  expires_at < now()
    AND  is_active = TRUE;

  GET DIAGNOSTICS v_expired_coupons = ROW_COUNT;

  -- EXPIRED kampanyaların aktif kuponlarını da devre dışı bırak
  UPDATE coupons
  SET    is_active = FALSE
  WHERE  is_active = TRUE
    AND  campaign_id IN (
      SELECT id FROM campaigns WHERE status = 'EXPIRED'
    );

  RETURN jsonb_build_object(
    'success',            TRUE,
    'expired_campaigns',  v_expired_campaigns,
    'expired_coupons',    v_expired_coupons,
    'ran_at',             now()
  );
END;
$$;

-- ── 2. pg_cron Job ────────────────────────────────────────────
-- Her gece 02:00 (UTC) otomatik çalışır.
-- Supabase'de pg_cron extension etkinleştirilmiş olmalı.
-- (Supabase Dashboard → Database → Extensions → pg_cron)

DO $$
BEGIN
  -- Önce varsa eski job'ı kaldır (idempotency)
  PERFORM cron.unschedule('expire-campaigns-nightly')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-campaigns-nightly'
  );

  -- Yeni job ekle
  PERFORM cron.schedule(
    'expire-campaigns-nightly',          -- job adı
    '0 2 * * *',                         -- her gece 02:00 UTC
    'SELECT expire_campaigns_and_coupons()'
  );

EXCEPTION WHEN OTHERS THEN
  -- pg_cron extension yüklü değilse sessizce geç
  -- (Development ortamında pg_cron olmayabilir)
  RAISE NOTICE 'pg_cron job kurulamadı (extension yüklü olmayabilir): %', SQLERRM;
END;
$$;

-- ── Yorum: Neden silmiyoruz? ──────────────────────────────────
--
-- coupon_redemptions tablosu coupons(id) ve orders(id)'e foreign key ile bağlı.
-- Bir kupon silinirse, o kupona ait tüm redemption kayıtları da silinir (CASCADE).
-- Bu durum:
--   - Finansal raporları bozar (verilen indirim miktarı değişir)
--   - Yasal kayıt gereksinimlerini karşılamaz (e-Arşiv, KDV beyanı referansları)
--   - Müşteri sipariş detaylarında "kupon bilgisi" kaybolur
--
-- Bu nedenle tüm kayıtlar sonsuza kadar korunur.
-- Admin panelinde sona ermiş kampanyalar "Sona Erdi" etiketiyle görünür;
-- istatistiklere dahil edilmeye devam eder.
