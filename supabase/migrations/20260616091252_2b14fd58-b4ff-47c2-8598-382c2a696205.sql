
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Auto-verify when a phone is present (simple proxy for now)
UPDATE public.profiles SET verified = true, verified_at = now() WHERE phone IS NOT NULL AND verified = false;

CREATE TABLE IF NOT EXISTS public.seller_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, buyer_id, listing_id)
);

GRANT SELECT ON public.seller_ratings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seller_ratings TO authenticated;
GRANT ALL ON public.seller_ratings TO service_role;

ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings readable by all"
  ON public.seller_ratings FOR SELECT
  USING (true);

CREATE POLICY "Buyer creates own rating"
  ON public.seller_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id AND auth.uid() <> seller_id);

CREATE POLICY "Buyer updates own rating"
  ON public.seller_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyer deletes own rating"
  ON public.seller_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE TRIGGER seller_ratings_updated_at
  BEFORE UPDATE ON public.seller_ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS seller_ratings_seller_idx ON public.seller_ratings(seller_id);

-- Allow public (anon) read of active listings + seller profiles so the marketplace
-- is discoverable on Google / AI search engines (these are intentionally public storefront pages).
GRANT SELECT ON public.listings TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.seller_details TO anon;

DROP POLICY IF EXISTS "Active listings readable" ON public.listings;
CREATE POLICY "Active listings readable"
  ON public.listings FOR SELECT
  USING (status = 'active' OR seller_id = auth.uid());

DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable publicly"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Seller details readable" ON public.seller_details;
CREATE POLICY "Seller details readable publicly"
  ON public.seller_details FOR SELECT
  USING (true);
