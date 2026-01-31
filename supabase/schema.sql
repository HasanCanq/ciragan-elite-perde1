-- =====================================================
-- ÇIRAĞAN ELITE PERDE - SUPABASE DATABASE SCHEMA
-- =====================================================
-- Bu dosyayı Supabase SQL Editor'de çalıştırın
-- Sırasıyla tüm blokları çalıştırmanız önerilir
-- =====================================================

-- =====================================================
-- BÖLÜM 1: ENUM TİPLERİ
-- =====================================================

-- Kullanıcı rolleri
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');

-- Sipariş durumları
CREATE TYPE order_status AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- Pile sıklığı (perde kıvrımı)
CREATE TYPE pile_factor AS ENUM ('SEYREK', 'NORMAL', 'SIK');

-- =====================================================
-- BÖLÜM 2: TABLOLAR
-- =====================================================

-- -----------------------------------------------------
-- PROFILES TABLOSU (Supabase Auth ile entegre)
-- -----------------------------------------------------
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    address TEXT,
    role user_role DEFAULT 'USER' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Profil güncellendiğinde updated_at otomatik güncellenir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Yeni kullanıcı kayıt olduğunda otomatik profil oluştur
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------
-- CATEGORIES TABLOSU
-- -----------------------------------------------------
CREATE TABLE categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- -----------------------------------------------------
-- PRODUCTS TABLOSU
-- -----------------------------------------------------
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Fiyatlandırma (m² bazında)
    base_price DECIMAL(10, 2) NOT NULL,

    -- Görseller (JSON array olarak)
    images TEXT[] DEFAULT '{}',

    -- Durum
    is_published BOOLEAN DEFAULT false NOT NULL,
    in_stock BOOLEAN DEFAULT true NOT NULL,

    -- SEO & Meta
    meta_title TEXT,
    meta_description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Slug için index
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_published ON products(is_published) WHERE is_published = true;

-- -----------------------------------------------------
-- ORDERS TABLOSU
-- -----------------------------------------------------
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Müşteri Bilgileri (snapshot - kullanıcı bilgisi değişse bile sipariş etkilenmez)
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address TEXT NOT NULL,
    billing_address TEXT,

    -- Fiyatlandırma
    subtotal DECIMAL(12, 2) NOT NULL,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,

    -- Durum
    status order_status DEFAULT 'PENDING' NOT NULL,

    -- Notlar
    customer_note TEXT,
    admin_note TEXT,

    -- Ödeme
    payment_method TEXT,
    payment_reference TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    paid_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sipariş numarası otomatik oluştur (CPE-2024-000001 formatında)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part TEXT;
    seq_part TEXT;
    new_number TEXT;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');

    SELECT LPAD(COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM 10) AS INTEGER)
    ), 0) + 1, 6, '0')
    INTO seq_part
    FROM orders
    WHERE order_number LIKE 'CPE-' || year_part || '-%';

    new_number := 'CPE-' || year_part || '-' || seq_part;
    NEW.order_number := new_number;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- -----------------------------------------------------
-- ORDER_ITEMS TABLOSU (KRİTİK - Kişiselleştirilmiş Ürün Detayları)
-- -----------------------------------------------------
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,

    -- Ürün Snapshot (sipariş anındaki bilgiler)
    product_name TEXT NOT NULL,
    product_slug TEXT NOT NULL,
    product_image TEXT,

    -- Kişiselleştirme Parametreleri
    width_cm DECIMAL(8, 2) NOT NULL,
    height_cm DECIMAL(8, 2) NOT NULL,
    pile_factor pile_factor NOT NULL,

    -- Fiyat Hesaplama Detayları
    area_m2 DECIMAL(10, 4) NOT NULL,
    price_per_m2_snapshot DECIMAL(10, 2) NOT NULL, -- Sipariş anındaki m² fiyatı
    pile_coefficient DECIMAL(4, 2) NOT NULL, -- Uygulanan katsayı (1.0, 1.2, 1.3)

    -- Miktar ve Fiyat
    quantity INT DEFAULT 1 NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL, -- Tek ürün hesaplanmış fiyatı
    total_price DECIMAL(12, 2) NOT NULL, -- unit_price * quantity

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- =====================================================
-- BÖLÜM 3: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- RLS'yi etkinleştir
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- PROFILES RLS POLİTİKALARI
-- -----------------------------------------------------

-- Herkes kendi profilini görebilir
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Herkes kendi profilini güncelleyebilir
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admin tüm profilleri görebilir
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin profilleri güncelleyebilir (rol değiştirme dahil)
CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- -----------------------------------------------------
-- CATEGORIES RLS POLİTİKALARI
-- -----------------------------------------------------

-- Herkes aktif kategorileri görebilir
CREATE POLICY "Anyone can view active categories"
    ON categories FOR SELECT
    USING (is_active = true);

-- Admin tüm kategorileri görebilir
CREATE POLICY "Admins can view all categories"
    ON categories FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin kategori ekleyebilir
CREATE POLICY "Admins can insert categories"
    ON categories FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin kategori güncelleyebilir
