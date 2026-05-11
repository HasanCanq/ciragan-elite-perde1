-- ============================================================
-- PROMOTION ENGINE — Migration 024
-- Enterprise-grade kupon ve kampanya sistemi
--
-- Tasarım ilkeleri:
--   - NUMERIC(15,4) / NUMERIC(15,2): floating-point hatasız para birimi
--   - FOR UPDATE pessimistic lock: eşzamanlı kullanım yarışını önler
--   - redeem_coupon_atomic: lock + check + write tek TX içinde
--   - RLS: adminler her şeyi, kullanıcılar sadece kendi redemption'larını görür
-- ============================================================

-- ── Enum Types ───────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE campaign_status   AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED');
  CREATE TYPE discount_kind     AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
  CREATE TYPE redemption_status AS ENUM ('RESERVED', 'CONFIRMED', 'RELEASED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 1. CAMPAIGNS ─────────────────────────────────────────────
-- Kampanya = birden fazla kuponu kapsayan üst kapsayıcı.
-- Tek bir kampanya altında B2B ve VIP segmentleri için
-- farklı kupon kodları veya segment rule'ları tanımlanabilir.

CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  status      campaign_status NOT NULL DEFAULT 'DRAFT',
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ,           -- NULL = bitiş tarihi yok
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_dates
  ON campaigns (status, starts_at, ends_at);

-- ── 2. COUPONS ───────────────────────────────────────────────
-- Her kupon, bir kampanyaya bağlıdır ve kendi indirim kurallarını taşır.
-- eligible_segments NULL ise herkese açık.
-- eligible_segments doluysa yalnızca listede olan segmentler geçerlidir
-- (segment rule olmayan üyeler base discount'u alır).

CREATE TABLE IF NOT EXISTS coupons (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID         NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  code                 TEXT         NOT NULL,

  discount_kind        discount_kind NOT NULL,
  -- PERCENTAGE: 0.0001–1.0000  (örn: 0.2000 = %20)
  -- FIXED_AMOUNT: TRY cinsinden tutar (örn: 50.0000 = ₺50)
  discount_value       NUMERIC(15,4) NOT NULL CHECK (discount_value > 0),

  -- Yüzde indirimde maksimum indirim tavanı (₺ cinsinden)
  max_discount_amount  NUMERIC(15,2),

  -- Kuponu uygulayabilmek için minimum sepet tutarı (subtotal)
  min_order_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- NULL = sınırsız genel kullanım; değer varsa global üst limit
  usage_limit          INT          CHECK (usage_limit IS NULL OR usage_limit > 0),

  -- Kullanıcı başına kullanım limiti (genellikle 1)
  usage_limit_per_user INT          NOT NULL DEFAULT 1
                                    CHECK (usage_limit_per_user > 0),

  -- Denormalized sayaç — redeem_coupon_atomic / release_coupon_atomic yönetir.
  -- Doğrudan güncellenmemeli; RPC fonksiyonları üzerinden değişir.
  usage_count          INT          NOT NULL DEFAULT 0
                                    CHECK (usage_count >= 0),

  -- NULL = tüm kullanıcılar; dolu ise yalnızca bu segmentler
  eligible_segments    TEXT[],

  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Kampanya bitiş tarihini override eder (daha erken biter)
  expires_at           TIMESTAMPTZ,

  -- Ek kurallar JSONB (first_order_only, excluded_category_ids, vb.)
  rules                JSONB        NOT NULL DEFAULT '{}',

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- PERCENTAGE değeri 0 < x ≤ 1 aralığında olmalı
  CONSTRAINT chk_percentage_range CHECK (
    discount_kind <> 'PERCENTAGE'
    OR (discount_value > 0 AND discount_value <= 1)
  )
);

-- Kupon kodu araması büyük/küçük harf duyarsız ve unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_upper
  ON coupons (UPPER(code));

CREATE INDEX IF NOT EXISTS idx_coupons_campaign
  ON coupons (campaign_id);

-- Aktif kupon hızlı lookup
CREATE INDEX IF NOT EXISTS idx_coupons_active_lookup
  ON coupons (is_active, UPPER(code))
  WHERE is_active = TRUE;

-- ── 3. COUPON SEGMENT RULES ──────────────────────────────────
-- Segment başına indirim override'ı.
-- Örnek: Aynı "YAZA_GIRIS" kuponu;
--   B2B_ARCHITECTS → %25 indirim (max ₺500)
--   VIP_RETAIL     → %15 indirim (max ₺300)
-- Segment rule bulunamazsa coupons.discount_value uygulanır.

CREATE TABLE IF NOT EXISTS coupon_segment_rules (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id           UUID         NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  segment             TEXT         NOT NULL, -- 'B2B_ARCHITECTS', 'VIP_RETAIL', ...

  discount_kind       discount_kind NOT NULL,
  discount_value      NUMERIC(15,4) NOT NULL CHECK (discount_value > 0),
  max_discount_amount NUMERIC(15,2),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT chk_seg_percentage_range CHECK (
    discount_kind <> 'PERCENTAGE'
    OR (discount_value > 0 AND discount_value <= 1)
  ),
  UNIQUE (coupon_id, segment)
);

CREATE INDEX IF NOT EXISTS idx_coupon_segment_rules_coupon
  ON coupon_segment_rules (coupon_id);

-- ── 4. COUPON REDEMPTIONS ────────────────────────────────────
-- Kullanım kayıt defteri. Her redemption 3 durumdan geçer:
--   RESERVED  → Sipariş oluşturuldu, ödeme bekleniyor
--   CONFIRMED → Ödeme başarılı; kupon kalıcı olarak kullanıldı
--   RELEASED  → Ödeme başarısız / sipariş iptal; rezervasyon geri alındı
--
-- RESERVED ve CONFIRMED kayıtlar kullanım limitine sayılır.
-- RELEASED kayıtlar sayılmaz (index ile kapsanır).

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id                     UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id              UUID             NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  user_id                UUID             NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id               UUID             REFERENCES orders(id) ON DELETE SET NULL,

  -- Uygulanan indirim tutarı (hesaplama anındaki değer — immutable)
  discount_amount        NUMERIC(15,2)    NOT NULL CHECK (discount_amount >= 0),
  subtotal_at_redemption NUMERIC(15,2)    NOT NULL,

  -- Hangi segment kuralı uygulandı (NULL = base rule)
  applied_segment        TEXT,

  ip_address             INET,
  status                 redemption_status NOT NULL DEFAULT 'RESERVED',
  redeemed_at            TIMESTAMPTZ      NOT NULL DEFAULT now(),
  confirmed_at           TIMESTAMPTZ,
  released_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_redemptions_coupon
  ON coupon_redemptions (coupon_id);

CREATE INDEX IF NOT EXISTS idx_redemptions_user
  ON coupon_redemptions (user_id);

CREATE INDEX IF NOT EXISTS idx_redemptions_order
  ON coupon_redemptions (order_id)
  WHERE order_id IS NOT NULL;

-- Aktif (sayılan) redemption'lar için partial index — kullanıcı limit sorgusunu hızlandırır
CREATE INDEX IF NOT EXISTS idx_redemptions_active_user_coupon
  ON coupon_redemptions (coupon_id, user_id, status)
  WHERE status <> 'RELEASED';

-- ── 5. ORDERS — Kupon kolonları ──────────────────────────────
-- Mevcut orders tablosunu genişlet.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_id     UUID REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code   TEXT,
  ADD COLUMN IF NOT EXISTS redemption_id UUID REFERENCES coupon_redemptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_coupon
  ON orders (coupon_id)
  WHERE coupon_id IS NOT NULL;

-- profiles tablosuna segment kolonu ekle (segmentasyon için)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS segment TEXT;  -- 'B2B_ARCHITECTS', 'VIP_RETAIL', NULL=STANDARD

CREATE INDEX IF NOT EXISTS idx_profiles_segment
  ON profiles (segment)
  WHERE segment IS NOT NULL;

-- ── 6. UPDATED_AT TRIGGERS ───────────────────────────────────

CREATE OR REPLACE FUNCTION promotion_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION promotion_update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION promotion_update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. RLS ───────────────────────────────────────────────────

ALTER TABLE campaigns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_segment_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions    ENABLE ROW LEVEL SECURITY;

-- Admin: tam yetki
-- NOT: CREATE POLICY IF NOT EXISTS PostgreSQL'de geçersiz —
--      DO/EXCEPTION bloğu ile idempotent hale getiriyoruz.
DO $$ BEGIN
  CREATE POLICY admin_all_campaigns ON campaigns FOR ALL USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY admin_all_coupons ON coupons FOR ALL USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY admin_all_seg_rules ON coupon_segment_rules FOR ALL USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY admin_all_redemptions ON coupon_redemptions FOR ALL USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Kullanıcı: sadece kendi redemption'larını okur
DO $$ BEGIN
  CREATE POLICY user_own_redemptions ON coupon_redemptions FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. redeem_coupon_atomic ──────────────────────────────────
-- ACID garantili kupon kullanımı.
--
-- Concurrency stratejisi:
--   SELECT ... FOR UPDATE → row-level exclusive lock alır.
--   Eşzamanlı 10 istek gelirse; ilk transaction lock'ı alır,
--   diğerleri COMMIT/ROLLBACK'i bekler. Lock kalkınca usage_limit
--   güncel sayıyla kontrol edilir → limit aşımı imkânsız.

CREATE OR REPLACE FUNCTION redeem_coupon_atomic(
  p_coupon_id     UUID,
  p_user_id       UUID,
  p_order_id      UUID,
  p_subtotal      NUMERIC,
  p_discount_amt  NUMERIC,
  p_segment       TEXT    DEFAULT NULL,
  p_ip_address    TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon        coupons%ROWTYPE;
  v_user_count    INT;
  v_redemption_id UUID;
BEGIN
  -- ── Adım 1: Pessimistic Row Lock ─────────────────────────
  -- FOR UPDATE: diğer eşzamanlı transaction'lar bu satırı
  -- okuyamazlar (READ COMMITTED altında) veya beklerler (REPEATABLE READ+).
  -- Transaction commit/rollback olana kadar lock tutulur.
  SELECT * INTO v_coupon
  FROM   coupons
  WHERE  id = p_coupon_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'COUPON_NOT_FOUND');
  END IF;

  -- ── Adım 2: Koşul kontrolleri (lock sonrası — kesin durum) ─
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'COUPON_INACTIVE');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'COUPON_EXPIRED');
  END IF;

  -- Global limit kontrolü — lock alındıktan sonra yapılır;
  -- optimistic check'ten (TypeScript) kaçan concurrent isteği yakalar.
  IF v_coupon.usage_limit IS NOT NULL
     AND v_coupon.usage_count >= v_coupon.usage_limit THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'COUPON_EXHAUSTED');
  END IF;

  -- Kullanıcı başına limit (RELEASED olmayanlar sayılır)
  SELECT COUNT(*) INTO v_user_count
  FROM   coupon_redemptions
  WHERE  coupon_id = p_coupon_id
    AND  user_id   = p_user_id
    AND  status   <> 'RELEASED';

  IF v_user_count >= v_coupon.usage_limit_per_user THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'USER_LIMIT_EXCEEDED');
  END IF;

  -- Minimum sipariş tutarı (TypeScript'te de kontrol edilir; burada kesin doğrulama)
  IF p_subtotal < v_coupon.min_order_amount THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'MIN_ORDER_NOT_MET',
      'detail',  jsonb_build_object(
        'required', v_coupon.min_order_amount,
        'current',  p_subtotal
      )
    );
  END IF;

  -- ── Adım 3: Kullanım sayacını artır ──────────────────────
  UPDATE coupons
  SET    usage_count = usage_count + 1
  WHERE  id          = p_coupon_id;

  -- ── Adım 4: Redemption kaydı oluştur ─────────────────────
  INSERT INTO coupon_redemptions (
    coupon_id, user_id, order_id,
    discount_amount, subtotal_at_redemption,
    applied_segment, ip_address, status
  ) VALUES (
    p_coupon_id, p_user_id, p_order_id,
    p_discount_amt, p_subtotal,
    p_segment, p_ip_address::INET, 'RESERVED'
  )
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success',       TRUE,
    'redemption_id', v_redemption_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Transaction otomatik rollback olur; kullanım sayacı geri alınır
  RETURN jsonb_build_object(
    'success', FALSE,
    'error',   'INTERNAL_ERROR',
    'detail',  SQLERRM
  );
