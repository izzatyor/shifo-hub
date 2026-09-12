CREATE OR REPLACE FUNCTION public.sync_room_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ids uuid[];
  rid uuid;
BEGIN
  ids := ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[NEW.room_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.room_id WHEN TG_OP = 'DELETE' THEN OLD.room_id END]) AS x WHERE x IS NOT NULL);
  FOREACH rid IN ARRAY ids LOOP
    UPDATE public.rooms r
    SET status = CASE
      WHEN r.status = 'tamirda'::room_status THEN 'tamirda'::room_status
      WHEN (SELECT count(*) FROM public.patients p WHERE p.room_id = r.id AND p.status = 'yotoqda'::patient_status) > 0 THEN 'band'::room_status
      ELSE 'bosh'::room_status
    END
    WHERE r.id = rid;
  END LOOP;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.sync_room_status() FROM PUBLIC, anon, authenticated;