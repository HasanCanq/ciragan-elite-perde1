-- ============================================================
-- Migration 019: Perde Danışmanı — Oda / Model / Mapping
-- ============================================================
-- Amaç  : "Akıllı Perde Seçim Asistanı" için temel veri
--         mimarisini kurmak. Kullanıcı odasını seçer, asistan
--         o odaya uygun perde modellerini ve ürünleri gösterir.
--
-- Yeni tablolar:
--   1. rooms               — Oda tipleri (Mutfak, Salon …)
--   2. curtain_models      — Perde modelleri (Kruvaze, Stor …)
--   3. room_models_mapping — N:M ilişki (oda ↔ model)
--
-- Değiştirilen tablolar:
--   4. products  — model_id FK eklendi (ON DELETE SET NULL)
--
-- RLS: Herkese okuma (aktif kayıtlar), yalnızca admin yazma.
--
-- ROLLBACK bölümü dosyanın altında.
-- ============================================================

BEGIN;

-- ============================================================
-- BÖLÜM 1: rooms TABLOSU
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT         NOT NULL,         -- Mutfak, Salon, Yatak Odası, Çocuk Odası
  slug          TEXT         NOT NULL UNIQUE,  -- mutfak, salon, yatak-odasi, cocuk-odasi
  icon_url      TEXT         DEFAULT NULL,     -- Supabase Storage veya harici CDN URL
  display_order INT          DEFAULT 0  NOT NULL,
  is_active     BOOLEAN      DEFAULT true NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ  DEFAULT NOW() NOT NULL,

  CONSTRAINT rooms_name_not_empty CHECK (char_length(trim(name)) > 0),
  -- Sadece küçük harf, rakam ve tire içeren slug (örn: yatak-odasi)
  CONSTRAINT rooms_slug_format    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

COMMENT ON TABLE rooms IS
  'Oda tipleri: Salon, Mutfak, Yatak Odası vb. '
  'Perde Seçim Asistanı akışının ilk adımında kullanılır.';

COMMENT ON COLUMN rooms.slug IS
  'URL-safe slug. Küçük harf, tire ile ayrılmış. Örn: yatak-odasi';

COMMENT ON COLUMN rooms.icon_url IS
  'Oda ikonu. Supabase Storage URL veya harici CDN. '
  'Asistan UI kartlarında gösterilir.';

-- updated_at otomatik güncelleme (mevcut trigger fonksiyonu)
DROP TRIGGER IF EXISTS rooms_updated_at ON rooms;
CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_rooms_slug
  ON rooms(slug);

CREATE INDEX IF NOT EXISTS idx_rooms_active_order
  ON rooms(display_order)
  WHERE is_active = true;


-- ============================================================
-- BÖLÜM 2: curtain_models TABLOSU
-- ============================================================

CREATE TABLE IF NOT EXISTS curtain_models (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT         NOT NULL,        -- Kruvaze, Plicell, Stor, Blackout
  slug            TEXT         NOT NULL UNIQUE, -- kruvaze, plicell, stor, blackout
  -- ── KRİTİK VALIDATION ALANLARI ────────────────────────────
  -- Frontend sipariş formu bu değerleri anlık validasyon için kullanır.
  -- Müşteri bu limitin üstünde ölçü giremez.
  max_width_cm    INTEGER      NOT NULL,
  max_height_cm   INTEGER      NOT NULL,
  -- ──────────────────────────────────────────────────────────
  description     TEXT         DEFAULT NULL,
  image_url       TEXT         DEFAULT NULL,
  is_active       BOOLEAN      DEFAULT true NOT NULL,
  display_order   INT          DEFAULT 0 NOT NULL,
  created_at      TIMESTAMPTZ  DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ  DEFAULT NOW() NOT NULL,

  CONSTRAINT curtain_models_name_not_empty   CHECK (char_length(trim(name)) > 0),
  CONSTRAINT curtain_models_slug_format      CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Üretim kapasitesi sınırları (cm): max_width ≤ 2000, max_height ≤ 1500
  CONSTRAINT curtain_models_max_width_valid  CHECK (max_width_cm  > 0 AND max_width_cm  <= 2000),
  CONSTRAINT curtain_models_max_height_valid CHECK (max_height_cm > 0 AND max_height_cm <= 1500)
);

