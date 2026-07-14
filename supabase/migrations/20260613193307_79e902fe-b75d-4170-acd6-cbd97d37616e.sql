
CREATE TYPE public.app_role AS ENUM ('farmer', 'seller', 'buyer', 'admin');
CREATE TYPE public.listing_category AS ENUM ('produce', 'livestock', 'inputs', 'equipment', 'other');
CREATE TYPE public.listing_status AS ENUM ('active', 'sold', 'paused');
CREATE TYPE public.offer_status AS ENUM ('pending', 'accepted', 'countered', 'declined', 'withdrawn');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  primary_role public.app_role NOT NULL DEFAULT 'farmer',
  province TEXT,
  town TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  language TEXT DEFAULT 'en-ZA',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.farmer_details (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  crops TEXT[] DEFAULT '{}',
  farm_size_ha NUMERIC,
  livestock TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farmer_details TO authenticated;
GRANT ALL ON public.farmer_details TO service_role;
ALTER TABLE public.farmer_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages farmer details" ON public.farmer_details FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.seller_details (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  categories public.listing_category[] DEFAULT '{}',
  delivery_radius_km INTEGER DEFAULT 80,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_details TO authenticated;
GRANT ALL ON public.seller_details TO service_role;
ALTER TABLE public.seller_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller details readable" ON public.seller_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner inserts seller details" ON public.seller_details FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates seller details" ON public.seller_details FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes seller details" ON public.seller_details FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category public.listing_category NOT NULL DEFAULT 'produce',
  price NUMERIC NOT NULL CHECK (price >= 0),
  unit TEXT DEFAULT 'kg',
  quantity NUMERIC DEFAULT 1,
  photo_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status public.listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings readable" ON public.listings FOR SELECT TO authenticated USING (status = 'active' OR seller_id = auth.uid());
CREATE POLICY "Seller inserts own listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Seller updates own listings" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Seller deletes own listings" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = seller_id);

CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  message TEXT,
  status public.offer_status NOT NULL DEFAULT 'pending',
  parent_offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties view offers" ON public.offers FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Parties create offers" ON public.offers FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Parties update offers" ON public.offers FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id) WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TABLE public.offer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.offer_messages TO authenticated;
GRANT ALL ON public.offer_messages TO service_role;
ALTER TABLE public.offer_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read messages" ON public.offer_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
);
CREATE POLICY "Parties send messages" ON public.offer_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
);

CREATE OR REPLACE FUNCTION public.distance_km(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE SQL IMMUTABLE AS $$
  SELECT 6371 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) +
      sin(radians(lat1)) * sin(radians(lat2))
    ))
  )
$$;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER farmer_details_updated_at BEFORE UPDATE ON public.farmer_details FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER seller_details_updated_at BEFORE UPDATE ON public.seller_details FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email,''), '@', 1)),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
