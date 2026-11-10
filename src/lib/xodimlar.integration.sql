-- Run in a rollback-only privileged test transaction; leaves no rows.
BEGIN;
DO $$
DECLARE v_user uuid := gen_random_uuid(); v_clinic uuid := gen_random_uuid(); i integer;
BEGIN
 INSERT INTO public.clinics(id, name) VALUES(v_clinic, 'Rollback-only limiter test');
 -- Test limiter using a real existing profile, avoiding managed auth writes.
 SELECT id INTO v_user FROM public.profiles LIMIT 1;
 IF v_user IS NULL THEN RAISE EXCEPTION 'Test requires an existing profile'; END IF;
 DELETE FROM public.staff_login_attempts WHERE user_id = v_user;
 FOR i IN 1..5 LOOP
  IF NOT public.consume_staff_login_attempt(v_user) THEN RAISE EXCEPTION 'Attempt % of 5 unexpectedly rejected', i; END IF;
 END LOOP;
 IF public.consume_staff_login_attempt(v_user) THEN RAISE EXCEPTION 'Sixth attempt must be rejected'; END IF;
 UPDATE public.staff_login_attempts SET window_started_at = now() - interval '15 minutes' WHERE user_id = v_user;
 IF NOT public.consume_staff_login_attempt(v_user) THEN RAISE EXCEPTION 'Attempt after 15 minutes must be allowed'; END IF;
 IF has_function_privilege('anon', 'public.consume_staff_login_attempt(uuid)', 'EXECUTE') THEN RAISE EXCEPTION 'Anonymous callers must not bypass limiter'; END IF;
 IF has_function_privilege('authenticated', 'public.finish_staff_creation(uuid,uuid,text,text,public.app_role)', 'EXECUTE') THEN RAISE EXCEPTION 'Staff provisioning RPC must be service-only'; END IF;
END $$;
ROLLBACK;