-- ============================================================
-- Migration 020: products tablosuna eksik stok alanları
-- ============================================================
-- low_stock_threshold hiçbir migration'da tanımlanmamıştı,
-- stock_quantity ise INTEGER → NUMERIC'e yükseltiliyor
-- (form 0.5 adımlı ondalık değer gönderiyor).
-- ============================================================

BEGIN;

-- low_stock_threshold: bu değerin altına düşünce uyarı verilir
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10,2) DEFAULT 5 NOT NULL;

-- stock_quantity: INTEGER → NUMERIC (ondalıklı m² desteği)
-- Önce mevcut kolonu USING ile dönüştür
ALTER TABLE products
  ALTER COLUMN stock_quantity TYPE NUMERIC(10,2)
  USING stock_quantity::NUMERIC(10,2);

-- model_id: migration 019 çalıştırılmamış ortamlar için güvenli ekleme
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS model_id UUID
    DEFAULT NULL
    REFERENCES curtain_models(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_model_id
  ON products(model_id)
  WHERE model_id IS NOT NULL;

COMMIT;
