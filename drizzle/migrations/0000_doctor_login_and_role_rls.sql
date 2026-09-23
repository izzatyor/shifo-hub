-- 1. doctors.user_id unique (ustun allaqachon mavjud, nullable)
CREATE UNIQUE INDEX IF NOT EXISTS doctors_user_id_key ON public.doctors (user_id) WHERE user_id IS NOT NULL;

-- 2. Yordamchi funksiyalar
CREATE OR REPLACE FUNCTION public.current_doctor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_only_role(_role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'));
$$;

GRANT EXECUTE ON FUNCTION public.current_doctor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_only_role(app_role) TO authenticated;

-- 3. patients siyosatlari
DROP POLICY IF EXISTS patients_tenant ON public.patients;

CREATE POLICY patients_select ON public.patients FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    clinic_id = current_clinic_id()
    AND (NOT public.is_only_role('doktor') OR doctor_id = public.current_doctor_id())
  )
);

CREATE POLICY patients_insert ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (clinic_id = current_clinic_id()
      AND NOT public.is_only_role('rahbar')
      AND NOT public.is_only_role('kassa'))
);

CREATE POLICY patients_update ON public.patients FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR (clinic_id = current_clinic_id()
      AND NOT public.is_only_role('rahbar')
      AND NOT public.is_only_role('kassa')
      AND (NOT public.is_only_role('doktor') OR doctor_id = public.current_doctor_id()))
)
WITH CHECK (
  is_super_admin()
  OR (clinic_id = current_clinic_id()
      AND NOT public.is_only_role('rahbar')
      AND NOT public.is_only_role('kassa'))
);

CREATE POLICY patients_delete ON public.patients FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (clinic_id = current_clinic_id()
      AND NOT public.is_only_role('rahbar')
      AND NOT public.is_only_role('kassa')
      AND NOT public.is_only_role('doktor'))
);

-- 4. Boshqa jadvallar: rahbar faqat SELECT
DROP POLICY IF EXISTS doctors_tenant ON public.doctors;
CREATE POLICY doctors_select ON public.doctors FOR SELECT TO authenticated
USING (is_super_admin() OR clinic_id = current_clinic_id());
CREATE POLICY doctors_write ON public.doctors FOR ALL TO authenticated
USING (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')))
WITH CHECK (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')));

DROP POLICY IF EXISTS rooms_tenant ON public.rooms;
CREATE POLICY rooms_select ON public.rooms FOR SELECT TO authenticated
USING (is_super_admin() OR clinic_id = current_clinic_id());
CREATE POLICY rooms_write ON public.rooms FOR ALL TO authenticated
USING (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')))
WITH CHECK (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')));

DROP POLICY IF EXISTS payments_tenant ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
USING (is_super_admin() OR clinic_id = current_clinic_id());
CREATE POLICY payments_write ON public.payments FOR ALL TO authenticated
USING (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')))
WITH CHECK (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')));

DROP POLICY IF EXISTS notes_tenant ON public.notes;
CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated
USING (is_super_admin() OR clinic_id = current_clinic_id());
CREATE POLICY notes_write ON public.notes FOR ALL TO authenticated
USING (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')))
WITH CHECK (is_super_admin() OR (clinic_id = current_clinic_id() AND NOT public.is_only_role('rahbar')));
