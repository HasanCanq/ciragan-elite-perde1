-- =============================================================================
-- Migration 018: Misafir Sipariş Takibi
-- Amaç : orders tablosuna performans indeksleri ekle ve
--        gizlilik garantili SECURITY DEFINER sorgu fonksiyonu oluştur.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Performans indeksleri
--    Aynı indeks zaten varsa atla (idempotent).
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_order_number
    ON public.orders (order_number)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_email
    ON public.orders (customer_email)
    WHERE deleted_at IS NULL;

-- Birleşik arama desenine göre kapsayan (covering) indeks:
-- fonksiyon her zaman (order_number, customer_email) çiftiyle sorgular.
CREATE INDEX IF NOT EXISTS idx_orders_guest_lookup
    ON public.orders (order_number, customer_email)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Misafir sipariş sorgulama fonksiyonu
--
--    Güvenlik modeli:
--      • SECURITY DEFINER  → fonksiyon sahibinin (postgres/service_role)
--        yetkileriyle çalışır; tablo RLS'i bypass edilir.
--      • search_path sabit  → search_path injection saldırısına karşı koruma.
--      • Döndürülen JSONB   → yalnızca genel durum alanları;
--        adres, telefon, user_id gibi PII alanları ASLA dahil değil.
--
--    Dönüş değeri:
--      • Eşleşen kayıt varsa  → JSONB
--      • Kayıt yoksa veya soft-deleted ise → NULL
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_order_for_guest(
    p_order_number    TEXT,
    p_customer_email  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Girdi boşluk/büyük-küçük harf normalizasyonu
    p_order_number   := TRIM(p_order_number);
    p_customer_email := LOWER(TRIM(p_customer_email));

    -- Temel girdi kontrolü (boş gelirse erken çık)
    IF p_order_number = '' OR p_customer_email = '' THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_build_object(
        'order_number',           o.order_number,
        'status',                 o.status,
        'created_at',             o.created_at,
        'total_amount',           o.total_amount,
        'shipping_cost',          o.shipping_cost,
        'shipping_tracking_code', o.shipping_tracking_code,
        'invoice_url',            o.invoice_url,
        -- Sadece müşteri adını döndür; adres, telefon veya e-posta yok
        'customer_name',          o.customer_name
    )
    INTO v_result
    FROM public.orders o
    WHERE o.order_number   = p_order_number
      AND LOWER(o.customer_email) = p_customer_email
      AND o.deleted_at IS NULL     -- soft-deleted kayıtlar gizlenir
    LIMIT 1;

    -- Eşleşme yoksa SELECT INTO NULL bırakır, RETURN NULL döner
    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Hata bilgisini sızdırma; çağırana sadece NULL dön
        RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Yetki yönetimi
--    Varsayılan olarak fonksiyon PUBLIC'e açık gelir; önce kapat, sonra
--    yalnızca ihtiyaç duyan rollere ver.
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_order_for_guest(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_order_for_guest(TEXT, TEXT)
    TO anon, authenticated;

-- service_role zaten SECURITY DEFINER üzerinden erişebilir; ek grant gerekmez.

-- -----------------------------------------------------------------------------
-- 4. Fonksiyon belgesi
-- -----------------------------------------------------------------------------

COMMENT ON FUNCTION public.get_order_for_guest(TEXT, TEXT) IS
    'Misafir kullanıcılar için sipariş sorgulama. '
    'Yalnızca order_number + customer_email çifti doğrulandığında '
    'genel durum alanlarını döndürür. Adres / telefon / user_id gibi '
    'PII alanları hiçbir zaman dahil edilmez.';

COMMIT;
