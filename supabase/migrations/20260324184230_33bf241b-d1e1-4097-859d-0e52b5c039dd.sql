
-- Agent permissions: what the farmer allows the agent to do
CREATE TABLE public.agent_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_name text NOT NULL,
  session_id text,
  auto_negotiate boolean NOT NULL DEFAULT false,
  min_price_per_kg numeric(10,2),
  crops text[] DEFAULT '{}',
  max_deal_value numeric(12,2),
  allow_logistics boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read permissions" ON public.agent_permissions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert permissions" ON public.agent_permissions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update permissions" ON public.agent_permissions FOR UPDATE TO public USING (true);

-- Agent deals: tracked negotiations and transactions
CREATE TABLE public.agent_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_name text NOT NULL,
  session_id text,
  crop text NOT NULL,
  quantity_kg numeric(10,2),
  asking_price numeric(10,2) NOT NULL,
  negotiated_price numeric(10,2),
  buyer_name text,
  buyer_contact text,
  status text NOT NULL DEFAULT 'searching',
  logistics_status text DEFAULT 'pending',
  delivery_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read deals" ON public.agent_deals FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert deals" ON public.agent_deals FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update deals" ON public.agent_deals FOR UPDATE TO public USING (true);
