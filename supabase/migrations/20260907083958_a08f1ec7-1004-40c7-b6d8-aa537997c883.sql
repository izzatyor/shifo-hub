-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','doktor','qabul','kassa','rahbar');
CREATE TYPE public.subscription_status AS ENUM ('trial','active','past_due','cancelled');
CREATE TYPE public.room_status AS ENUM ('bosh','band','tamirda');
CREATE TYPE public.patient_status AS ENUM ('yotoqda','ambulator','chiqarilgan');
CREATE TYPE public.payment_method AS ENUM ('naqd','karta','otkazma');

-- ============ CLINICS ============
CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES (foydalanuvchilar) ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  full_name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, clinic_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_clinic_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
  );
$$;

-- ============ CORE POLICIES ============
CREATE POLICY "clinics_select" ON public.clinics FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_clinic_id());
CREATE POLICY "clinics_insert" ON public.clinics FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY "clinics_update" ON public.clinics FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (id = public.current_clinic_id() AND public.is_clinic_admin()))
  WITH CHECK (public.is_super_admin() OR (id = public.current_clinic_id() AND public.is_clinic_admin()));
CREATE POLICY "clinics_delete" ON public.clinics FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin() OR clinic_id = public.current_clinic_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()))
  WITH CHECK (id = auth.uid() OR public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (clinic_id = public.current_clinic_id() AND public.is_clinic_admin()));

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin() OR clinic_id = public.current_clinic_id());

-- ============ TENANT TABLES ============
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid,
  full_name text NOT NULL,
  specialty text,
  phone text,
  cabinet text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  number text NOT NULL,
  room_type text,
  bed_count integer NOT NULL DEFAULT 1,
  price_per_day numeric(12,2) NOT NULL DEFAULT 0,
  status public.room_status NOT NULL DEFAULT 'bosh',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, number)
);

CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  gender text,
  phone text,
  address text,
  diagnosis text,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  admitted_at timestamptz,
  discharged_at timestamptz,
  status public.patient_status NOT NULL DEFAULT 'ambulator',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'naqd',
  purpose text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors, public.rooms, public.patients, public.payments, public.notes TO authenticated;
GRANT ALL ON public.doctors, public.rooms, public.patients, public.payments, public.notes TO service_role;

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors_tenant" ON public.doctors FOR ALL TO authenticated
  USING (public.is_super_admin() OR clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_super_admin() OR clinic_id = public.current_clinic_id());
CREATE POLICY "rooms_tenant" ON public.rooms FOR ALL TO authenticated
  USING (public.is_super_admin() OR clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_super_admin() OR clinic_id = public.current_clinic_id());
CREATE POLICY "patients_tenant" ON public.patients FOR ALL TO authenticated
  USING (public.is_super_admin() OR clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_super_admin() OR clinic_id = public.current_clinic_id());
CREATE POLICY "payments_tenant" ON public.payments FOR ALL TO authenticated
  USING (public.is_super_admin() OR clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_super_admin() OR clinic_id = public.current_clinic_id());
CREATE POLICY "notes_tenant" ON public.notes FOR ALL TO authenticated
  USING (public.is_super_admin() OR clinic_id = public.current_clinic_id())
  WITH CHECK (public.is_super_admin() OR clinic_id = public.current_clinic_id());

CREATE INDEX idx_doctors_clinic ON public.doctors(clinic_id);
CREATE INDEX idx_rooms_clinic ON public.rooms(clinic_id);
CREATE INDEX idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX idx_payments_clinic ON public.payments(clinic_id);
CREATE INDEX idx_notes_clinic ON public.notes(clinic_id);

-- ============ SIGNUP TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();