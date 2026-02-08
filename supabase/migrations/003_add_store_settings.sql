-- =====================================================
-- STORE SETTINGS TABLE
-- =====================================================
-- Single-row table for storing global store settings

CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_name VARCHAR(255) NOT NULL DEFAULT 'Çırağan Elite Perde',
  support_email VARCHAR(255) NOT NULL DEFAULT 'info@ciraganeliteperde.com',
  support_phone VARCHAR(20) NOT NULL DEFAULT '0532 295 95 86',
  free_shipping_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5000.00,
  shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure only one row exists
  CONSTRAINT single_row_settings CHECK (id = gen_random_uuid())
);

-- Insert default settings
INSERT INTO store_settings (
  id,
  site_name,
  support_email,
  support_phone,
  free_shipping_threshold,
  shipping_cost,
  maintenance_mode
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Çırağan Elite Perde',
  'info@ciraganeliteperde.com',
  '0532 295 95 86',
  5000.00,
  150.00,
  FALSE
) ON CONFLICT (id) DO NOTHING;

-- Remove the constraint to allow the single row to exist
ALTER TABLE store_settings DROP CONSTRAINT IF EXISTS single_row_settings;

-- Add constraint to prevent multiple rows
CREATE UNIQUE INDEX IF NOT EXISTS single_settings_row ON store_settings ((id IS NOT NULL));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON store_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_store_settings_timestamp();

-- RLS Policies
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read settings"
  ON store_settings
  FOR SELECT
  USING (true);

-- Only admins can update settings
CREATE POLICY "Only admins can update settings"
  ON store_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

COMMENT ON TABLE store_settings IS 'Global store settings - single row table';
COMMENT ON COLUMN store_settings.free_shipping_threshold IS 'Minimum order amount for free shipping in TL';
COMMENT ON COLUMN store_settings.shipping_cost IS 'Standard shipping cost in TL';
COMMENT ON COLUMN store_settings.maintenance_mode IS 'Enable to put the store in maintenance mode';