END;
$$;

-- ── 9. release_coupon_atomic ─────────────────────────────────
-- Ödeme başarısız / sipariş iptal durumunda rezervasyonu geri al.
-- expire_pending_orders RPC bu fonksiyonu çağırır.

CREATE OR REPLACE FUNCTION release_coupon_atomic(
  p_redemption_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon_id UUID;
  v_status    redemption_status;
BEGIN
  SELECT coupon_id, status
  INTO   v_coupon_id, v_status
  FROM   coupon_redemptions
  WHERE  id = p_redemption_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'REDEMPTION_NOT_FOUND');
  END IF;

  IF v_status <> 'RESERVED' THEN
    -- CONFIRMED veya zaten RELEASED — idempotent yanıt
    RETURN jsonb_build_object(
      'success', v_status = 'RELEASED',
      'error',   CASE WHEN v_status = 'CONFIRMED'
                      THEN 'ALREADY_CONFIRMED'
                      ELSE 'ALREADY_RELEASED' END
    );
  END IF;

  UPDATE coupon_redemptions
  SET    status = 'RELEASED', released_at = now()
  WHERE  id     = p_redemption_id;

  -- Sayacı geri al (GREATEST 0 ile: negatife düşme engeli)
  UPDATE coupons
  SET    usage_count = GREATEST(usage_count - 1, 0)
  WHERE  id          = v_coupon_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ── 10. confirm_coupon_redemption ────────────────────────────
