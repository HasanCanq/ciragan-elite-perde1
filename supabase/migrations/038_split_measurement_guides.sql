-- Migration 038: zebra-stor-ahsap kılavuzunu 3 ayrı kılavuza böl

-- ── 1. Yeni ayrı kılavuz kayıtları ─────────────────────────────
INSERT INTO measurement_guides (guide_key, title) VALUES
  ('zebra',       'Zebra Perde Ölçüsü Nasıl Alınır?'),
  ('stor',        'Stor Perde Ölçüsü Nasıl Alınır?'),
  ('ahsap-jaluzi','Ahşap Jaluzi Ölçüsü Nasıl Alınır?')
ON CONFLICT (guide_key) DO NOTHING;

-- ── 2. Kategorileri yeni anahtarlara taşı ──────────────────────
UPDATE categories SET measurement_guide_key = 'zebra'
  WHERE measurement_guide_key = 'zebra-stor-ahsap'
    AND (slug ILIKE '%zebra%');

UPDATE categories SET measurement_guide_key = 'stor'
  WHERE measurement_guide_key = 'zebra-stor-ahsap'
    AND (slug ILIKE '%stor%');

UPDATE categories SET measurement_guide_key = 'ahsap-jaluzi'
  WHERE measurement_guide_key = 'zebra-stor-ahsap'
    AND (slug ILIKE '%ahsap%' OR slug ILIKE '%jaluzi%');

-- ── 3. Eski birleşik kaydı pasife al ───────────────────────────
UPDATE measurement_guides
  SET is_active = false
  WHERE guide_key = 'zebra-stor-ahsap';
