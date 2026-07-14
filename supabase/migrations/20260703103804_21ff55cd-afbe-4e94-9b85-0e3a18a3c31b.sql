DROP POLICY IF EXISTS "Seller details readable publicly" ON public.seller_details;
CREATE POLICY "Seller details readable by authenticated" ON public.seller_details FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.seller_details FROM anon;