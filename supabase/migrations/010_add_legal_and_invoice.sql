-- ============================================================
-- Migration 010: Yasal Loglama + E-Fatura Altyapısı
-- ============================================================

-- ============================================================
-- BÖLÜM 1: YASAL BELGE VERSİYONLARI
-- ============================================================

-- Belge tipleri: ön bilgilendirme formu, mesafeli satış sözleşmesi, KVKK metni
CREATE TYPE legal_document_type AS ENUM (
  'ON_BILGILENDIRME',       -- Ön Bilgilendirme Formu (Mesafeli Satış Yönetmeliği Madde 5)
  'MESAFELI_SATIS',         -- Mesafeli Satış Sözleşmesi
  'KVKK_AYDINLATMA',        -- KVKK Aydınlatma Metni
  'CEREZ_POLITIKASI'        -- Çerez Politikası
);

-- Yasal belgeler immutable versiyonlama ile saklanır.
-- Bir versiyon yayınlandıktan sonra asla güncellenmez —
-- sadece yeni versiyon eklenir (append-only).
CREATE TABLE IF NOT EXISTS legal_document_versions (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type   legal_document_type NOT NULL,
  version         varchar(20)   NOT NULL,             -- Örn: "v2.1", "2024-03"
  content_hash    char(64)      NOT NULL,             -- SHA-256 hex digest (belgenin tam metninin fingerprint'i)
  content_url     text,                               -- Belgenin erişilebilir URL'i (S3/Supabase Storage)
  is_active       boolean       NOT NULL DEFAULT false,
  published_at    timestamptz   NOT NULL DEFAULT now(),
  created_by      uuid          REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT uq_legal_doc_version UNIQUE (document_type, version),
  CONSTRAINT uq_legal_doc_hash    UNIQUE (content_hash)  -- Aynı içerik iki kez publish edilemez
);

-- Bir belge tipinde en fazla bir aktif versiyon olabilir
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_per_doc_type
  ON legal_document_versions (document_type)
  WHERE is_active = true;

-- ============================================================
-- BÖLÜM 2: SİPARİŞ YASAL LOGLARI (Denetim İzi)
-- ============================================================

-- Her sipariş onayında müşterinin dijital ayak izini saklar.
-- KVKK + Mesafeli Satış Yönetmeliği uyum kaydı.
-- Bu tablo INSERT-ONLY: güncelleme ve silme yasak (trigger ile korunur).
CREATE TABLE IF NOT EXISTS order_legal_logs (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Dijital Ayak İzi
  ip_address              inet        NOT NULL,                    -- PostgreSQL inet tip: IPv4/IPv6
  user_agent              text        NOT NULL,
  consented_at            timestamptz NOT NULL DEFAULT now(),

  -- Onaylanan belgeler (versiyon referansları)
  -- JSONB array: [{document_type, version_id, content_hash}]
  consented_documents     jsonb       NOT NULL DEFAULT '[]',

  -- Ek bağlam (checkout_session_id, payment_method vb.)
  metadata                jsonb       NOT NULL DEFAULT '{}',

  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_order_legal_log UNIQUE (order_id)  -- Sipariş başına bir kayıt
);

CREATE INDEX IF NOT EXISTS idx_order_legal_logs_order_id
  ON order_legal_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_legal_logs_user_id
  ON order_legal_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_order_legal_logs_consented_at
  ON order_legal_logs(consented_at DESC);

-- INSERT-ONLY koruma trigger'ı: güncelleme ve silmeyi engelle
CREATE OR REPLACE FUNCTION prevent_legal_log_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'order_legal_logs tablosu insert-only''dur, kayıtlar değiştirilemez';
END;
$$;

CREATE TRIGGER trg_immutable_legal_log
  BEFORE UPDATE OR DELETE ON order_legal_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_legal_log_modification();

-- RLS
ALTER TABLE legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_legal_logs        ENABLE ROW LEVEL SECURITY;

-- Herkes aktif belgeleri okuyabilir (checkout sayfasında göstermek için)
CREATE POLICY "Public can read active legal documents"
  ON legal_document_versions FOR SELECT
  USING (is_active = true);

-- Kullanıcı kendi yasal loglarını görebilir
CREATE POLICY "Users can view own legal logs"
  ON order_legal_logs FOR SELECT
  USING (user_id = auth.uid());

-- Admin her şeyi yapabilir
CREATE POLICY "Admins full access legal documents"
  ON legal_document_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

CREATE POLICY "Admins can read all legal logs"
  ON order_legal_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ============================================================
-- BÖLÜM 3: SİPARİŞ + YASAL LOG ATOMİK KAYIT FONKSİYONU
-- ============================================================

-- Sipariş oluştururken legal log'u da aynı transaction'da eklememizi sağlar.
CREATE OR REPLACE FUNCTION insert_order_legal_log(
  p_order_id            uuid,
  p_user_id             uuid,
  p_ip_address          text,
  p_user_agent          text,
  p_consented_documents jsonb,   -- [{document_type, version_id, content_hash}]
  p_metadata            jsonb    DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO order_legal_logs (
    order_id,
    user_id,
    ip_address,
    user_agent,
    consented_documents,
    metadata
  ) VALUES (
    p_order_id,
    p_user_id,
    p_ip_address::inet,
    p_user_agent,
    p_consented_documents,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_order_legal_log TO authenticated;

-- ============================================================
-- BÖLÜM 4: E-FATURA OUTBOX TABLOSU
-- ============================================================

CREATE TYPE invoice_outbox_status AS ENUM (
  'PENDING',      -- Fatura kuyruğa eklendi
  'PROCESSING',   -- Worker tarafından alındı
  'COMPLETED',    -- Entegratör faturayı oluşturdu
  'FAILED'        -- Max retry aşıldı
);

CREATE TYPE invoice_type AS ENUM (
  'E_ARSIV',    -- e-Arşiv Fatura (B2C, TCKN opsiyonel)
  'E_FATURA',   -- e-Fatura (B2B, VKN zorunlu)
  'E_IRSALIYE'  -- e-İrsaliye (kargo irsaliyesi, opsiyonel)
);

CREATE TABLE IF NOT EXISTS invoice_outbox (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id            uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Fatura parametreleri
  invoice_type        invoice_type NOT NULL DEFAULT 'E_ARSIV',
  provider            text        NOT NULL DEFAULT 'parasut',  -- 'parasut' | 'uyumsoft'
  invoice_data        jsonb       NOT NULL,     -- Müşteri + kalemler + tutar bilgisi

  -- Durum yönetimi
  status              invoice_outbox_status NOT NULL DEFAULT 'PENDING',
  retry_count         integer     NOT NULL DEFAULT 0,
  max_retries         integer     NOT NULL DEFAULT 4,
  next_retry_at       timestamptz NOT NULL DEFAULT now(),
  last_error          text,

  -- Başarı durumunda doldurulanlar
  invoice_number      text,        -- Entegratörden dönen fatura numarası
  invoice_uuid        text,        -- GIB UUID
  invoice_pdf_url     text,        -- PDF indirme linki
  invoice_html_url    text,        -- HTML görüntüleme linki
  issued_at           timestamptz,

  -- Müşteriye gönderim takibi
  email_sent_at       timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Aynı sipariş için aynı tipte iki fatura oluşmasın
  CONSTRAINT uq_order_invoice_type UNIQUE (order_id, invoice_type)
);

CREATE INDEX IF NOT EXISTS idx_invoice_outbox_status_retry
  ON invoice_outbox(status, next_retry_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_invoice_outbox_order_id
  ON invoice_outbox(order_id);

-- RLS
ALTER TABLE invoice_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoice outbox"
  ON invoice_outbox FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Kullanıcı kendi fatura bilgisini görebilir (pdf url vb.)
CREATE POLICY "Users can view own invoice info"
  ON invoice_outbox FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    AND status = 'COMPLETED'
  );

-- ============================================================
-- BÖLÜM 5: FATURA OUTBOX ATOMİK CLAIM FONKSİYONU
-- ============================================================

CREATE OR REPLACE FUNCTION claim_pending_invoice_jobs(p_limit integer DEFAULT 5)
RETURNS SETOF invoice_outbox
LANGUAGE sql
AS $$
  UPDATE invoice_outbox
  SET status = 'PROCESSING', updated_at = now()
  WHERE id IN (
    SELECT id FROM invoice_outbox
    WHERE status = 'PENDING'
      AND next_retry_at <= now()
      AND retry_count < max_retries
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_invoice_jobs TO service_role;

-- ============================================================
-- BÖLÜM 6: BAŞLANGIÇ VERİLERİ (Örnek Belge Versiyonları)
-- ============================================================

-- Dev/staging için örnek kayıtlar. Prodüksiyonda gerçek içeriklerle değiştirin.
-- content_hash: echo -n "placeholder" | sha256sum
INSERT INTO legal_document_versions (document_type, version, content_hash, is_active)
VALUES
  ('ON_BILGILENDIRME', 'v1.0', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', true),
  ('MESAFELI_SATIS',   'v1.0', 'b3a8e0e1f9ab1bfe3a36f231f676f78bb28a2d0acc67ce3a1e0e8d2faad6b10c', true),
  ('KVKK_AYDINLATMA',  'v1.0', 'c0535e4be2b79ffd93291305436bf889314e4a3faec05ecffcbb7df31ad9e51a', true)
ON CONFLICT DO NOTHING;