CREATE POLICY "Admins can update categories"
    ON categories FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin kategori silebilir
CREATE POLICY "Admins can delete categories"
    ON categories FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- -----------------------------------------------------
-- PRODUCTS RLS POLİTİKALARI
-- -----------------------------------------------------

-- Herkes yayındaki ürünleri görebilir
CREATE POLICY "Anyone can view published products"
    ON products FOR SELECT
    USING (is_published = true);

-- Admin tüm ürünleri görebilir
CREATE POLICY "Admins can view all products"
    ON products FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin ürün ekleyebilir
CREATE POLICY "Admins can insert products"
    ON products FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin ürün güncelleyebilir
CREATE POLICY "Admins can update products"
    ON products FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin ürün silebilir
CREATE POLICY "Admins can delete products"
    ON products FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- -----------------------------------------------------
-- ORDERS RLS POLİTİKALARI
-- -----------------------------------------------------

-- Kullanıcı kendi siparişlerini görebilir
CREATE POLICY "Users can view own orders"
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

-- Kullanıcı sipariş oluşturabilir
CREATE POLICY "Authenticated users can create orders"
    ON orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admin tüm siparişleri görebilir
CREATE POLICY "Admins can view all orders"
    ON orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin siparişleri güncelleyebilir
CREATE POLICY "Admins can update all orders"
    ON orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- -----------------------------------------------------
-- ORDER_ITEMS RLS POLİTİKALARI
-- -----------------------------------------------------

-- Kullanıcı kendi sipariş kalemlerini görebilir
CREATE POLICY "Users can view own order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.user_id = auth.uid()
        )
    );

-- Sipariş oluşturulurken kalemler eklenebilir
CREATE POLICY "Users can insert order items for own orders"
    ON order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND orders.user_id = auth.uid()
        )
    );

-- Admin tüm sipariş kalemlerini görebilir
CREATE POLICY "Admins can view all order items"
    ON order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- =====================================================
-- BÖLÜM 4: VIEWS (ADMIN PANELİ İÇİN)
-- =====================================================

-- Sipariş özeti view'ı
CREATE OR REPLACE VIEW order_summary AS
SELECT
    o.id,
    o.order_number,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.total_amount,
    o.status,
    o.created_at,
    o.shipping_address,
    COUNT(oi.id) as item_count,
    json_agg(
        json_build_object(
            'product_name', oi.product_name,
            'width_cm', oi.width_cm,
            'height_cm', oi.height_cm,
            'pile_factor', oi.pile_factor,
            'quantity', oi.quantity,
            'total_price', oi.total_price
        )
    ) as items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id;

-- =====================================================
-- BÖLÜM 5: SEED DATA (İLK VERİLER)
-- =====================================================

-- Kategorileri ekle
INSERT INTO categories (name, slug, description, image_url, display_order) VALUES
('Tül Perdeler', 'tul-perdeler', 'Zarif ve şık tül perde koleksiyonumuz', '/images/categories/tul.jpg', 1),
('Fon Perdeler', 'fon-perdeler', 'Lüks ve kalın fon perde modelleri', '/images/categories/fon.jpg', 2),
('Stor Perdeler', 'stor-perdeler', 'Modern stor perde çeşitleri', '/images/categories/stor.jpg', 3),
('Zebra Perdeler', 'zebra-perdeler', 'Şık zebra perde koleksiyonu', '/images/categories/zebra.jpg', 4);

