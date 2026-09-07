REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_clinic_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_clinic_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;