-- Migration 030: Ölçü kılavuzları tablosu + categories bağlantısı
-- Her kategori türü (fon, tül, zebra-stor-ahşap) için
-- admin panelinden yönetilen PNG kılavuz görseli.

-- ── 1. Ana tablo ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS measurement_guides (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_key   text        NOT NULL UNIQUE,
  title       text        NOT NULL,
  image_url   text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  measurement_guides              IS 'Ölçü alma kılavuzu görselleri (kategori başına bir PNG).';
COMMENT ON COLUMN measurement_guides.guide_key    IS 'Benzersiz anahtar: fon | tul | zebra-stor-ahsap';
COMMENT ON COLUMN measurement_guides.image_url    IS 'Supabase Storage public URL (PNG çizim görseli).';

-- ── 2. RLS ───────────────────────────────────────────────────
ALTER TABLE measurement_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public: aktif kılavuzları oku"
  ON measurement_guides FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin: kılavuzları yönet"
  ON measurement_guides FOR ALL
  USING (is_admin());

-- ── 3. Seed — başlangıç kayıtları ───────────────────────────
INSERT INTO measurement_guides (guide_key, title) VALUES
  ('fon',             'Fon Perde Ölçüsü Nasıl Alınır?'),
  ('tul',             'Tül Perde Ölçüsü Nasıl Alınır?'),
  ('zebra-stor-ahsap','Zebra / Stor / Ahşap Jaluzi Ölçüsü Nasıl Alınır?')
ON CONFLICT (guide_key) DO NOTHING;

-- ── 4. categories tablosuna bağlantı kolonu ──────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS measurement_guide_key text
  REFERENCES measurement_guides(guide_key)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

COMMENT ON COLUMN categories.measurement_guide_key IS
  'Bu kategorinin ölçü kılavuzu (measurement_guides.guide_key FK).';

-- ── 5. updated_at otomatik güncelleme ────────────────────────
CREATE OR REPLACE FUNCTION update_measurement_guides_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_measurement_guides_updated_at
  BEFORE UPDATE ON measurement_guides
  FOR EACH ROW EXECUTE FUNCTION update_measurement_guides_updated_at();
