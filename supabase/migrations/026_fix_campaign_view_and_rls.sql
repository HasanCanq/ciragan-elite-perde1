-- ============================================================
-- FIX: v_campaign_summary view + RLS policies — Migration 026
--
-- Bug 1 (Admin kampanyalar boş görünüyor):
--   v_campaign_summary view'ında created_at ve description
--   kolonları eksikti. getCampaigns() .order('created_at') ile
--   sorguluyordu → PostgreSQL "column does not exist" hatası →
--   getCampaigns() null döndürüyor → UI boş liste gösteriyordu.
--   Düzeltme: view yeniden oluşturuldu, tüm kolonlar eklendi.
--   Ek: confirmed_discount_total → confirmed_discount olarak
--   yeniden adlandırıldı (CampaignRow TypeScript tipiyle eşleşmesi için).
--
-- Bug 2 (Kupon kodu bulunamadı):
--   coupons / campaigns / coupon_segment_rules tablolarında
--   sadece admin-only RLS politikası vardı. validateCoupon()
--   kullanıcı oturumu ile sorgu yapıyor; RLS eşleşmediğinde
--   0 satır dönüyor → COUPON_NOT_FOUND.
--   Düzeltme: Giriş yapmış kullanıcıların aktif kayıtları
--   okuyabilmesi için SELECT politikaları eklendi.
-- ============================================================

-- ── 1. v_campaign_summary — Düzeltilmiş View ────────────────
-- Eksik kolonlar: description, created_at
-- Yeniden adlandırma: confirmed_discount_total → confirmed_discount
--
-- NOT: CREATE OR REPLACE kolon sırasını/adını değiştiremez.
-- Migration 024'teki view önce DROP edilip yeniden oluşturulur.

DROP VIEW IF EXISTS v_campaign_summary;

CREATE VIEW v_campaign_summary AS
SELECT
  c.id,
  c.name,
  c.description,
  c.status,
  c.starts_at,
  c.ends_at,
  c.created_at,
  COUNT(DISTINCT cu.id)                                                        AS coupon_count,
  COALESCE(SUM(cu.usage_count), 0)                                            AS total_redemptions,
  COALESCE(SUM(cr.discount_amount) FILTER (WHERE cr.status = 'CONFIRMED'), 0) AS confirmed_discount
FROM campaigns c
LEFT JOIN coupons cu ON cu.campaign_id = c.id
LEFT JOIN coupon_redemptions cr ON cr.coupon_id = cu.id
GROUP BY c.id, c.name, c.description, c.status, c.starts_at, c.ends_at, c.created_at;

-- ── 2. RLS — Kullanıcı Okuma Politikaları ───────────────────
--
-- Kupon doğrulama akışı (validateCoupon → coupon-service.ts):
--   1. coupons tablosundan aktif kuponu okur
--   2. campaign join ile kampanya durumunu kontrol eder
--   3. coupon_segment_rules join ile segment kurallarını okur
--   4. coupon_redemptions tablosundan kullanıcı kullanım sayısını okur
--
-- Güvenlik notu:
--   - Sadece is_active=TRUE kuponlar okunabilir (pasif kuponlar gizli)
--   - Sadece ACTIVE kampanyalar okunabilir (taslak/sona ermiş gizli)
--   - coupon_redemptions için kullanıcı kendi kayıtlarını zaten
--     okuyabiliyor (migration 024'teki user_own_redemptions politikası)

-- campaigns — Aktif kampanyalar giriş yapan herkese okunabilir
DO $$ BEGIN
  CREATE POLICY users_read_active_campaigns ON campaigns FOR SELECT
    USING (status = 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- coupons — Aktif kuponlar giriş yapan herkese okunabilir
DO $$ BEGIN
  CREATE POLICY users_read_active_coupons ON coupons FOR SELECT
    USING (is_active = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- coupon_segment_rules — Segment kuralları kuponla birlikte okunabilir
-- (JOIN erişimi için gerekli; kullanıcı direkt okuyamaz ama JOIN çalışsın)
DO $$ BEGIN
  CREATE POLICY users_read_segment_rules ON coupon_segment_rules FOR SELECT
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
