-- Migration 039: Güvenlik Sertleştirme
-- Supabase Security Advisor uyarılarını kapatır:
--   1. Admin/cron fonksiyonlarından PUBLIC erişimi kaldır (Kritik)
--   2. Sipariş fonksiyonlarını authenticated ile sınırla (Kritik)
--   3. Function Search Path Mutable açığını kapat (Önemli)
--
-- NOT: rls_auto_enable() bu migration dosyalarında tanımlanmadı;
--      Supabase sistem fonksiyonu olabilir — ayrıca incelenmeli.

-- ═══════════════════════════════════════════════════════════════════════════
-- BÖLÜM 1: Admin-only Fonksiyonlar — PUBLIC erişimi kaldır
-- ═══════════════════════════════════════════════════════════════════════════

-- restore_record: is_admin() kontrolü içeride yapılıyor, sadece authenticated
REVOKE ALL ON FUNCTION restore_record(TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION restore_record(TEXT, UUID) TO authenticated;

-- soft_delete_record: is_admin() kontrolü içeride yapılıyor
REVOKE ALL ON FUNCTION soft_delete_record(TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION soft_delete_record(TEXT, UUID) TO authenticated;

-- restore_stock: stok iade işlemi, sadece authenticated (admin/sistem çağırır)
REVOKE ALL ON FUNCTION restore_stock(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION restore_stock(UUID, INTEGER) TO authenticated;

-- expire_campaigns_and_coupons: pg_cron job çağırır (postgres superuser),
-- hiçbir kullanıcı rolüne GRANT gerekmiyor.
REVOKE ALL ON FUNCTION expire_campaigns_and_coupons() FROM PUBLIC;

-- update_order_status_with_history: admin paneli çağırır
REVOKE ALL ON FUNCTION update_order_status_with_history(
  UUID, order_status, UUID, TEXT, TEXT
) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION update_order_status_with_history(
  UUID, order_status, UUID, TEXT, TEXT
) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- BÖLÜM 2: Sipariş Fonksiyonları — anonim erişimi kapat
-- ═══════════════════════════════════════════════════════════════════════════

-- clear_user_cart: giriş yapmış kullanıcı sepetini temizler
REVOKE ALL ON FUNCTION clear_user_cart(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION clear_user_cart(UUID) TO authenticated;

-- check_and_deduct_stock: place_order_atomic içinden çağrılır (SECURITY DEFINER
-- zinciri). Doğrudan dışarıdan erişilmemeli.
REVOKE ALL ON FUNCTION check_and_deduct_stock(UUID, DECIMAL) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_and_deduct_stock(UUID, DECIMAL) TO authenticated;

-- place_order_atomic: misafir (anon) siparişi destekleniyor, iki role de GRANT.
-- "Public Can Execute" uyarısı anon granti nedeniyle kalabilir — bu kasıtlı.
REVOKE ALL ON FUNCTION place_order_atomic(JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION place_order_atomic(JSONB) TO authenticated;
GRANT  EXECUTE ON FUNCTION place_order_atomic(JSONB) TO anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- BÖLÜM 3: Function Search Path Mutable — SET search_path ekle
-- ═══════════════════════════════════════════════════════════════════════════

-- Trigger fonksiyonu: ölçü kılavuzu updated_at güncellemesi
ALTER FUNCTION update_measurement_guides_updated_at()
  SET search_path = public;

-- Stok düşme fonksiyonu
ALTER FUNCTION check_and_deduct_stock(UUID, DECIMAL)
  SET search_path = public;

-- Trigger fonksiyonu: promosyon updated_at güncellemesi
ALTER FUNCTION promotion_update_updated_at()
  SET search_path = public;

-- Sipariş numarası üreteci
ALTER FUNCTION generate_order_number()
  SET search_path = public;
