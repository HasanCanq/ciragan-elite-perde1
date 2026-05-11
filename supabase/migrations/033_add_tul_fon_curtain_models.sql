-- ============================================================
-- Migration 033: Tül ve Fon perde modellerini ekle
-- ============================================================
-- Amaç: curtain_models tablosuna "Tül" ve "Fon" tiplerini
--       ekle; Perde Seçim Asistanı bu modelleri ürün
--       seçiminde kullanabilsin.
-- ============================================================

BEGIN;

INSERT INTO curtain_models
  (name, slug, max_width_cm, max_height_cm, description, display_order)
VALUES
  ('Tül',  'tul',  600, 350,
   'Şeffaf, ince dokulu perde. Işığı geçirir, mahremiyet sağlar. Fon perde ile kombine kullanılır.',  7),
  ('Fon',  'fon',  600, 350,
   'Kalın ve opak kumaştan yapılan klasik perde. Isı ve ışık yalıtımı sağlar.',                       8)
ON CONFLICT (slug) DO NOTHING;

-- Salon: Tül + Fon ekle
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'tul' THEN 'Salona derinlik ve zarafet katın; dışarıyı görerek mahremiyet sağlayın.'
    WHEN 'fon' THEN 'Sıcak kumaş dokusuyla salonunuza şıklık ve konfor katın.'
  END,
  CASE m.slug
    WHEN 'tul' THEN 4
    WHEN 'fon' THEN 5
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'salon'
  AND m.slug IN ('tul', 'fon')
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Yatak Odası: Tül + Fon ekle
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'tul' THEN 'Sabah ışığını içeri alırken göz kamaştırmadan yumuşatır.'
    WHEN 'fon' THEN 'Gün ışığını tamamen keser, huzurlu ve derin uyku sağlar.'
  END,
  CASE m.slug
    WHEN 'tul' THEN 4
    WHEN 'fon' THEN 5
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'yatak-odasi'
  AND m.slug IN ('tul', 'fon')
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Çocuk Odası: Tül ekle
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  'Eğlenceli ve renkli tül seçenekleriyle çocuğun odasını aydınlatın.',
  4
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'cocuk-odasi'
  AND m.slug = 'tul'
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Ofis: Tül ekle
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  'Doğal ışığı filtreler, ekran parlamasını azaltır; ferah ve üretken çalışma ortamı.',
  4
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'ofis'
  AND m.slug = 'tul'
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Doğrulama
DO $$
DECLARE
  v_tul_exists BOOLEAN;
  v_fon_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM curtain_models WHERE slug = 'tul') INTO v_tul_exists;
  SELECT EXISTS (SELECT 1 FROM curtain_models WHERE slug = 'fon') INTO v_fon_exists;

  RAISE NOTICE '=== Migration 033 Doğrulama ===';
  RAISE NOTICE 'Tül modeli: %', CASE WHEN v_tul_exists THEN 'EKLENDI ✓' ELSE 'EKSIK ✗' END;
  RAISE NOTICE 'Fon modeli: %', CASE WHEN v_fon_exists THEN 'EKLENDI ✓' ELSE 'EKSIK ✗' END;
END $$;

COMMIT;
