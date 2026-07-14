-- ── BUYERS MARKETPLACE ────────────────────────────────────────
CREATE TABLE public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  buyer_type TEXT NOT NULL DEFAULT 'wholesaler',
  contact_phone TEXT,
  contact_email TEXT,
  region TEXT,
  city TEXT,
  crops TEXT[] NOT NULL DEFAULT '{}',
  min_price_per_kg NUMERIC,
  max_price_per_kg NUMERIC,
  min_volume_kg NUMERIC DEFAULT 50,
  max_volume_kg NUMERIC,
  payment_terms TEXT DEFAULT 'COD',
  reliability_score NUMERIC DEFAULT 0.7,
  verified BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read buyers" ON public.buyers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert buyers" ON public.buyers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update buyers" ON public.buyers FOR UPDATE USING (true);
CREATE INDEX idx_buyers_active_crops ON public.buyers USING GIN(crops) WHERE active = true;

-- ── DEAL OUTCOMES (learning loop) ─────────────────────────────
CREATE TABLE public.deal_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL,
  farmer_name TEXT NOT NULL,
  crop TEXT NOT NULL,
  predicted_price NUMERIC,
  actual_price NUMERIC,
  predicted_confidence NUMERIC,
  recommendation TEXT,
  outcome TEXT NOT NULL,
  days_to_close INTEGER,
  farmer_rating INTEGER,
  feedback_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read outcomes" ON public.deal_outcomes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert outcomes" ON public.deal_outcomes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update outcomes" ON public.deal_outcomes FOR UPDATE USING (true);
CREATE INDEX idx_outcomes_farmer_crop ON public.deal_outcomes(farmer_name, crop, created_at DESC);

-- ── FARMER CROP STATS (rolled-up learning) ────────────────────
CREATE TABLE public.farmer_crop_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_name TEXT NOT NULL,
  crop TEXT NOT NULL,
  deals_closed INTEGER NOT NULL DEFAULT 0,
  deals_won INTEGER NOT NULL DEFAULT 0,
  avg_achieved_price NUMERIC,
  avg_predicted_price NUMERIC,
  avg_rating NUMERIC,
  prediction_accuracy NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(farmer_name, crop)
);
ALTER TABLE public.farmer_crop_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read stats" ON public.farmer_crop_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can upsert stats" ON public.farmer_crop_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update stats" ON public.farmer_crop_stats FOR UPDATE USING (true);

-- ── EXTEND agent_deals ────────────────────────────────────────
ALTER TABLE public.agent_deals
  ADD COLUMN IF NOT EXISTS buyer_id UUID,
  ADD COLUMN IF NOT EXISTS approval_state TEXT NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS predicted_price NUMERIC,
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS farmer_rating INTEGER,
  ADD COLUMN IF NOT EXISTS feedback_note TEXT;

-- ── SEED real SA buyers ───────────────────────────────────────
INSERT INTO public.buyers (name, buyer_type, contact_phone, region, city, crops, min_price_per_kg, max_price_per_kg, min_volume_kg, max_volume_kg, payment_terms, reliability_score, verified, notes) VALUES
('Joburg Market (City Deep)', 'wholesaler', '+27116130000', 'Gauteng', 'Johannesburg', ARRAY['Spinach','Tomatoes','Cabbage','Potatoes','Onions','Carrots'], 6, 22, 100, 50000, 'COD', 0.92, true, 'Largest fresh produce market in SA'),
('Tshwane Market', 'wholesaler', '+27123581400', 'Gauteng', 'Pretoria', ARRAY['Spinach','Tomatoes','Maize','Cabbage','Potatoes'], 5, 20, 100, 30000, '7 days', 0.88, true, 'Major municipal market'),
('Cape Town Market (Epping)', 'wholesaler', '+27215347111', 'Western Cape', 'Cape Town', ARRAY['Spinach','Tomatoes','Cabbage','Potatoes','Carrots'], 7, 24, 100, 40000, 'COD', 0.90, true, 'Western Cape primary market'),
('Durban Bulk Market', 'wholesaler', '+27313112900', 'KZN', 'Durban', ARRAY['Spinach','Tomatoes','Cabbage','Maize','Potatoes'], 6, 21, 100, 25000, '14 days', 0.85, true, 'KZN regional hub'),
('Freshmark (Shoprite/Checkers)', 'retailer', '+27219808000', 'Western Cape', 'Cape Town', ARRAY['Spinach','Tomatoes','Cabbage','Potatoes','Carrots','Onions'], 9, 28, 500, 100000, '30 days', 0.95, true, 'Retail group sourcing arm'),
('Pick n Pay Fresh', 'retailer', '+27218568000', 'Western Cape', 'Cape Town', ARRAY['Spinach','Tomatoes','Cabbage','Potatoes'], 10, 30, 500, 80000, '30 days', 0.94, true, 'Direct retail buyer programme'),
('Local Spaza Co-op (Soweto)', 'cooperative', '+27114449000', 'Gauteng', 'Soweto', ARRAY['Spinach','Tomatoes','Cabbage','Maize'], 5, 18, 50, 2000, 'COD', 0.78, false, 'Township informal aggregator'),
('SA Export Agents (Pty) Ltd', 'export', '+27214190000', 'Western Cape', 'Cape Town', ARRAY['Tomatoes','Citrus','Avocado','Onions'], 12, 45, 1000, 200000, 'LC 30 days', 0.86, true, 'BRICS / Middle East export channel');