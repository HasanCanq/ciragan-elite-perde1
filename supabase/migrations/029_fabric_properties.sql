-- Migration 029: products tablosuna fabric_properties kolonu ekle
-- Her ürünün kendi kumaş özelliklerini saklayan text dizisi.
-- Varsayılan boş dizi — mevcut ürünler etkilenmez.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fabric_properties text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN products.fabric_properties IS
  'Ürüne ait kumaş/özellik etiketleri. Örn: {''Linen %60 · Pamuk %40'', ''30°C Yıkanabilir''}';
