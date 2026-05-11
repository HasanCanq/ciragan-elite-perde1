-- ============================================================
-- Migration 031: RLS Performans + Güvenlik Düzeltmeleri
-- ============================================================
-- SORUN 1 (CRITICAL): v_campaign_summary SECURITY DEFINER view
--   → Tüm kampanya verilerini RLS bypass ederek gösteriyor.
--   → Düzeltme: WITH (security_invoker = true) — view, sorguyu
--     çalıştıran kullanıcının yetkileriyle çalışır.
--
-- SORUN 2 (WARNING): Auth RLS Initialization Plan
--   → RLS policy'lerinde auth.uid() her satır için yeniden
--     değerlendiriliyor. 1000 satır = 1000 auth.uid() çağrısı.
--   → Düzeltme: auth.uid() → (SELECT auth.uid())
--     PostgreSQL bunu bir kez hesaplayıp cache'ler.
-- ============================================================

-- ── 1. v_campaign_summary: SECURITY DEFINER → SECURITY INVOKER ─

DROP VIEW IF EXISTS v_campaign_summary;

CREATE VIEW v_campaign_summary
  WITH (security_invoker = true)   -- ← kritik düzeltme
AS
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

COMMENT ON VIEW v_campaign_summary IS
  'Kampanya özeti — security_invoker: caller RLS''ini uygular.';


-- ── 2. RLS Performans: auth.uid() → (SELECT auth.uid()) ────────
--
-- Kural: RLS koşullarında auth.uid() DOĞRUDAN kullanılırsa
-- PostgreSQL her satır için fonksiyonu çağırır (init-plan eksik).
-- (SELECT auth.uid()) formu bir kez çalışır → N katı hız artışı.
-- ──────────────────────────────────────────────────────────────


-- ── profiles ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING ((SELECT auth.uid()) = id AND deleted_at IS NULL);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);


-- ── orders ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own orders"   ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING ((SELECT auth.uid()) = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
  );


-- ── order_items ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own order items"   ON order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id    = order_items.order_id
        AND orders.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own order items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (
          orders.user_id = (SELECT auth.uid())
          OR orders.user_id IS NULL
        )
    )
  );


-- ── carts ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own cart"   ON carts;
DROP POLICY IF EXISTS "Users can create own cart" ON carts;
DROP POLICY IF EXISTS "Users can update own cart" ON carts;
DROP POLICY IF EXISTS "Users can delete own cart" ON carts;

CREATE POLICY "Users can view own cart"
  ON carts FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own cart"
  ON carts FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own cart"
  ON carts FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own cart"
  ON carts FOR DELETE
  USING ((SELECT auth.uid()) = user_id);


-- ── cart_items ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own cart items"   ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;

CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id      = cart_items.cart_id
        AND carts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id      = cart_items.cart_id
        AND carts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id      = cart_items.cart_id
        AND carts.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id      = cart_items.cart_id
        AND carts.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id      = cart_items.cart_id
        AND carts.user_id = (SELECT auth.uid())
    )
  );


-- ── addresses ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own addresses"   ON addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON addresses;

CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own addresses"
  ON addresses FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE
  USING ((SELECT auth.uid()) = user_id);


-- ── reviews ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;

CREATE POLICY "Users can insert own reviews"
  ON reviews FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING ((SELECT auth.uid()) = user_id);


-- ── payment_transactions ──────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own payment transactions" ON payment_transactions;

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);


-- ── order_legal_logs ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own legal logs" ON order_legal_logs;

CREATE POLICY "Users can view own legal logs"
  ON order_legal_logs FOR SELECT
  USING (user_id = (SELECT auth.uid()));


-- ── coupon_redemptions ────────────────────────────────────────

DROP POLICY IF EXISTS "user_own_redemptions" ON coupon_redemptions;

CREATE POLICY "user_own_redemptions"
  ON coupon_redemptions FOR SELECT
  USING (user_id = (SELECT auth.uid()));


-- ── audit_logs ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);


-- ── Doğrulama sorgusu ─────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual LIKE '%auth.uid()%'
    OR qual LIKE '%auth.role()%'
  )
ORDER BY tablename, policyname;
-- Yukarıdaki sorgu 0 satır döndürmelidir.
-- Döndürürse o policy'yi de düzeltmeniz gerekir.
