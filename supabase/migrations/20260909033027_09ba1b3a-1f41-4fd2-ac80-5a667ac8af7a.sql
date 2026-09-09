
INSERT INTO public.rooms (clinic_id, number, room_type, bed_count, price_per_day, status)
SELECT c.id,
       (f.floor * 100 + n.n)::text,
       CASE WHEN b.beds = 1 THEN 'Lyuks' WHEN b.beds = 2 THEN 'Pul-lyuks' ELSE 'Oddiy' END,
       b.beds,
       CASE WHEN b.beds = 1 THEN 500000 WHEN b.beds = 2 THEN 300000 ELSE 150000 END,
       'bosh'::room_status
FROM public.clinics c
CROSS JOIN (VALUES (1,4),(2,14),(3,14),(4,22)) AS f(floor, cnt)
CROSS JOIN LATERAL generate_series(1, f.cnt) AS n(n)
CROSS JOIN LATERAL (
  SELECT CASE
           WHEN f.floor = 1 THEN 1
           WHEN n.n <= 4 THEN 1
           WHEN f.floor = 4 AND n.n <= 12 THEN 2
           WHEN f.floor <> 4 AND n.n <= 10 THEN 2
           ELSE 4
         END AS beds
) b
WHERE NOT EXISTS (
  SELECT 1 FROM public.rooms r WHERE r.clinic_id = c.id AND r.number = (f.floor * 100 + n.n)::text
);

CREATE OR REPLACE FUNCTION public.sync_room_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids uuid[];
  rid uuid;
BEGIN
  ids := ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[NEW.room_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.room_id WHEN TG_OP = 'DELETE' THEN OLD.room_id END]) AS x WHERE x IS NOT NULL);
  FOREACH rid IN ARRAY ids LOOP
    UPDATE public.rooms r
    SET status = CASE
      WHEN r.status = 'tamirda' THEN 'tamirda'
      WHEN (SELECT count(*) FROM public.patients p WHERE p.room_id = r.id AND p.status = 'yotoqda') > 0 THEN 'band'
      ELSE 'bosh'
    END
    WHERE r.id = rid;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS patients_sync_room_status ON public.patients;
CREATE TRIGGER patients_sync_room_status
AFTER INSERT OR UPDATE OF room_id, status OR DELETE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.sync_room_status();