-- Ödeme başarılı olduğunda (Iyzico callback) çağrılır.

CREATE OR REPLACE FUNCTION confirm_coupon_redemption(
  p_redemption_id UUID,
  p_order_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coupon_redemptions
  SET    status       = 'CONFIRMED',
         confirmed_at = now(),
         order_id     = COALESCE(p_order_id, order_id)
  WHERE  id     = p_redemption_id
    AND  status = 'RESERVED';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'REDEMPTION_NOT_FOUND_OR_ALREADY_PROCESSED'
    );
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ── 11. expire_pending_orders entegrasyonu ───────────────────
-- Mevcut expire_pending_orders fonksiyonunu güncelle:
-- PENDING sipariş expire olduğunda bağlı redemption'ı da release et.
-- NOT: Bu patch mevcut fonksiyonun sonuna eklenir.
-- Kendi expire_pending_orders implementasyonunuza aşağıdaki bloğu ekleyin:
--
-- FOR v_order IN SELECT id, redemption_id FROM orders
--               WHERE id = ANY(p_order_ids) AND status = 'PENDING'
-- LOOP
--   IF v_order.redemption_id IS NOT NULL THEN
--     PERFORM release_coupon_atomic(v_order.redemption_id);
--   END IF;
-- END LOOP;

-- ── 12. place_order_atomic — Kupon alanları patch ──────────────
-- orders tablosuna coupon_id / coupon_code eklendi (migration 024 adım 5).
-- place_order_atomic (migration 013) bu alanları bilmiyordu.
-- CREATE OR REPLACE ile sadece INSERT bloğunu genişletiyoruz;
-- stok / kalem / history mantığı değişmez.

