-- =====================================================
-- ÇIRAĞAN ELITE PERDE - CART & STOCK MIGRATION
-- =====================================================
-- Bu dosyayı Supabase SQL Editor'de çalıştırın
-- =====================================================

-- =====================================================
-- 1. PRODUCTS TABLOSUNA STOCK_QUANTITY EKLEMESİ
-- =====================================================

-- Stok takibi için stock_quantity kolonu ekle
ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 999 NOT NULL;

-- Mevcut ürünlerin stok miktarını ayarla (varsayılan sınırsız stok için yüksek değer)
UPDATE products SET stock_quantity = 999 WHERE stock_quantity IS NULL;

-- Stok kontrolü için index
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity) WHERE stock_quantity > 0;

-- =====================================================
-- 2. CARTS TABLOSU (Kullanıcı Sepetleri)
-- =====================================================

CREATE TABLE IF NOT EXISTS carts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Carts updated_at trigger
CREATE TRIGGER update_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);

-- =====================================================
-- 3. CART_ITEMS TABLOSU (Sepet Kalemleri)
-- =====================================================

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,

    -- Kişiselleştirme Parametreleri (perde ölçüleri)
    width_cm INTEGER NOT NULL CHECK (width_cm >= 50 AND width_cm <= 600),
    height_cm INTEGER NOT NULL CHECK (height_cm >= 50 AND height_cm <= 400),
    pile_factor pile_factor NOT NULL,

    -- Miktar
    quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity > 0),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Benzersiz kombinasyon: aynı ürün + aynı ölçü + aynı pile factor için tek kayıt
    UNIQUE(cart_id, product_id, width_cm, height_cm, pile_factor)
);

-- Cart items updated_at trigger
CREATE TRIGGER update_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) - CARTS
-- =====================================================

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi sepetini görebilir
CREATE POLICY "Users can view own cart"
    ON carts FOR SELECT
    USING (auth.uid() = user_id);

-- Kullanıcı kendi sepetini oluşturabilir
CREATE POLICY "Users can create own cart"
    ON carts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi sepetini güncelleyebilir
CREATE POLICY "Users can update own cart"
    ON carts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Kullanıcı kendi sepetini silebilir
CREATE POLICY "Users can delete own cart"
    ON carts FOR DELETE
    USING (auth.uid() = user_id);

-- Admin tüm sepetleri görebilir
CREATE POLICY "Admins can view all carts"
    ON carts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) - CART_ITEMS
-- =====================================================

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi sepet kalemlerini görebilir
CREATE POLICY "Users can view own cart items"
    ON cart_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM carts
            WHERE carts.id = cart_items.cart_id
            AND carts.user_id = auth.uid()
        )
    );

-- Kullanıcı kendi sepetine kalem ekleyebilir
CREATE POLICY "Users can insert own cart items"
    ON cart_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM carts
            WHERE carts.id = cart_items.cart_id
            AND carts.user_id = auth.uid()
        )
    );

-- Kullanıcı kendi sepet kalemlerini güncelleyebilir
CREATE POLICY "Users can update own cart items"
    ON cart_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM carts
            WHERE carts.id = cart_items.cart_id
            AND carts.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM carts
            WHERE carts.id = cart_items.cart_id
            AND carts.user_id = auth.uid()
        )
    );

-- Kullanıcı kendi sepet kalemlerini silebilir
CREATE POLICY "Users can delete own cart items"
    ON cart_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM carts
            WHERE carts.id = cart_items.cart_id
            AND carts.user_id = auth.uid()
        )
    );

-- Admin tüm sepet kalemlerini görebilir
CREATE POLICY "Admins can view all cart items"
    ON cart_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- =====================================================
-- 6. STOK DÜŞME FONKSİYONU (Sipariş sırasında)
-- =====================================================

-- Stok kontrolü ve düşme fonksiyonu
CREATE OR REPLACE FUNCTION check_and_deduct_stock(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    -- Mevcut stoku al (kilitle)
    SELECT stock_quantity INTO current_stock
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    -- Stok yeterli mi kontrol et
    IF current_stock IS NULL THEN
        RAISE EXCEPTION 'Ürün bulunamadı: %', p_product_id;
    END IF;

    IF current_stock < p_quantity THEN
        RETURN FALSE;
    END IF;

    -- Stoğu düş
    UPDATE products
    SET stock_quantity = stock_quantity - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Stok geri ekleme fonksiyonu (sipariş iptalinde)
CREATE OR REPLACE FUNCTION restore_stock(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE products
    SET stock_quantity = stock_quantity + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. SEPET TEMİZLEME FONKSİYONU
-- =====================================================

-- Kullanıcının sepetini temizle
CREATE OR REPLACE FUNCTION clear_user_cart(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM cart_items
    WHERE cart_id IN (
        SELECT id FROM carts WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. VIEW - SEPET ÖZETİ
-- =====================================================

CREATE OR REPLACE VIEW cart_summary AS
SELECT
    c.id as cart_id,
    c.user_id,
    ci.id as item_id,
    ci.product_id,
    p.name as product_name,
    p.slug as product_slug,
    p.images[1] as product_image,
    p.base_price as price_per_m2,
    p.stock_quantity,
    ci.width_cm,
    ci.height_cm,
    ci.pile_factor,
    ci.quantity,
    -- Hesaplamalar
    ROUND((ci.width_cm * ci.height_cm)::DECIMAL / 10000, 4) as area_m2,
    get_pile_coefficient(ci.pile_factor) as pile_coefficient,
    calculate_curtain_price(ci.width_cm, ci.height_cm, ci.pile_factor, p.base_price) as unit_price,
    calculate_curtain_price(ci.width_cm, ci.height_cm, ci.pile_factor, p.base_price) * ci.quantity as total_price,
    ci.created_at,
    ci.updated_at
FROM carts c
JOIN cart_items ci ON c.id = ci.cart_id
JOIN products p ON ci.product_id = p.id
WHERE p.is_published = true;

-- =====================================================
-- TAMAMLANDI!
-- =====================================================
