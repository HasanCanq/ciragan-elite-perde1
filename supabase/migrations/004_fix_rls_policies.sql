

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin() IS 'Securely checks if the current user has ADMIN role';


ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- SELECT: Users can read their own profile OR if they are an Admin
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING (is_admin());

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- INSERT: Only allow authenticated users to insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);


ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view published products" ON products;
DROP POLICY IF EXISTS "Public can view products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

-- SELECT: Public access (everyone can view products)
CREATE POLICY "Public can view products"
  ON products
  FOR SELECT
  USING (true);

-- INSERT: Only admins can insert products
CREATE POLICY "Admins can insert products"
  ON products
  FOR INSERT
  WITH CHECK (is_admin());

-- UPDATE: Only admins can update products
CREATE POLICY "Admins can update products"
  ON products
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE: Only admins can delete products
CREATE POLICY "Admins can delete products"
  ON products
  FOR DELETE
  USING (is_admin());


ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
DROP POLICY IF EXISTS "Public can view categories" ON categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

-- SELECT: Public access (everyone can view categories)
CREATE POLICY "Public can view categories"
  ON categories
  FOR SELECT
  USING (true);

-- INSERT: Only admins can insert categories
CREATE POLICY "Admins can insert categories"
  ON categories
  FOR INSERT
  WITH CHECK (is_admin());

-- UPDATE: Only admins can update categories
CREATE POLICY "Admins can update categories"
  ON categories
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE: Only admins can delete categories
CREATE POLICY "Admins can delete categories"
  ON categories
  FOR DELETE
  USING (is_admin());


ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read settings" ON store_settings;
DROP POLICY IF EXISTS "Public can read settings" ON store_settings;
DROP POLICY IF EXISTS "Only admins can update settings" ON store_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON store_settings;

-- SELECT: Public access (everyone can read settings)
CREATE POLICY "Public can read settings"
  ON store_settings
  FOR SELECT
  USING (true);

-- UPDATE: Only admins can update settings
CREATE POLICY "Admins can update settings"
  ON store_settings
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());


ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;

-- SELECT: Users can view their own orders, admins can view all
CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON orders
  FOR SELECT
  USING (is_admin());

-- INSERT: Authenticated users can create orders
CREATE POLICY "Users can insert own orders"
  ON orders
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL  -- Allow guest orders
  );

-- UPDATE: Only admins can update orders
CREATE POLICY "Admins can update orders"
  ON orders
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());


ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;

-- SELECT: Users can view items from their orders, admins can view all
CREATE POLICY "Users can view own order items"
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order items"
  ON order_items
  FOR SELECT
  USING (is_admin());

-- INSERT: Users can insert items for their orders
CREATE POLICY "Users can insert own order items"
  ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );



DO $$
BEGIN
  -- Check if addresses table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'addresses') THEN
    -- Enable RLS
    EXECUTE 'ALTER TABLE addresses ENABLE ROW LEVEL SECURITY';

    -- Drop existing policies if they exist
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own addresses" ON addresses';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own addresses" ON addresses';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own addresses" ON addresses';

    -- SELECT: Users can view their own addresses
    EXECUTE 'CREATE POLICY "Users can view own addresses"
      ON addresses
      FOR SELECT
      USING (auth.uid() = user_id)';

    -- INSERT: Users can insert their own addresses
    EXECUTE 'CREATE POLICY "Users can insert own addresses"
      ON addresses
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)';

    -- UPDATE: Users can update their own addresses
    EXECUTE 'CREATE POLICY "Users can update own addresses"
      ON addresses
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';

    -- DELETE: Users can delete their own addresses
    EXECUTE 'CREATE POLICY "Users can delete own addresses"
      ON addresses
      FOR DELETE
      USING (auth.uid() = user_id)';
  END IF;
END $$;


GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;



COMMENT ON FUNCTION public.is_admin() IS
  'Helper function to check if the current authenticated user has ADMIN role.
   Used in RLS policies for secure admin-only operations.';
