-- =====================================================
-- SHOP ENABLED SETTING
-- =====================================================
-- Adds shop_enabled flag to store_settings.
-- When FALSE, the purchase button is hidden site-wide.
-- Admins can toggle this from /admin/settings.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS shop_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Update the existing single row to have shop_enabled = true
UPDATE store_settings
SET shop_enabled = TRUE
WHERE id = '00000000-0000-0000-0000-000000000001';

COMMENT ON COLUMN store_settings.shop_enabled IS
  'When false, the add-to-cart / purchase button is hidden on all product pages.';
