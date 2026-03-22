-- Expand the approved hospitals RPC so callers can also receive
-- stored address + coordinates (if configured), which avoids client-side
-- best-effort geocoding during booking.

CREATE OR REPLACE FUNCTION public.get_approved_hospitals()
RETURNS TABLE (
  id uuid,
  hospital_name text,
  city text,
  hospital_type text,
  address text,
  lat double precision,
  lng double precision
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, hospital_name, city, hospital_type::text, address, lat, lng
  FROM public.hospitals
  WHERE approval_status = 'approved'
  ORDER BY hospital_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_hospitals() TO anon;
GRANT EXECUTE ON FUNCTION public.get_approved_hospitals() TO authenticated;