COMMENT ON TABLE curtain_models IS
  'Perde model tipleri: Kruvaze, Plicell, Stor, Blackout vb. '
  'Her modelin üretilebilir maksimum ölçülerini (max_width_cm, max_height_cm) tutar.';

COMMENT ON COLUMN curtain_models.max_width_cm IS
  'KRİTİK — Bu modelin üretilebileceği maksimum genişlik (cm). '
  'Sipariş formu bu değeri anlık validation için kullanır: '
  'girilen genişlik > max_width_cm ise form hata verir. '
  'Örn: Stor = 400 cm, Kruvaze = 600 cm.';

COMMENT ON COLUMN curtain_models.max_height_cm IS
  'KRİTİK — Bu modelin üretilebileceği maksimum yükseklik (cm). '
  'Sipariş formu bu değeri anlık validation için kullanır: '
  'girilen yükseklik > max_height_cm ise form hata verir.';

DROP TRIGGER IF EXISTS curtain_models_updated_at ON curtain_models;
CREATE TRIGGER curtain_models_updated_at
  BEFORE UPDATE ON curtain_models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_curtain_models_slug
  ON curtain_models(slug);

CREATE INDEX IF NOT EXISTS idx_curtain_models_active_order
  ON curtain_models(display_order)
  WHERE is_active = true;


-- ============================================================
-- BÖLÜM 3: room_models_mapping TABLOSU (N:M)
-- ============================================================
-- Her oda için hangi perde modellerinin önerildiğini ve
-- bu kombinasyona özgü pazarlama metnini tutar.
-- Bileşik PK (room_id, model_id) — kopyalanan kayıt olamaz.
-- ON DELETE CASCADE: oda veya model silinirse mapping da silinir.

CREATE TABLE IF NOT EXISTS room_models_mapping (
  room_id         UUID         NOT NULL
                    REFERENCES rooms(id) ON DELETE CASCADE,
  model_id        UUID         NOT NULL
                    REFERENCES curtain_models(id) ON DELETE CASCADE,
  -- Bu oda + model kombinasyonu için asistan UI'ında gösterilecek metin.
  -- Örn (Mutfak + Stor): "Ocak ateşine karşı güvenli ve kolay temizlenebilir"
  marketing_text  TEXT         DEFAULT NULL,
  display_order   INT          DEFAULT 0 NOT NULL,
  created_at      TIMESTAMPTZ  DEFAULT NOW() NOT NULL,

  PRIMARY KEY (room_id, model_id)
);

COMMENT ON TABLE room_models_mapping IS
  'Oda–Model N:M ilişki tablosu. '
  'Hangi odada hangi perde modelinin önerildiğini ve '
  'o kombinasyona özgü pazarlama metnini tutar.';

COMMENT ON COLUMN room_models_mapping.marketing_text IS
  'Bu oda için bu modelin asistan UI''ındaki tanıtım metni. '
  'Örn (Mutfak + Stor): "Ocak ateşine karşı güvenli, kolay temizlenebilir."';

CREATE INDEX IF NOT EXISTS idx_room_models_room_id
  ON room_models_mapping(room_id);

CREATE INDEX IF NOT EXISTS idx_room_models_model_id
  ON room_models_mapping(model_id);