CREATE OR REPLACE FUNCTION place_order_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id      UUID;
  v_order_number  TEXT;
  v_item          JSONB;
BEGIN
  -- ── 1. SİPARİŞ KAYDI (kupon alanları dahil) ──────────────────
  INSERT INTO orders (
    user_id,
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
    customer_note,
    -- Yeni: Kupon snapshot — NULL geçilirse kupon yok demektir
    coupon_id,
    coupon_code
  ) VALUES (
    (p_payload->>'user_id')::UUID,
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
    NULLIF(p_payload->>'customer_note', ''),
    NULLIF(p_payload->>'coupon_id', '')::UUID,
    NULLIF(p_payload->>'coupon_code', '')
  )
  RETURNING id, order_number
  INTO v_order_id, v_order_number;

  -- ── 2. SİPARİŞ KALEMLERİ ─────────────────────────────────────
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
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      v_item->>'product_slug',
      NULLIF(v_item->>'product_image', ''),
      (v_item->>'width_cm')::DECIMAL,
      (v_item->>'height_cm')::DECIMAL,
      (v_item->>'pile_factor')::pile_factor,
      NULLIF(v_item->>'pleat_ratio_id', '')::UUID,
      NULLIF(v_item->>'pleat_name_snapshot', ''),
      NULLIF(v_item->>'mechanism_direction', '')::mechanism_direction,
      NULLIF(v_item->>'calculation_type_snapshot', ''),
      (v_item->>'area_m2')::DECIMAL,
      (v_item->>'price_per_m2_snapshot')::DECIMAL,
      (v_item->>'pile_coefficient')::DECIMAL,
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'total_price')::DECIMAL
    );

    -- ── 3. STOK DÜŞÜRME ────────────────────────────────────────
    PERFORM check_and_deduct_stock(
      (v_item->>'product_id')::UUID,
      (v_item->>'stock_deduct_m2')::DECIMAL
    );
  END LOOP;

  -- ── 4. İLK DURUM TARİHÇESİ ───────────────────────────────────
  INSERT INTO order_status_history (
    order_id, previous_status, new_status,
    changed_by_role, note, is_customer_visible
  ) VALUES (
    v_order_id, NULL, 'PENDING',
    'system', 'Siparişiniz alındı. Ödeme bekleniyor.', true
  );

  RETURN jsonb_build_object(
    'success',      true,
    'order_id',     v_order_id,
    'order_number', v_order_number
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[place_order_atomic] Hata: %, SQLSTATE: %', SQLERRM, SQLSTATE;
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM,
    'code',    SQLSTATE
  );
END;
$$;

-- ── 13. Yardımcı View: Aktif kampanya özeti (admin için) ─────

CREATE OR REPLACE VIEW v_campaign_summary AS
SELECT
  c.id,
  c.name,
  c.status,
  c.starts_at,
  c.ends_at,
  COUNT(DISTINCT cu.id)                              AS coupon_count,
  SUM(cu.usage_count)                                AS total_redemptions,
  SUM(cr.discount_amount) FILTER (WHERE cr.status = 'CONFIRMED') AS confirmed_discount_total
FROM campaigns c
LEFT JOIN coupons cu ON cu.campaign_id = c.id
LEFT JOIN coupon_redemptions cr ON cr.coupon_id = cu.id
GROUP BY c.id, c.name, c.status, c.starts_at, c.ends_at;
