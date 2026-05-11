-- ============================================================
-- Migration 032: Kalan RLS Performans Düzeltmeleri
-- ============================================================
-- Migration 031 ana tabloları düzeltti. Bu migration:
--
-- 1. order_status_history — her iki policy'de subquery içindeki
--    auth.uid() direkt çağrısı fix edildi.
--
-- 2. order_legal_logs — "Admins can read all legal logs"
--    (migration 010) inline subquery → is_admin() ile değiştirildi.
--
-- 3. legal_document_versions — "Admins full access legal documents"
--    (migration 010) inline subquery → is_admin() ile değiştirildi.
--
-- 4. invoice_outbox — iki policy fix edildi:
--    - Admins can manage: inline subquery → is_admin()
--    - Users can view own: subquery içindeki auth.uid() fix edildi.
--
-- 5. Eski isimli duplicate policy temizliği (IF EXISTS ile güvenli).
--
-- NOT: Admin policy'lerinde is_admin() tercih edildi çünkü:
--   - is_admin() SECURITY DEFINER fonksiyon, uid'yi dahili yönetir.
--   - Her yerde tutarlı pattern → bakımı kolaylaştırır.
-- ============================================================


-- ── 1. Eski isimli duplicate policy temizliği ────────────────
-- Bu politikalar Supabase dashboard veya erken migrationlardan
-- kalmış olabilir. IF EXISTS ile güvenli şekilde silinir.

DROP POLICY IF EXISTS "Users_View_Own_Orders"    ON orders;
DROP POLICY IF EXISTS "Users_View_Own_Profile"   ON profiles;
DROP POLICY IF EXISTS "Users_Update_Own_Profile" ON profiles;


-- ── 2. order_status_history ──────────────────────────────────

DROP POLICY IF EXISTS "Users can view own order status history" ON order_status_history;
DROP POLICY IF EXISTS "Admins can manage order status history"  ON order_status_history;

CREATE POLICY "Users can view own order status history"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage order status history"
  ON order_status_history FOR ALL
  USING (is_admin());


-- ── 3. order_legal_logs — Admin policy ───────────────────────
-- User policy zaten migration 031'de düzeltildi.

DROP POLICY IF EXISTS "Admins can read all legal logs" ON order_legal_logs;

CREATE POLICY "Admins can read all legal logs"
  ON order_legal_logs FOR SELECT
  USING (is_admin());


-- ── 4. legal_document_versions — Admin policy ────────────────

DROP POLICY IF EXISTS "Admins full access legal documents" ON legal_document_versions;

CREATE POLICY "Admins full access legal documents"
  ON legal_document_versions FOR ALL
  USING (is_admin());


-- ── 5. invoice_outbox ────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage invoice outbox" ON invoice_outbox;
DROP POLICY IF EXISTS "Users can view own invoice info"  ON invoice_outbox;

CREATE POLICY "Admins can manage invoice outbox"
  ON invoice_outbox FOR ALL
  USING (is_admin());

CREATE POLICY "Users can view own invoice info"
  ON invoice_outbox FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = (SELECT auth.uid()))
    AND status = 'COMPLETED'
  );


-- ── Doğrulama sorgusu ─────────────────────────────────────────
-- Düzeltilmiş "(SELECT auth.uid())" formunu hariç tutar.
-- Bu sorgu 0 satır döndürmelidir.

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual  LIKE '%auth.uid()%' AND qual  NOT LIKE '%(SELECT auth.uid()%')
    OR
    (qual  LIKE '%auth.role()%')
  )
ORDER BY tablename, policyname;
