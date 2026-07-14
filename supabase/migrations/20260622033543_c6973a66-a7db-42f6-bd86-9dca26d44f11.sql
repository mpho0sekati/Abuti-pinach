
-- 1. Drop overly permissive "Anyone can ..." policies
DROP POLICY IF EXISTS "Anyone can insert deals" ON public.agent_deals;
DROP POLICY IF EXISTS "Anyone can read deals" ON public.agent_deals;
DROP POLICY IF EXISTS "Anyone can update deals" ON public.agent_deals;

DROP POLICY IF EXISTS "Anyone can insert permissions" ON public.agent_permissions;
DROP POLICY IF EXISTS "Anyone can read permissions" ON public.agent_permissions;
DROP POLICY IF EXISTS "Anyone can update permissions" ON public.agent_permissions;

DROP POLICY IF EXISTS "Anyone can insert buyers" ON public.buyers;
DROP POLICY IF EXISTS "Anyone can read buyers" ON public.buyers;
DROP POLICY IF EXISTS "Anyone can update buyers" ON public.buyers;

DROP POLICY IF EXISTS "Anyone can insert logs" ON public.conversation_logs;
DROP POLICY IF EXISTS "Anyone can read logs" ON public.conversation_logs;
DROP POLICY IF EXISTS "Anyone can update feedback" ON public.conversation_logs;

DROP POLICY IF EXISTS "Anyone can insert outcomes" ON public.deal_outcomes;
DROP POLICY IF EXISTS "Anyone can read outcomes" ON public.deal_outcomes;
DROP POLICY IF EXISTS "Anyone can update outcomes" ON public.deal_outcomes;

DROP POLICY IF EXISTS "Anyone can insert plans" ON public.farm_plans;
DROP POLICY IF EXISTS "Anyone can read plans" ON public.farm_plans;
DROP POLICY IF EXISTS "Anyone can update plans" ON public.farm_plans;

DROP POLICY IF EXISTS "Anyone can read stats" ON public.farmer_crop_stats;
DROP POLICY IF EXISTS "Anyone can update stats" ON public.farmer_crop_stats;
DROP POLICY IF EXISTS "Anyone can upsert stats" ON public.farmer_crop_stats;

DROP POLICY IF EXISTS "Anyone can read farmers" ON public.farmers;
DROP POLICY IF EXISTS "Anyone can register" ON public.farmers;
DROP POLICY IF EXISTS "Anyone can update farmers" ON public.farmers;

DROP POLICY IF EXISTS "Anyone can insert OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can read OTP" ON public.otp_codes;
DROP POLICY IF EXISTS "Anyone can update OTP" ON public.otp_codes;

-- 2. Admin-only read access for sensitive backend tables (service role bypasses RLS for edge functions)
CREATE POLICY "Admins can read agent_deals" ON public.agent_deals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read agent_permissions" ON public.agent_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read buyers" ON public.buyers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read conversation_logs" ON public.conversation_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read deal_outcomes" ON public.deal_outcomes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read farm_plans" ON public.farm_plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read farmer_crop_stats" ON public.farmer_crop_stats FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read farmers" ON public.farmers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read otp_codes" ON public.otp_codes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Restrict profiles read access to authenticated users only (no more anonymous browsing of GPS / phone)
DROP POLICY IF EXISTS "Profiles readable publicly" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- 4. Harden distance_km with a fixed search_path
ALTER FUNCTION public.distance_km(double precision, double precision, double precision, double precision) SET search_path = public;
