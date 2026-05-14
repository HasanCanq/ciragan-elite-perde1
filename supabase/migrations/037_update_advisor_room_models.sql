-- ============================================================
-- Migration 037: Asistan oda/model yapılandırması güncelleme
-- ============================================================
-- Değişiklikler:
--   Salon      → Kruvaze ve Plicell kaldırıldı, Ahşap Jaluzi eklendi
--   Yatak Odası→ Kruvaze kaldırıldı, Blackout Stor eklendi
--   Mutfak     → Plicell eklendi
--   Odalar     → Çocuk Odası ve Banyo pasife alındı
-- ============================================================

BEGIN;

-- ============================================================
-- BÖLÜM 1: YENİ PERDE MODELLERİ
-- ============================================================

-- Ahşap Jaluzi model (category 034'te categories'e eklenmişti; şimdi curtain_models'a da ekleniyor)
INSERT INTO curtain_models
  (name, slug, max_width_cm, max_height_cm, description, display_order)
VALUES
  ('Ahşap Jaluzi', 'ahsap-jaluzi', 300, 280,
   'Doğal ahşap veya ahşap görünümlü PVC kanatlı jaluzi. Sıcak ve doğal doku, salonlara özel şıklık.', 9)
ON CONFLICT (slug) DO NOTHING;

-- Blackout Stor model (tam karartmalı rulo perde)
INSERT INTO curtain_models
  (name, slug, max_width_cm, max_height_cm, description, display_order)
VALUES
  ('Blackout Stor', 'blackout-stor', 400, 300,
   'Tam karartmalı rulo perde. Uyku kalitesini artırır; gün ışığını tamamen engeller.', 10)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- BÖLÜM 2: SALON GÜNCELLEMESİ
-- Kruvaze ve Plicell kaldır → Ahşap Jaluzi ekle
-- ============================================================

-- Salon: Kruvaze ve Plicell mapping'lerini kaldır
DELETE FROM room_models_mapping
WHERE room_id  = (SELECT id FROM rooms         WHERE slug = 'salon')
  AND model_id IN (
    SELECT id FROM curtain_models WHERE slug IN ('kruvaze', 'plicell')
  );

-- Salon: Kalan modellerin display_order'ını sıfırla
UPDATE room_models_mapping
SET display_order = CASE
  (SELECT slug FROM curtain_models WHERE id = model_id)
  WHEN 'ahsap-jaluzi' THEN 1
  WHEN 'zebra'        THEN 2
  WHEN 'tul'          THEN 3
  WHEN 'fon'          THEN 4
  ELSE display_order
END
WHERE room_id = (SELECT id FROM rooms WHERE slug = 'salon');

-- Salon: Ahşap Jaluzi ekle (display_order=1)
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  'Salonunuza doğal ahşap sıcaklığı katın; ışığı kademeli ayarlayın, zerafeti hissedin.',
  1
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'salon'
  AND m.slug = 'ahsap-jaluzi'
ON CONFLICT (room_id, model_id) DO NOTHING;


-- ============================================================
-- BÖLÜM 3: YATAK ODASI GÜNCELLEMESİ
-- Kruvaze kaldır → Blackout Stor ekle
-- ============================================================

-- Yatak Odası: Kruvaze mapping'ini kaldır
DELETE FROM room_models_mapping
WHERE room_id  = (SELECT id FROM rooms        WHERE slug = 'yatak-odasi')
  AND model_id = (SELECT id FROM curtain_models WHERE slug = 'kruvaze');

-- Yatak Odası: Kalan modellerin display_order'ını güncelle
UPDATE room_models_mapping
SET display_order = CASE
  (SELECT slug FROM curtain_models WHERE id = model_id)
  WHEN 'blackout'     THEN 1
  WHEN 'blackout-stor' THEN 2
  WHEN 'plicell'      THEN 3
  WHEN 'tul'          THEN 4
  WHEN 'fon'          THEN 5
  ELSE display_order
END
WHERE room_id = (SELECT id FROM rooms WHERE slug = 'yatak-odasi');

-- Yatak Odası: Blackout Stor ekle (display_order=2)
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  'Tam karartmalı rulo perde ile derin ve kesintisiz uyku. Vardiyalı çalışanlar ve bebekler için ideal.',
  2
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'yatak-odasi'
  AND m.slug = 'blackout-stor'
ON CONFLICT (room_id, model_id) DO NOTHING;


-- ============================================================
-- BÖLÜM 4: MUTFAK GÜNCELLEMESİ
-- Plicell ekle (4. sıraya)
-- ============================================================

INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  'Isı yalıtımıyla mutfak sıcaklığını dengeler; buhar ve koku geçişini azaltır.',
  4
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'mutfak'
  AND m.slug = 'plicell'
ON CONFLICT (room_id, model_id) DO NOTHING;


-- ============================================================
-- BÖLÜM 5: ODA PASIFE ALMA
-- Çocuk Odası ve Banyo asistan akışından kaldırılır
-- ============================================================

UPDATE rooms
SET is_active = false
WHERE slug IN ('cocuk-odasi', 'banyo');


-- ============================================================
-- BÖLÜM 6: DOĞRULAMA
-- ============================================================

DO $$
DECLARE
  v_salon_models       TEXT;
  v_yatak_models       TEXT;
  v_mutfak_models      TEXT;
  v_inactive_rooms     TEXT;
  v_ahsap_jaluzi_exists BOOLEAN;
  v_blackout_stor_exists BOOLEAN;
BEGIN
  -- Yeni modeller
  SELECT EXISTS (SELECT 1 FROM curtain_models WHERE slug = 'ahsap-jaluzi')    INTO v_ahsap_jaluzi_exists;
  SELECT EXISTS (SELECT 1 FROM curtain_models WHERE slug = 'blackout-stor')   INTO v_blackout_stor_exists;

  -- Salon modelleri
  SELECT string_agg(cm.slug, ', ' ORDER BY rmm.display_order)
  INTO v_salon_models
  FROM room_models_mapping rmm
  JOIN rooms r          ON r.id  = rmm.room_id
  JOIN curtain_models cm ON cm.id = rmm.model_id
  WHERE r.slug = 'salon';

  -- Yatak Odası modelleri
  SELECT string_agg(cm.slug, ', ' ORDER BY rmm.display_order)
  INTO v_yatak_models
  FROM room_models_mapping rmm
  JOIN rooms r          ON r.id  = rmm.room_id
  JOIN curtain_models cm ON cm.id = rmm.model_id
  WHERE r.slug = 'yatak-odasi';

  -- Mutfak modelleri
  SELECT string_agg(cm.slug, ', ' ORDER BY rmm.display_order)
  INTO v_mutfak_models
  FROM room_models_mapping rmm
  JOIN rooms r          ON r.id  = rmm.room_id
  JOIN curtain_models cm ON cm.id = rmm.model_id
  WHERE r.slug = 'mutfak';

  -- Pasif odalar
  SELECT string_agg(slug, ', ')
  INTO v_inactive_rooms
  FROM rooms
  WHERE is_active = false;

  RAISE NOTICE '=== Migration 037 Doğrulama ===';
  RAISE NOTICE 'Ahşap Jaluzi modeli:   %', CASE WHEN v_ahsap_jaluzi_exists  THEN 'EKLENDI ✓' ELSE 'EKSIK ✗' END;
  RAISE NOTICE 'Blackout Stor modeli:  %', CASE WHEN v_blackout_stor_exists THEN 'EKLENDI ✓' ELSE 'EKSIK ✗' END;
  RAISE NOTICE 'Salon modelleri:       %', v_salon_models;
  RAISE NOTICE 'Yatak Odası modelleri: %', v_yatak_models;
  RAISE NOTICE 'Mutfak modelleri:      %', v_mutfak_models;
  RAISE NOTICE 'Pasif odalar:          %', v_inactive_rooms;
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK (Acil geri alma — kopyala-yapıştır)
-- ============================================================
-- BEGIN;
--   -- Odaları tekrar aktif yap
--   UPDATE rooms SET is_active = true WHERE slug IN ('cocuk-odasi', 'banyo');
--
--   -- Mutfak: Plicell'i kaldır
--   DELETE FROM room_models_mapping
--   WHERE room_id  = (SELECT id FROM rooms WHERE slug = 'mutfak')
--     AND model_id = (SELECT id FROM curtain_models WHERE slug = 'plicell');
--
--   -- Yatak Odası: Blackout Stor'u kaldır, Kruvaze'yi geri ekle
--   DELETE FROM room_models_mapping
--   WHERE room_id  = (SELECT id FROM rooms WHERE slug = 'yatak-odasi')
--     AND model_id = (SELECT id FROM curtain_models WHERE slug = 'blackout-stor');
--   INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
--   SELECT r.id, m.id, 'Yumuşak kumaş dokusuyla yatak odanıza sıcaklık ve huzur katın.', 2
--   FROM rooms r CROSS JOIN curtain_models m
--   WHERE r.slug = 'yatak-odasi' AND m.slug = 'kruvaze'
--   ON CONFLICT DO NOTHING;
--
--   -- Salon: Ahşap Jaluzi'yi kaldır, Kruvaze + Plicell'i geri ekle
--   DELETE FROM room_models_mapping
--   WHERE room_id  = (SELECT id FROM rooms WHERE slug = 'salon')
--     AND model_id = (SELECT id FROM curtain_models WHERE slug = 'ahsap-jaluzi');
--   INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
--   SELECT r.id, m.id,
--     CASE m.slug
--       WHEN 'kruvaze' THEN 'Geniş salonunuza zarafet katın. Büyük cam yüzeyleri için mükemmel seçim.'
--       WHEN 'plicell' THEN 'Isı yalıtımıyla kış aylarında enerji tasarrufu sağlar.'
--     END,
--     CASE m.slug WHEN 'kruvaze' THEN 1 WHEN 'plicell' THEN 2 END
--   FROM rooms r CROSS JOIN curtain_models m
--   WHERE r.slug = 'salon' AND m.slug IN ('kruvaze', 'plicell')
--   ON CONFLICT DO NOTHING;
-- COMMIT;
