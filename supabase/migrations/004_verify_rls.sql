

SELECT
  'Testing is_admin() function' as test,
  public.is_admin() as result,
  CASE
    WHEN public.is_admin() THEN '✅ You are an admin'
    ELSE '❌ You are not an admin (or not logged in)'
  END as status;


SELECT
  tablename as "Table",
  policyname as "Policy Name",
  cmd as "Command",
  permissive as "Permissive",
  roles as "Roles",
  CASE
    WHEN qual IS NOT NULL THEN '✅ Has USING clause'
    ELSE '❌ No USING clause'
  END as "Using Clause",
  CASE
    WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK clause'
    ELSE '❌ No WITH CHECK clause'
  END as "With Check Clause"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


SELECT
  tablename as "Table",
  CASE
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as "RLS Status"
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'products', 'categories', 'store_settings', 'orders', 'order_items', 'addresses')
ORDER BY tablename;


SELECT
  tablename as "Table",
  COUNT(*) as "Number of Policies"
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;


SELECT
  'Testing admin access to products' as test,
  COUNT(*) as total_products
FROM products;

-- Should return rows if you're an admin
SELECT
  'Testing admin access to all profiles' as test,
  COUNT(*) as total_users
FROM profiles;


SELECT
  auth.uid() as "Your User ID",
  (SELECT email FROM profiles WHERE id = auth.uid()) as "Your Email",
  (SELECT role FROM profiles WHERE id = auth.uid()) as "Your Role",
  public.is_admin() as "Is Admin";

