
-- Patients
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.patients (full_name);
CREATE INDEX ON public.patients (phone);

-- Auto-generate patient_code like P-000001
CREATE SEQUENCE IF NOT EXISTS public.patient_code_seq START 1;
CREATE OR REPLACE FUNCTION public.set_patient_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.patient_code IS NULL OR NEW.patient_code = '' THEN
    NEW.patient_code := 'P-' || LPAD(nextval('public.patient_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_patient_code BEFORE INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_patient_code();

ALTER TABLE public.patients ALTER COLUMN patient_code DROP NOT NULL;

-- Consultations
CREATE TABLE public.consultations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  notes TEXT,
  diagnosis TEXT,
  prescription TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.consultations (patient_id);

-- Billing
CREATE TABLE public.billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.billing (patient_id);

-- Drugs
CREATE TABLE public.drugs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_drugs_updated BEFORE UPDATE ON public.drugs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Grants (no auth: allow anon + authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drugs TO anon, authenticated;
GRANT ALL ON public.patients, public.consultations, public.billing, public.drugs TO service_role;
GRANT USAGE ON SEQUENCE public.patient_code_seq TO anon, authenticated, service_role;

-- RLS enabled with permissive policies (MVP, no auth yet)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON public.patients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.consultations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.billing FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON public.drugs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
