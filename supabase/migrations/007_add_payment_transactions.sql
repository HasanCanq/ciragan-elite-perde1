-- =====================================================
-- 007: Payment Transactions (İşlem Günlüğü)
-- Her ödeme olayını kalıcı olarak kaydeder
-- =====================================================

-- Event tipleri
CREATE TYPE payment_event_type AS ENUM (
  'PAYMENT_INITIATED',       -- Iyzico 3DS başlatma isteği gönderildi
  'THREEDS_INIT_SUCCESS',    -- Iyzico 3DS HTML başarıyla döndü
  'THREEDS_INIT_FAILED',     -- Iyzico 3DS başlatılamadı (hata kodu var)
  'CALLBACK_RECEIVED',       -- Banka 3DS callback POST geldi
  'THREEDS_AUTH_SUCCESS',    -- Ödeme auth başarılı
  'THREEDS_AUTH_FAILED',     -- 3DS doğrulama / auth başarısız
  'PAYMENT_SUCCESS',         -- Sipariş PAID olarak güncellendi
  'PAYMENT_FAILED',          -- Sipariş CANCELLED (herhangi bir aşamada)
  'AMOUNT_MISMATCH'          -- Ödenen tutar ≠ sipariş tutarı (güvenlik)
);

-- Ana tablo
CREATE TABLE payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type payment_event_type NOT NULL,

  -- Iyzico Verileri
  payment_id TEXT,              -- Iyzico paymentId
  conversation_id TEXT,         -- Iyzico conversationId (= order.id)
  md_status TEXT,               -- 3D Secure mdStatus ("1" = başarılı)
  error_code TEXT,              -- Iyzico errorCode
  error_message TEXT,           -- Iyzico errorMessage / internal hata
  auth_code TEXT,               -- Başarılı ödeme auth kodu

  -- Tutar Bilgileri
  expected_amount DECIMAL(12, 2),  -- Sipariş total_amount
  paid_amount DECIMAL(12, 2),      -- Iyzico paidPrice
  currency TEXT DEFAULT 'TRY',

  -- Metadata
  ip_address TEXT,
  raw_response JSONB,           -- Iyzico yanıtının güvenli kopyası (kart bilgisi HARİÇ)

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Performance Index'leri
CREATE INDEX idx_pt_order_id ON payment_transactions(order_id);
CREATE INDEX idx_pt_user_id ON payment_transactions(user_id);
CREATE INDEX idx_pt_event_type ON payment_transactions(event_type);
CREATE INDEX idx_pt_payment_id ON payment_transactions(payment_id);
CREATE INDEX idx_pt_created_at ON payment_transactions(created_at DESC);

-- =====================================================
-- RLS Politikaları
-- =====================================================

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi işlem kayıtlarını görebilir
CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Adminler tüm işlem kayıtlarına tam erişim
CREATE POLICY "Admins full access to payment transactions"
  ON payment_transactions
  FOR ALL
  USING (is_admin());

-- Service role insert (callback route, server actions)
-- Service role key RLS'i bypass eder, ekstra policy gerekmez