-- ============================================================
-- BÖLÜM 4: products TABLOSUNA model_id FK EKLEME
-- ============================================================
-- ON DELETE SET NULL: Model silinse bile ürün korunur.
-- NULL = model atanmamış (eski ürünler / aksesuar vb.).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS model_id UUID
    DEFAULT NULL
    REFERENCES curtain_models(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN products.model_id IS
  'Bu ürünün ait olduğu perde modeli FK (Kruvaze, Stor vb.). '
  'NULL = model atanmamış. '
  'Perde asistanı bu FK üzerinden model→ürün filtrelemesi yapar.';

-- Mevcut base_price yorumu: her calculation_type için anlamı netleştir
COMMENT ON COLUMN products.base_price IS
  'Birim fiyat (TRY). Hesaplama türüne (calculation_type) göre anlam değişir: '
  'mt    → TL/metre  (≡ base_price_per_meter),  '
  'm2    → TL/m²     (≡ base_price_per_m2),      '
  'adet  → TL/adet.  '
  'Perde asistanı fiyat tahmini için model_id ile birlikte kullanılır.';

-- Model bazlı ürün filtrelemesi için kısmi index (NULL olanlar hariç)
CREATE INDEX IF NOT EXISTS idx_products_model_id
  ON products(model_id)
  WHERE model_id IS NOT NULL;


-- ============================================================
-- BÖLÜM 5: RLS POLİTİKALARI
-- ============================================================

-- ── rooms ──────────────────────────────────────────────────
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_public" ON rooms;
DROP POLICY IF EXISTS "rooms_select_admin"  ON rooms;
DROP POLICY IF EXISTS "rooms_insert_admin"  ON rooms;
DROP POLICY IF EXISTS "rooms_update_admin"  ON rooms;
DROP POLICY IF EXISTS "rooms_delete_admin"  ON rooms;

-- Herkes aktif odaları görebilir
CREATE POLICY "rooms_select_public"
  ON rooms FOR SELECT
  USING (is_active = true);

-- Admin pasif odaları da yönetebilmeli
CREATE POLICY "rooms_select_admin"
  ON rooms FOR SELECT
  USING (public.is_admin());

CREATE POLICY "rooms_insert_admin"
  ON rooms FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "rooms_update_admin"
  ON rooms FOR UPDATE
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "rooms_delete_admin"
  ON rooms FOR DELETE
  USING (public.is_admin());


-- ── curtain_models ──────────────────────────────────────────
ALTER TABLE curtain_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curtain_models_select_public" ON curtain_models;
DROP POLICY IF EXISTS "curtain_models_select_admin"  ON curtain_models;
DROP POLICY IF EXISTS "curtain_models_insert_admin"  ON curtain_models;
DROP POLICY IF EXISTS "curtain_models_update_admin"  ON curtain_models;
DROP POLICY IF EXISTS "curtain_models_delete_admin"  ON curtain_models;

CREATE POLICY "curtain_models_select_public"
  ON curtain_models FOR SELECT
  USING (is_active = true);

CREATE POLICY "curtain_models_select_admin"
  ON curtain_models FOR SELECT
  USING (public.is_admin());

CREATE POLICY "curtain_models_insert_admin"
  ON curtain_models FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "curtain_models_update_admin"
  ON curtain_models FOR UPDATE
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "curtain_models_delete_admin"
  ON curtain_models FOR DELETE
  USING (public.is_admin());


-- ── room_models_mapping ─────────────────────────────────────
-- Mapping tablosunda is_active yoktur; aktiflik rooms/curtain_models'dan gelir.
ALTER TABLE room_models_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_models_select_public" ON room_models_mapping;
DROP POLICY IF EXISTS "room_models_insert_admin"  ON room_models_mapping;
DROP POLICY IF EXISTS "room_models_update_admin"  ON room_models_mapping;
DROP POLICY IF EXISTS "room_models_delete_admin"  ON room_models_mapping;

CREATE POLICY "room_models_select_public"
  ON room_models_mapping FOR SELECT
  USING (true);

CREATE POLICY "room_models_insert_admin"
  ON room_models_mapping FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "room_models_update_admin"
  ON room_models_mapping FOR UPDATE
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "room_models_delete_admin"
  ON room_models_mapping FOR DELETE
  USING (public.is_admin());


-- ============================================================
-- BÖLÜM 6: BAŞLANGIÇ VERİSİ (SEED DATA)
-- ============================================================
-- ON CONFLICT DO NOTHING: Migration tekrar çalıştırılırsa güvende.

-- Odalar ────────────────────────────────────────────────────
INSERT INTO rooms (name, slug, display_order) VALUES
  ('Salon',       'salon',       1),
  ('Yatak Odası', 'yatak-odasi', 2),
  ('Mutfak',      'mutfak',      3),
  ('Çocuk Odası', 'cocuk-odasi', 4),
  ('Banyo',       'banyo',       5),
  ('Ofis',        'ofis',        6)
ON CONFLICT (slug) DO NOTHING;

-- Perde modelleri ───────────────────────────────────────────
-- max_width_cm / max_height_cm değerleri üretim kapasitesine göre;
-- gerçek değerlerle güncelleyin.
INSERT INTO curtain_models
  (name, slug, max_width_cm, max_height_cm, description, display_order)
VALUES
  ('Kruvaze',  'kruvaze',  600, 350,
   'Klasik pileli perde. Tül ve fon perde için idealdir. Geniş cephelere uygundur.',             1),
  ('Plicell',  'plicell',  500, 300,
   'Bal peteği dokulu stor perde. Isı ve ses yalıtımı sağlar.',                                  2),
  ('Stor',     'stor',     400, 300,
   'Modern rulo perde sistemi. Sade ve minimalist görünüm, kolay temizlenir.',                   3),
  ('Blackout', 'blackout', 400, 300,
   'Tam karartma perdesi. Uyku odaları ve sinema odaları için idealdir.',                        4),
  ('Zebra',    'zebra',    350, 280,
   'Çift katmanlı şerit sistemi. Hem görüntüyü koruyan hem ışık geçiren esnek yapı.',           5),
  ('Jaluzi',   'jaluzi',   300, 280,
   'Yatay kanatlı alüminyum veya ahşap perde. Nem ve buğuya dayanıklıdır.',                     6)
ON CONFLICT (slug) DO NOTHING;

-- Salon: Kruvaze > Plicell > Zebra ─────────────────────────
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'kruvaze' THEN 'Geniş salonunuza zarafet katın. Büyük cam yüzeyleri için mükemmel seçim.'
    WHEN 'plicell' THEN 'Isı yalıtımıyla kış aylarında enerji tasarrufu sağlar, ısıyı içeride tutar.'
    WHEN 'zebra'   THEN 'Günün her saatinde ışığı kontrol edin; hem aydınlık hem mahrem.'
  END,
  CASE m.slug
    WHEN 'kruvaze' THEN 1
    WHEN 'plicell' THEN 2
    WHEN 'zebra'   THEN 3
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'salon'
  AND m.slug IN ('kruvaze', 'plicell', 'zebra')
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Yatak Odası: Blackout > Kruvaze > Plicell ─────────────────
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'blackout' THEN 'Tam karartma ile kaliteli uyku. Vardiyalı çalışanlar ve bebekler için vazgeçilmez.'
    WHEN 'kruvaze'  THEN 'Yumuşak kumaş dokusuyla yatak odanıza sıcaklık ve huzur katın.'
    WHEN 'plicell'  THEN 'Ses yalıtımı özelliğiyle şehir gürültüsünü keser, daha sessiz bir uyku sağlar.'
  END,
  CASE m.slug
    WHEN 'blackout' THEN 1
    WHEN 'kruvaze'  THEN 2
    WHEN 'plicell'  THEN 3
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'yatak-odasi'
  AND m.slug IN ('blackout', 'kruvaze', 'plicell')
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Mutfak: Stor > Zebra > Jaluzi ─────────────────────────────
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'stor'   THEN 'Ocak ateşine karşı güvenli ve kolay temizlenebilir özel kaplama.'
    WHEN 'zebra'  THEN 'Pratik kullanım, tek elle açıp kapama. Mutfak pencereleri için ideal ölçüler.'
    WHEN 'jaluzi' THEN 'Alüminyum kanatlar buhara ve nem karşı dirençlidir, uzun ömürlüdür.'
  END,
  CASE m.slug
    WHEN 'stor'   THEN 1
    WHEN 'zebra'  THEN 2
    WHEN 'jaluzi' THEN 3
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'mutfak'
  AND m.slug IN ('stor', 'zebra', 'jaluzi')
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Çocuk Odası: Blackout > Stor > Kruvaze ────────────────────
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'blackout' THEN 'Gündüz uyku saatlerinde tam karartma. Bebek ve çocuklar için güvenli, formaldehitsiz kumaş.'
    WHEN 'stor'     THEN 'Renkli ve eğlenceli desen seçenekleriyle çocuğunuzun odasına hayat katın.'
    WHEN 'kruvaze'  THEN 'Yumuşak ve güvenli kumaş; çocuğun elleri camdan uzak, kumaş tutuşa karşı güvenli.'
  END,
  CASE m.slug
    WHEN 'blackout' THEN 1
    WHEN 'stor'     THEN 2
    WHEN 'kruvaze'  THEN 3
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'cocuk-odasi'
  AND m.slug IN ('blackout', 'stor', 'kruvaze')
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Banyo: Jaluzi > Stor ──────────────────────────────────────
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'jaluzi' THEN 'Neme ve suya karşı tam direnç. Uzun ömürlü alüminyum kanatlar.'
    WHEN 'stor'   THEN 'Suya dayanıklı özel kumaş seçenekleriyle banyo için ideal.'
  END,
  CASE m.slug
    WHEN 'jaluzi' THEN 1
    WHEN 'stor'   THEN 2
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'banyo'
  AND m.slug IN ('jaluzi', 'stor')
ON CONFLICT (room_id, model_id) DO NOTHING;

-- Ofis: Zebra > Plicell > Jaluzi ────────────────────────────
INSERT INTO room_models_mapping (room_id, model_id, marketing_text, display_order)
SELECT
  r.id,
  m.id,
  CASE m.slug
    WHEN 'zebra'   THEN 'Ekran yansımasını önleyen ışık kontrolü. Profesyonel ofis görünümü.'
    WHEN 'plicell' THEN 'Ses yutucu hücre yapısı ile açık ofislerde gürültüyü azaltır.'
    WHEN 'jaluzi'  THEN 'Kademeli ışık ayarı. Toplantı odaları ve sunum alanları için ideal.'
  END,
  CASE m.slug
    WHEN 'zebra'   THEN 1
    WHEN 'plicell' THEN 2
    WHEN 'jaluzi'  THEN 3
  END
FROM rooms r
CROSS JOIN curtain_models m
WHERE r.slug = 'ofis'
  AND m.slug IN ('zebra', 'plicell', 'jaluzi')
ON CONFLICT (room_id, model_id) DO NOTHING;


-- ============================================================
-- BÖLÜM 7: DOĞRULAMA
-- ============================================================

DO $$
DECLARE
  v_rooms_count    INT;
  v_models_count   INT;
  v_mapping_count  INT;
  v_model_id_ok    BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_rooms_count   FROM rooms;
  SELECT COUNT(*) INTO v_models_count  FROM curtain_models;
  SELECT COUNT(*) INTO v_mapping_count FROM room_models_mapping;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'model_id'
  ) INTO v_model_id_ok;

  RAISE NOTICE '=== Migration 019 Doğrulama Sonuçları ===';
  RAISE NOTICE 'rooms tablosu:               % kayıt', v_rooms_count;
  RAISE NOTICE 'curtain_models tablosu:      % kayıt', v_models_count;
  RAISE NOTICE 'room_models_mapping tablosu: % kayıt', v_mapping_count;
  RAISE NOTICE 'products.model_id kolonu:    %',
    CASE WHEN v_model_id_ok THEN 'EKLENDI ✓' ELSE 'EKSIK ✗' END;

  IF NOT v_model_id_ok THEN
    RAISE EXCEPTION 'Kritik hata: products.model_id kolonu eklenemedi!';
  END IF;

  IF v_rooms_count = 0 THEN
    RAISE WARNING 'rooms tablosu boş — seed data çalışmamış olabilir.';
  END IF;

  IF v_models_count = 0 THEN
    RAISE WARNING 'curtain_models tablosu boş — seed data çalışmamış olabilir.';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK (Acil geri alma — kopyala-yapıştır)
-- ============================================================
-- BEGIN;
--   ALTER TABLE products DROP COLUMN IF EXISTS model_id;
--   DROP INDEX  IF EXISTS idx_products_model_id;
--   DROP TABLE  IF EXISTS room_models_mapping;
--   DROP INDEX  IF EXISTS idx_curtain_models_slug;
--   DROP INDEX  IF EXISTS idx_curtain_models_active_order;
--   DROP TABLE  IF EXISTS curtain_models;
--   DROP INDEX  IF EXISTS idx_rooms_slug;
--   DROP INDEX  IF EXISTS idx_rooms_active_order;
--   DROP TABLE  IF EXISTS rooms;
-- COMMIT;
