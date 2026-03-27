-- ============================================================
-- Migration 015: Güvenlik + Mantık Yaması (Patch)
-- ============================================================
-- Yama 1 — PL/pgSQL Audit Log Maskeleme
--   audit_log_trigger() içindeki maskeleme yorumdan çıkarılıp
--   gerçek PL/pgSQL implementasyonuyla değiştirildi.
--   Hassas anahtar değerleri audit_logs'a INSERT edilmeden önce
--   '[MASKELENDI]' ile eziyet edilir.
--
-- Yama 2 — products Tablo Bütünlüğü
--   calculation_type = 'adet' olan ürünlerde
--   min_width_cm ve min_area_m2 NULL olmak zorundadır.
--   CHECK constraint ile veritabanı seviyesinde zorlanır.
--
-- Etkilenen nesneler:
--   REPLACE: mask_sensitive_jsonb() (yeni yardımcı fonksiyon)
--   REPLACE: audit_log_trigger()   (mevcut trigger güncellendi)
--   ALTER  : products               (yeni CHECK constraint)
--
-- Mevcut veri etkisi:
--   • Tüm mevcut products satırları: calculation_type='adet',
--     min_width_cm=NULL, min_area_m2=NULL → constraint ihlali YOK.
--   • Mevcut audit_logs satırları değiştirilmez (INSERT-ONLY zaten).
--
-- ROLLBACK: altta hazır.
-- ============================================================

BEGIN;

-- ============================================================
-- YAMA 1-A: mask_sensitive_jsonb() YARDIMCI FONKSİYONU
-- ============================================================
-- Bir JSONB nesnesini tarar; hassas anahtar değerlerini
-- '[MASKELENDI]' string'iyle değiştirir, anahtarı KORUR.
--
-- Tasarım kararları:
--   • Anahtar silme yerine maskeleme: log kaydının yapısı korunur,
--     hangi alanın değiştiği görülür, değeri görülmez.
--   • Küçük harf karşılaştırma (LOWER): "Password", "PASSWORD",
--     "password" hepsi yakalanır.
--   • Yalnızca üst seviye anahtarlar taranır (nested JSONB için
--     özyinelemeli versiyon gerekirse ileride eklenebilir).
--   • IMMUTABLE: aynı girdi → her zaman aynı çıktı (cache-safe).
--   • Döngüde jsonb_object_agg kullanmak yerine || (merge) operatörü
--     ile tek geçişte üretim yapılır.

CREATE OR REPLACE FUNCTION mask_sensitive_jsonb(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  -- Maskelenecek anahtar adları (küçük harf)
  SENSITIVE_KEYS TEXT[] := ARRAY[
    'password',
    'password_hash',
    'hashed_password',
    'token',
    'access_token',
    'refresh_token',
    'id_token',
    'secret',
    'client_secret',
    'api_key',
    'api_secret',
    'private_key',
    'card_number',
    'card_no',
    'cvv',
    'cvc',
    'pin',
    'identity_number',  -- TC kimlik no
    'ssn',
    'bank_account',
    'iban'
  ];
  v_result  JSONB := p_data;
  v_key     TEXT;
  v_val     JSONB;
BEGIN
  -- NULL geldiyse dokunma
  IF p_data IS NULL THEN
    RETURN NULL;
  END IF;

  -- Tüm üst-seviye anahtarları tara
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_data)
  LOOP
    IF LOWER(v_key) = ANY(SENSITIVE_KEYS) THEN
      -- Değeri maskele, anahtarı koru
      v_result := v_result || jsonb_build_object(v_key, '[MASKELENDI]');
    END IF;
    -- İç içe nesneler için özyinelemeli çağrı (1 seviye derinlik)
    IF jsonb_typeof(v_val) = 'object' THEN
      v_result := v_result || jsonb_build_object(v_key, mask_sensitive_jsonb(v_val));
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION mask_sensitive_jsonb(JSONB) IS
  'JSONB nesnesindeki hassas anahtar değerlerini [MASKELENDI] ile değiştirir. '
  'Anahtar adları korunur, yalnızca değer maskelenir. '
  'Üst seviye + 1 iç seviye taranır. '
  'audit_log_trigger() tarafından INSERT öncesinde çağrılır.';


