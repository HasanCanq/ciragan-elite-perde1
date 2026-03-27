-- ============================================================
-- Migration 014: Soft Delete + Audit Logging Altyapısı
-- ============================================================
-- Amaç:
--   1. products, categories, orders, profiles tablolarına
--      deleted_at kolonu ekleme (Soft Delete)
--   2. RLS politikalarını soft-delete filtreleyecek şekilde güncelleme
--   3. audit_logs tablosu oluşturma (kim, ne, ne zaman, ne değişti)
--   4. DB-level trigger: products ve orders değişimlerini otomatik logla
--   5. log_audit_event() yardımcı RPC (TypeScript çağrısı için)
--
-- GÜVENLİK:
--   • Mevcut tüm kayıtlar etkilenmez (deleted_at = NULL başlar)
--   • RLS politikaları güncellenir; silinmiş kayıtlar API'den gizlenir
--   • audit_logs INSERT-ONLY (UPDATE/DELETE yasak — denetim izi bozulamaz)
--
-- ROLLBACK: altta hazır
-- ============================================================

BEGIN;

-- ============================================================
-- BÖLÜM 1: SOFT DELETE — deleted_at KOLONLARI
-- ============================================================

-- 1a. products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN products.deleted_at IS
  'Soft delete timestamp. NULL = aktif kayıt. '
  'Dolu = güvenli silinmiş; fiziksel DELETE yapılmaz.';

CREATE INDEX IF NOT EXISTS idx_products_not_deleted
  ON products(id) WHERE deleted_at IS NULL;

-- 1b. categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN categories.deleted_at IS
  'Soft delete timestamp. NULL = aktif kategori.';

CREATE INDEX IF NOT EXISTS idx_categories_not_deleted
  ON categories(id) WHERE deleted_at IS NULL;

-- 1c. orders — siparişler hiçbir zaman fiziksel silinmez (fatura uyumu)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN orders.deleted_at IS
  'Soft delete timestamp. Siparişler asla fiziksel silinmez; '
  'yalnızca admin görünümünden gizlenebilir.';

CREATE INDEX IF NOT EXISTS idx_orders_not_deleted
  ON orders(id) WHERE deleted_at IS NULL;

-- 1d. profiles (users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN profiles.deleted_at IS
  'Soft delete timestamp. KVKK "Unutulma Hakkı" kapsamında '
  'profil anonimleştirildikten sonra bu alan set edilir.';

CREATE INDEX IF NOT EXISTS idx_profiles_not_deleted
  ON profiles(id) WHERE deleted_at IS NULL;


-- ============================================================
-- BÖLÜM 2: RLS POLİTİKALARI GÜNCELLEMESİ
-- ============================================================
-- Mevcut politikalar silinip soft-delete filtreyle yeniden yazılır.

-- ── products ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can view published products"  ON products;
DROP POLICY IF EXISTS "Admins can view all products"        ON products;
DROP POLICY IF EXISTS "Admins can delete products"          ON products;

-- Anonim/authenticated: yayımdaki VE silinmemiş ürünler
CREATE POLICY "Public can view published products"
  ON products FOR SELECT
  USING (is_published = true AND deleted_at IS NULL);

-- Admin: silinmemiş tüm ürünler (taslaklar dahil); silinmişleri göremez
-- (silinmişleri görmek için service_role veya özel admin view gerekir)
CREATE POLICY "Admins can view all products"
  ON products FOR SELECT
  USING (is_admin() AND deleted_at IS NULL);

-- Admin DELETE: hard delete artık yasak — soft delete UPDATE kullanılır
-- Bu politika bırakılırsa service_role hariç DELETE imkânsız olur.
-- Kasıtlı olarak DROP ediliyor; admin silme işlemi UPDATE'e yönlendirildi.
-- (Fiziksel temizlik için ayrı bir cron + service_role gerekir)

-- ── categories ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can view categories"  ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

CREATE POLICY "Public can view categories"
  ON categories FOR SELECT
  USING (deleted_at IS NULL);

-- ── orders ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own orders"   ON orders;
DROP POLICY IF EXISTS "Admins can view all orders"  ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  USING (is_admin() AND deleted_at IS NULL);

-- ── profiles ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own profile"    ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"  ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id AND deleted_at IS NULL);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin() AND deleted_at IS NULL);


