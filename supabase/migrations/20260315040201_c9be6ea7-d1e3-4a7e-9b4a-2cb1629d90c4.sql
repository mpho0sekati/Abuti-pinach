CREATE TABLE public.farm_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  farmer_name TEXT,
  task_title TEXT NOT NULL,
  task_description TEXT,
  due_date DATE NOT NULL,
  category TEXT DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.farm_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert plans" ON public.farm_plans FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can read plans" ON public.farm_plans FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update plans" ON public.farm_plans FOR UPDATE TO public USING (true);