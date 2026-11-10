CREATE TABLE public.staff_login_attempts (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 window_started_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.staff_login_attempts TO service_role;
REVOKE ALL ON public.staff_login_attempts FROM anon, authenticated;
ALTER TABLE public.staff_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.consume_staff_login_attempt(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_allowed boolean;
BEGIN
 INSERT INTO public.staff_login_attempts(user_id, attempts) VALUES (p_user_id, 1)
 ON CONFLICT (user_id) DO UPDATE SET
 attempts = CASE WHEN staff_login_attempts.window_started_at <= now() - interval '15 minutes' THEN 1 ELSE staff_login_attempts.attempts + 1 END,
 window_started_at = CASE WHEN staff_login_attempts.window_started_at <= now() - interval '15 minutes' THEN now() ELSE staff_login_attempts.window_started_at END
 WHERE staff_login_attempts.window_started_at <= now() - interval '15 minutes' OR staff_login_attempts.attempts < 5
 RETURNING true INTO v_allowed;
 RETURN coalesce(v_allowed, false);
END; $$;
REVOKE ALL ON FUNCTION public.consume_staff_login_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_staff_login_attempt(uuid) TO service_role;

CREATE FUNCTION public.finish_staff_creation(p_user_id uuid, p_clinic_id uuid, p_full_name text, p_email text, p_role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF p_role NOT IN ('kassa', 'rahbar', 'qabul') THEN RAISE EXCEPTION 'Invalid staff role'; END IF;
 INSERT INTO public.profiles(id, clinic_id, full_name, email) VALUES(p_user_id, p_clinic_id, p_full_name, p_email)
 ON CONFLICT(id) DO UPDATE SET clinic_id = excluded.clinic_id, full_name = excluded.full_name, email = excluded.email;
 INSERT INTO public.user_roles(user_id, clinic_id, role) VALUES(p_user_id, p_clinic_id, p_role);
END; $$;
REVOKE ALL ON FUNCTION public.finish_staff_creation(uuid, uuid, text, text, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_staff_creation(uuid, uuid, text, text, public.app_role) TO service_role;