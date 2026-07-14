
-- Create farmers table
CREATE TABLE public.farmers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE,
  UNIQUE(phone)
);

ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read farmers" ON public.farmers FOR SELECT USING (true);
CREATE POLICY "Anyone can register" ON public.farmers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update farmers" ON public.farmers FOR UPDATE USING (true);

-- Create OTP codes table  
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '5 minutes'),
  used BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert OTP" ON public.otp_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read OTP" ON public.otp_codes FOR SELECT USING (true);
CREATE POLICY "Anyone can update OTP" ON public.otp_codes FOR UPDATE USING (true);