-- ============================================================
-- YAMA 1-B: audit_log_trigger() — MASKELEMELİ YENİ VERSİYON
-- ============================================================
-- Önceki versiyon (migration 014) ile tek fark:
--   v_old_values ve v_new_values audit_logs'a yazılmadan önce
--   mask_sensitive_jsonb() üzerinden geçiriliyor.
-- Triggerlar ve tablo bağlamaları DEĞİŞMİYOR.

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action      TEXT;
  v_old_values  JSONB := NULL;
  v_new_values  JSONB := NULL;
  v_record_id   UUID;
  v_user_email  TEXT;
BEGIN
  -- ── Aksiyonu belirle ──────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    v_action     := 'CREATE';
    v_new_values := to_jsonb(NEW);
    v_record_id  := NEW.id;

  ELSIF TG_OP = 'DELETE' THEN
    v_action     := 'DELETE';
    v_old_values := to_jsonb(OLD);
    v_record_id  := OLD.id;

  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;

    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'SOFT_DELETE';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_action := 'RESTORE';
    ELSE
      v_action := 'UPDATE';
    END IF;

    -- Fark bazlı loglama: yalnızca değişen alanlar
    SELECT jsonb_object_agg(key, value)
    INTO v_old_values
    FROM jsonb_each(to_jsonb(OLD))
    WHERE to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key;

    SELECT jsonb_object_agg(key, value)
    INTO v_new_values
    FROM jsonb_each(to_jsonb(NEW))
    WHERE to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- KRİTİK GÜVENLIK YAMASI: INSERT öncesi maskeleme
  -- mask_sensitive_jsonb() hassas anahtar değerlerini '[MASKELENDI]'
  -- ile değiştirir. Anahtar adı görünür, değer görünmez.
  -- Bu satırlar migration 014'te yorum olarak bırakılmıştı.
  -- ══════════════════════════════════════════════════════════════════════
  v_old_values := mask_sensitive_jsonb(v_old_values);
  v_new_values := mask_sensitive_jsonb(v_new_values);

  -- ── Kullanıcı e-postası snapshot ─────────────────────────────────────
  BEGIN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_email := NULL;
  END;

  -- ── audit_logs'a yaz ─────────────────────────────────────────────────
  BEGIN
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      auth.uid(),
      v_user_email,
      v_action,
      TG_TABLE_NAME,
      v_record_id,
      v_old_values,   -- maskelenmiş
      v_new_values    -- maskelenmiş
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[audit_log_trigger] Log yazılamadı: % — %', TG_TABLE_NAME, SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_log_trigger() IS
  'Genel amaçlı audit log trigger fonksiyonu (v2 — maskelemeli). '
  'Yalnızca değişen alanları loglar (fark bazlı). '
  'mask_sensitive_jsonb() ile hassas alanlar INSERT öncesi maskelenir. '
  'Log hatası asıl transaction''ı engellemez.';

-- Triggerlar DEĞİŞMİYOR — CREATE OR REPLACE ile fonksiyon güncellemesi
-- otomatik olarak tüm bağlı triggerları etkiler. Yeniden yaratmak gerekmez.