-- ============================================================
-- BÖLÜM 3: audit_logs TABLOSU
-- ============================================================
-- INSERT-ONLY tablo. UPDATE ve DELETE politikaları kasıtlı YOK.
-- Denetim izinin bütünlüğü bozulamaz.
--
-- Tasarım kararları:
--   • old_values / new_values JSONB (nokta sorgusu, GIN index)
--   • table_name + record_id kombinasyonu için BRIN/BTREE index
--   • Partitioning: büyük sistemlerde yıllık partition önerilir
--     (bu migration'da eklenmedi — ileride eklenebilir)

CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Kim yaptı?
  user_id      UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   TEXT,        -- snapshot: kullanıcı silinse bile log korunur

  -- Ne yaptı?
  action       TEXT         NOT NULL
                 CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE')),

  -- Nerede?
  table_name   TEXT         NOT NULL,
  record_id    UUID         NOT NULL,

  -- Ne değişti?
  old_values   JSONB,       -- UPDATE/DELETE/SOFT_DELETE: değişmeden önceki veriler
  new_values   JSONB,       -- CREATE/UPDATE: yeni veriler

  -- Nereden?
  ip_address   TEXT,
  user_agent   TEXT,

  -- Ne zaman?
  created_at   TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

-- Performans indexleri
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record
  ON audit_logs(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

-- JSONB alanları için GIN index (old/new values içinde arama için)
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values
  ON audit_logs USING GIN (old_values jsonb_path_ops)
  WHERE old_values IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values
  ON audit_logs USING GIN (new_values jsonb_path_ops)
  WHERE new_values IS NOT NULL;

COMMENT ON TABLE audit_logs IS
  'INSERT-ONLY denetim izi tablosu. '
  'Kimin, ne zaman, hangi kayıtta ne değiştirdiğini saklar. '
  'UPDATE ve DELETE politikası kasıtlı yoktur — izler silinemez.';

COMMENT ON COLUMN audit_logs.old_values IS
  'Değişmeden önceki alanlar (JSONB). '
  'Hassas alanlar (password_hash, token vb.) dahil edilmemelidir.';

COMMENT ON COLUMN audit_logs.new_values IS
  'Yeni değerler (JSONB). '
  'Hassas alanlar dahil edilmemelidir.';

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Yalnızca adminler okuyabilir
CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

-- INSERT: authenticated kullanıcılar (trigger + TypeScript service kullanır)
CREATE POLICY "Authenticated can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Service role (trigger içinde): her şeyi yapabilir
-- (Supabase service_role politika bypass eder — bu zaten var)


-- ============================================================
-- BÖLÜM 4: DB TRIGGER — OTOMATİK AUDIT LOGGING
-- ============================================================
-- products ve orders tablolarındaki her INSERT/UPDATE/SOFT_DELETE
-- otomatik olarak audit_logs'a yazılır.
-- user_id: auth.uid() (RLS context) veya NULL (cron/service_role)

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action      TEXT;
  v_old_values  JSONB := NULL;
  v_new_values  JSONB := NULL;
  v_record_id   UUID;
  v_user_email  TEXT;
BEGIN
  -- ── Aksiyonu belirle ──────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    v_action     := 'CREATE';
    v_new_values := to_jsonb(NEW);
    v_record_id  := NEW.id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Fiziksel silme (artık yasak ama olursa logla)
    v_action     := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_record_id  := OLD.id;

  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;

    -- Soft delete mi, restore mu, normal update mı?
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_action := 'RESTORE';
    ELSE
      v_action := 'UPDATE';
    END IF;

    -- Sadece DEĞIŞEN alanları logla (gürültüyü azalt, depoyu koru)
    SELECT jsonb_object_agg(key, value)
    INTO v_old_values
    FROM jsonb_each(to_jsonb(OLD))
    WHERE to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key;

    SELECT jsonb_object_agg(key, value)
    INTO v_new_values
    FROM jsonb_each(to_jsonb(NEW))
    WHERE to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key;
  END IF;

  -- ── Hassas alanları çıkar ─────────────────────────────────────────────
  -- Kart numarası, şifre hash'i vb. log'a yazılmaz.
  -- Supabase projemizde şu an bu alanlar yok; ileride eklenirlerse buraya ekle.
  -- Örn: v_new_values := v_new_values - 'password_hash' - 'card_number';

  -- ── Kullanıcı e-postasını al (snapshot için) ──────────────────────────
  BEGIN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_email := NULL;
  END;

  -- ── audit_logs'a yaz ─────────────────────────────────────────────────
  -- EXCEPTION bloğu: log hatası asıl işlemi engellememelidir.
  BEGIN
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      auth.uid(),
      v_user_email,
      v_action,
      TG_TABLE_NAME,
      v_record_id,
      v_old_values,
      v_new_values
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log hatası sessizce yutulur — asıl transaction korunur
    RAISE WARNING '[audit_log_trigger] Log yazılamadı: % — %', TG_TABLE_NAME, SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_log_trigger() IS
  'Genel amaçlı audit log trigger fonksiyonu. '
  'Yalnızca değişen alanları loglar (fark bazlı). '
  'Log hatası asıl transaction''ı engellemez.';

-- Trigger: products
DROP TRIGGER IF EXISTS audit_products ON products;
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- Trigger: categories
DROP TRIGGER IF EXISTS audit_categories ON categories;
CREATE TRIGGER audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- Trigger: orders
DROP TRIGGER IF EXISTS audit_orders ON orders;
CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();


-- ============================================================
-- BÖLÜM 5: log_audit_event() — TypeScript'ten Çağrılabilir RPC
-- ============================================================
-- TypeScript server action'larının ip_address ve user_agent gibi
-- HTTP context'e özgü bilgileri log'a eklemek için kullandığı yardımcı.

CREATE OR REPLACE FUNCTION log_audit_event(
  p_action      TEXT,
  p_table_name  TEXT,
  p_record_id   UUID,
  p_old_values  JSONB DEFAULT NULL,
  p_new_values  JSONB DEFAULT NULL,
  p_ip_address  TEXT DEFAULT NULL,
  p_user_agent  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id     UUID;
  v_user_email TEXT;
BEGIN
  -- Aksiyon whitelist kontrolü
  IF p_action NOT IN ('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE') THEN
    RAISE EXCEPTION 'Geçersiz audit action: %', p_action;
  END IF;

  BEGIN
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_email := NULL;
  END;

  INSERT INTO audit_logs (
    user_id, user_email, action, table_name, record_id,
    old_values, new_values, ip_address, user_agent
  ) VALUES (
    auth.uid(), v_user_email, p_action, p_table_name, p_record_id,
    p_old_values, p_new_values, p_ip_address, p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, TEXT, UUID, JSONB, JSONB, TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION log_audit_event IS
  'TypeScript server action''larından çağrılır. '
  'ip_address, user_agent gibi HTTP context bilgilerini loga ekler. '
  'DB trigger''ın yakalayamadığı uygulama katmanı olayları için kullanılır.';


-- ============================================================
-- BÖLÜM 6: soft_delete() ve restore() YARDIMCI RPC'LER
-- ============================================================
-- TypeScript'te manuel .update({deleted_at: new Date()}) yerine
-- bu RPC'leri kullanmak audit log'un tutarlı kalmasını sağlar.

CREATE OR REPLACE FUNCTION soft_delete_record(
  p_table_name TEXT,
  p_record_id  UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Yalnızca whitelist'teki tablolara izin ver (SQL injection koruması)
  IF p_table_name NOT IN ('products', 'categories', 'orders', 'profiles') THEN
    RAISE EXCEPTION 'soft_delete_record: izin verilmeyen tablo: %', p_table_name;
  END IF;

  -- Admin yetkisi kontrolü
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'soft_delete_record: yetersiz yetki';
  END IF;

  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL',
    p_table_name
  ) USING p_record_id;

  -- audit_log_trigger otomatik tetiklenecek (zaten kaydediliyor)
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_record(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION restore_record(
  p_table_name TEXT,
  p_record_id  UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_table_name NOT IN ('products', 'categories', 'orders', 'profiles') THEN
    RAISE EXCEPTION 'restore_record: izin verilmeyen tablo: %', p_table_name;
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'restore_record: yetersiz yetki';
  END IF;

  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NOT NULL',
    p_table_name
  ) USING p_record_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION restore_record(TEXT, UUID) TO authenticated;


-- ============================================================
-- BÖLÜM 7: DOĞRULAMA
-- ============================================================

DO $$
DECLARE col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE column_name = 'deleted_at'
    AND table_name IN ('products', 'categories', 'orders', 'profiles');

  IF col_count = 4 THEN
    RAISE NOTICE 'Soft delete: 4 tabloya deleted_at eklendi ✓';
  ELSE
    RAISE WARNING 'Soft delete: beklenen 4, bulunan %', col_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    RAISE NOTICE 'audit_logs tablosu oluşturuldu ✓';
  ELSE
    RAISE WARNING 'audit_logs tablosu bulunamadı!';
  END IF;

  RAISE NOTICE 'Migration 014 tamamlandı.';
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
--   DROP TRIGGER IF EXISTS audit_products   ON products;
--   DROP TRIGGER IF EXISTS audit_categories ON categories;
--   DROP TRIGGER IF EXISTS audit_orders     ON orders;
--   DROP FUNCTION IF EXISTS audit_log_trigger();
--   DROP FUNCTION IF EXISTS log_audit_event(TEXT,TEXT,UUID,JSONB,JSONB,TEXT,TEXT);
--   DROP FUNCTION IF EXISTS soft_delete_record(TEXT, UUID);
--   DROP FUNCTION IF EXISTS restore_record(TEXT, UUID);
--   DROP TABLE  IF EXISTS audit_logs;
--   ALTER TABLE profiles   DROP COLUMN IF EXISTS deleted_at;
--   ALTER TABLE orders     DROP COLUMN IF EXISTS deleted_at;
--   ALTER TABLE categories DROP COLUMN IF EXISTS deleted_at;
--   ALTER TABLE products   DROP COLUMN IF EXISTS deleted_at;
--   -- RLS politikalarını eski haline döndür (manuel)
-- COMMIT;
