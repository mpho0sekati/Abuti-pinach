CREATE TABLE IF NOT EXISTS public.farm_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  crop text,
  note text,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_ledger TO authenticated;
GRANT ALL ON public.farm_ledger TO service_role;
ALTER TABLE public.farm_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger owner all" ON public.farm_ledger FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS farm_ledger_user_date_idx ON public.farm_ledger (user_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS public.crop_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop text NOT NULL,
  task text NOT NULL,
  due_date date NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_calendar TO authenticated;
GRANT ALL ON public.crop_calendar TO service_role;
ALTER TABLE public.crop_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar owner all" ON public.crop_calendar FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS crop_calendar_user_due_idx ON public.crop_calendar (user_id, due_date);

CREATE TABLE IF NOT EXISTS public.livestock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species text NOT NULL,
  tag text,
  count integer NOT NULL DEFAULT 1 CHECK (count >= 0),
  birth_date date,
  last_vaccination date,
  last_health_check date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.livestock TO authenticated;
GRANT ALL ON public.livestock TO service_role;
ALTER TABLE public.livestock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livestock owner all" ON public.livestock FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  province text,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts readable" ON public.community_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "posts author insert" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts author update" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts author delete" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS community_posts_created_idx ON public.community_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_replies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.community_replies TO authenticated;
GRANT ALL ON public.community_replies TO service_role;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "replies readable" ON public.community_replies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "replies author insert" ON public.community_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "replies author delete" ON public.community_replies FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS community_replies_post_idx ON public.community_replies (post_id, created_at);