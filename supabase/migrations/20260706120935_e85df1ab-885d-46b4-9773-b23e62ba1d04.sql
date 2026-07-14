-- Restrict profiles SELECT to owner only
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Restrict seller_details SELECT to owner only
DROP POLICY IF EXISTS "Seller details viewable by authenticated" ON public.seller_details;
DROP POLICY IF EXISTS "Authenticated can read seller details" ON public.seller_details;
DROP POLICY IF EXISTS "seller_details_select_authenticated" ON public.seller_details;
DROP POLICY IF EXISTS "Seller details are viewable by authenticated users" ON public.seller_details;

CREATE POLICY "Sellers can view their own details"
  ON public.seller_details FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);