-- ============================================================
-- YAMA 2: products — 'adet' Türü Bütünlük Kısıtı
-- ============================================================
-- Kural: calculation_type = 'adet' ise,
--        min_width_cm VE min_area_m2 kesinlikle NULL olmalıdır.
--
-- Veri bütünlüğü doğrulama (constraint'ten ÖNCE):
-- Mevcut tüm ürünler calculation_type='adet' DEFAULT ile geldi
-- ve min_width_cm/min_area_m2 NULL DEFAULT ile eklendi.
-- Bu nedenle mevcut veri ihlali YOK — constraint güvenle eklenir.

DO $$
DECLARE
  violation_count INT;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM products
  WHERE calculation_type = 'adet'
    AND (min_width_cm IS NOT NULL OR min_area_m2 IS NOT NULL);

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'Constraint eklenemez: % ürün adet türünde olmasına rağmen '
      'min_width_cm veya min_area_m2 dolu. '
      'Önce bu kayıtları NULL''a güncelleyin.',
      violation_count;
  ELSE
    RAISE NOTICE 'Veri doğrulama geçti: % ihlal eden kayıt yok.', violation_count;
  END IF;
END $$;

-- Constraint: 'adet' türü ürünlerde boyut alanları NULL olmalı
--
-- Mantık tablosu:
--   calculation_type = 'adet'  AND min_width_cm IS NOT NULL  → REDDET
--   calculation_type = 'adet'  AND min_area_m2  IS NOT NULL  → REDDET
--   calculation_type = 'mt'    AND min_width_cm = 100        → İZİN VER
--   calculation_type = 'm2'    AND min_area_m2  = 1.5        → İZİN VER
--   calculation_type = 'adet'  AND min_width_cm IS NULL
--                               AND min_area_m2  IS NULL      → İZİN VER
--
-- NOT: mt türünde min_area_m2 girilmesi de anlamsız olabilir.
-- Fakat mt + min_area_m2 senaryosu için kuralı şimdilik yalnızca
-- 'adet' ile sınırlı tutuyoruz (kademeli kısıtlama prensibi).

ALTER TABLE products
  ADD CONSTRAINT products_adet_no_dimensions
    CHECK (
      calculation_type != 'adet'
      OR (min_width_cm IS NULL AND min_area_m2 IS NULL)
    );

COMMENT ON CONSTRAINT products_adet_no_dimensions ON products IS
  'Adet bazlı ürünlerde (aksesuar, korniş vb.) boyut alanları anlamsızdır. '
  'calculation_type=adet ise min_width_cm ve min_area_m2 NULL olmalıdır. '
  'İhlal → INSERT/UPDATE veritabanı tarafından reddedilir.';


-- ============================================================
-- DOĞRULAMA
-- ============================================================

DO $$
BEGIN
  -- mask_sensitive_jsonb varlığı
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'mask_sensitive_jsonb'
  ) THEN
    RAISE NOTICE 'mask_sensitive_jsonb() fonksiyonu oluşturuldu ✓';
  ELSE
    RAISE WARNING 'mask_sensitive_jsonb() bulunamadı!';
  END IF;

  -- Constraint varlığı
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name       = 'products'
      AND constraint_name  = 'products_adet_no_dimensions'
      AND constraint_type  = 'CHECK'
  ) THEN
    RAISE NOTICE 'products_adet_no_dimensions constraint eklendi ✓';
  ELSE
    RAISE WARNING 'products_adet_no_dimensions constraint bulunamadı!';
  END IF;

  -- Maskeleme mantığı testi: 'password' anahtarı maskelenmeli
  DECLARE
    v_test_input  JSONB := '{"name": "Beyaz Tül", "password": "gizli123", "base_price": 150}';
    v_test_result JSONB;
  BEGIN
    v_test_result := mask_sensitive_jsonb(v_test_input);

    IF (v_test_result->>'password') = '[MASKELENDI]'
       AND (v_test_result->>'name') = 'Beyaz Tül'
       AND (v_test_result->>'base_price') = '150' THEN
      RAISE NOTICE 'mask_sensitive_jsonb() maskeleme testi geçti ✓';
    ELSE
      RAISE WARNING 'mask_sensitive_jsonb() testi BAŞARISIZ — çıktı: %', v_test_result;
    END IF;
  END;

  RAISE NOTICE 'Migration 015 tamamlandı.';
END $$;

COMMIT;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
--   ALTER TABLE products
--     DROP CONSTRAINT IF EXISTS products_adet_no_dimensions;
--   DROP FUNCTION IF EXISTS mask_sensitive_jsonb(JSONB);
--   -- audit_log_trigger()'ı migration 014 versiyonuna döndürmek için
--   -- 014 dosyasındaki CREATE OR REPLACE bloğunu yeniden çalıştırın.
-- COMMIT;
