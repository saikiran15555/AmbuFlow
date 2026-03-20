-- A SECURITY DEFINER function runs as the DB owner (postgres),
-- bypassing RLS entirely. This guarantees approved hospitals are
-- always readable on the registration page regardless of auth state.
CREATE OR REPLACE FUNCTION public.get_approved_hospitals()
RETURNS TABLE (id uuid, hospital_name text, city text, hospital_type text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, hospital_name, city, hospital_type
  FROM public.hospitals
  WHERE approval_status = 'approved'
  ORDER BY hospital_name;
$$;

-- Grant execute to both anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_approved_hospitals() TO anon;
GRANT EXECUTE ON FUNCTION public.get_approved_hospitals() TO authenticated;