-- Ürünleri ekle
INSERT INTO products (name, slug, description, short_description, category_id, base_price, images, is_published, in_stock) VALUES
(
    'Milano Tül Perde',
    'milano-tul-perde',
    'İtalyan tasarım ilhamıyla üretilen Milano Tül Perde, mekanlarınıza sofistike bir dokunuş katar. Yüksek kaliteli polyester ipliklerden dokunan bu tül perde, ışığı süzerek içeri alırken mahremiyetinizi de korur. Özel dokuma tekniğiyle üretilen kumaşı, yıkamada deforme olmaz ve uzun yıllar ilk günkü canlılığını korur.',
    'İtalyan tasarım ilhamlı, ışık süzen zarif tül perde.',
    (SELECT id FROM categories WHERE slug = 'tul-perdeler'),
    450.00,
    ARRAY['/images/products/milano-tul-1.jpg', '/images/products/milano-tul-2.jpg'],
    true,
    true
),
(
    'Royal Kadife Fon',
    'royal-kadife-fon',
    'Royal Kadife Fon Perde, saray döşemelerinden ilham alan lüks dokusuylaçoğu odanıza aristokratik bir hava katar. %100 premium kadife kumaştan üretilen bu fon perde, mükemmel karartma özelliği sunarken aynı zamanda ısı ve ses yalıtımı da sağlar. Kadifenin doğal parlaklığı, ışıkla buluştuğunda eşsiz bir görsel şölen sunar.',
    'Premium kadife kumaşlı, tam karartma sağlayan fon perde.',
    (SELECT id FROM categories WHERE slug = 'fon-perdeler'),
    850.00,
    ARRAY['/images/products/royal-kadife-1.jpg', '/images/products/royal-kadife-2.jpg'],
    true,
    true
),
(
    'Venedik Dantel Tül',
    'venedik-dantel-tul',
    'Venedik''in eşsiz dantel işçiliğinden esinlenen bu tül perde, her bir detayında ustalığın izlerini taşır. İnce dantel motifleri, modern dokuma teknikleriyle birleşerek zamansız bir şıklık sunar. Pencerelerinizi bir sanat eserine dönüştüren bu perde, hem klasik hem de modern mekanlarla uyum sağlar.',
    'El işçiliği görünümlü, dantel detaylı premium tül perde.',
    (SELECT id FROM categories WHERE slug = 'tul-perdeler'),
    680.00,
    ARRAY['/images/products/venedik-dantel-1.jpg', '/images/products/venedik-dantel-2.jpg'],
    true,
    true
),
(
    'Premium Stor Perde',
    'premium-stor-perde',
    'Minimalist tasarımın zirvesi olan Premium Stor Perde, modern yaşam alanları için idealdir. Özel üretim mekanizması sayesinde sessiz ve pürüzsüz bir kullanım sunar. UV filtreli kumaşı, mobilyalarınızı güneşin zararlı ışınlarından korurken, odanıza yumuşak bir aydınlık sağlar.',
    'Motorlu veya mekanik, modern tasarımlı stor perde.',
    (SELECT id FROM categories WHERE slug = 'stor-perdeler'),
    520.00,
    ARRAY['/images/products/premium-stor-1.jpg', '/images/products/premium-stor-2.jpg'],
    true,
    true
),
(
    'Elite Zebra Perde',
    'elite-zebra-perde',
    'Elite Zebra Perde, gündüz ve gece modları arasında zahmetsizce geçiş yapmanızı sağlar. Çift katmanlı özel kumaşı, tam karartma ve ışık süzme arasında sonsuz ayar imkanı sunar. Şık çizgi deseni, her türlü dekorasyona uyum sağlarken modern bir görünüm yaratır.',
    'Çift katmanlı, ayarlanabilir ışık kontrollü zebra perde.',
    (SELECT id FROM categories WHERE slug = 'zebra-perdeler'),
    620.00,
    ARRAY['/images/products/elite-zebra-1.jpg', '/images/products/elite-zebra-2.jpg'],
    true,
    true
),
(
    'Osmanlı Jakar Fon',
    'osmanli-jakar-fon',
    'Osmanlı saray dokumalarından ilham alan Jakar Fon Perde, geleneksel motifleri çağdaş bir yorumla sunar. Özel jakar dokuma tekniğiyle üretilen kumaşı, her açıdan farklı bir doku ve parlaklık sergiler. Bu perde, mekanlarınıza tarihî bir derinlik ve ihtişam katarken modern konforu da beraberinde getirir.',
    'Osmanlı motifli, jakar dokuma lüks fon perde.',
    (SELECT id FROM categories WHERE slug = 'fon-perdeler'),
    780.00,
    ARRAY['/images/products/osmanli-jakar-1.jpg', '/images/products/osmanli-jakar-2.jpg'],
    true,
    true
);

-- =====================================================
-- BÖLÜM 6: HELPER FONKSİYONLAR
-- =====================================================

-- Pile katsayısını döndüren fonksiyon
CREATE OR REPLACE FUNCTION get_pile_coefficient(pile pile_factor)
RETURNS DECIMAL AS $$
BEGIN
    CASE pile
        WHEN 'SEYREK' THEN RETURN 1.0;
        WHEN 'NORMAL' THEN RETURN 1.2;
        WHEN 'SIK' THEN RETURN 1.3;
        ELSE RETURN 1.0;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Perde fiyatı hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION calculate_curtain_price(
    width_cm DECIMAL,
    height_cm DECIMAL,
    pile pile_factor,
    base_price_per_m2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    area_m2 DECIMAL;
    coefficient DECIMAL;
BEGIN
    area_m2 := (width_cm * height_cm) / 10000;
    coefficient := get_pile_coefficient(pile);
    RETURN ROUND(area_m2 * base_price_per_m2 * coefficient, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sipariş toplamını güncelleyen fonksiyon
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM order_items
        WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    ),
    total_amount = (
        SELECT COALESCE(SUM(total_price), 0) + COALESCE(orders.shipping_cost, 0) - COALESCE(orders.discount_amount, 0)
        FROM order_items
        WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    )
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_total_on_item_change
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_total();

-- =====================================================
-- TAMAMLANDI!
-- =====================================================
-- Bu şemayı Supabase SQL Editor'de çalıştırdıktan sonra:
-- 1. .env.local dosyanıza SUPABASE_URL ve SUPABASE_ANON_KEY ekleyin
-- 2. İlk admin kullanıcısını manuel olarak oluşturun:
--    UPDATE profiles SET role = 'ADMIN' WHERE email = 'your-admin@email.com';
-- =====================================================
