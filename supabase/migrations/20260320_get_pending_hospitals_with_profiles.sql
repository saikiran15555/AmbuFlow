-- Returns pending hospitals joined with profile email + phone.
-- SECURITY DEFINER bypasses RLS so the admin client (anon key) can read
-- other users' profile rows without needing a service-role key.
CREATE OR REPLACE FUNCTION get_pending_hospitals_with_profiles()
RETURNS TABLE (
  id                uuid,
  profile_id        uuid,
  hospital_name     text,
  city              text,
  hospital_type     text,
  approval_status   text,
  created_at        timestamptz,
  email             text,
  phone             text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id,
    h.profile_id,
    h.hospital_name,
    h.city,
    h.hospital_type,
    h.approval_status,
    h.created_at,
    p.email,
    p.phone
  FROM hospitals h
  LEFT JOIN profiles p ON p.id = h.profile_id
  WHERE h.approval_status = 'pending'
  ORDER BY h.created_at DESC;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION get_pending_hospitals_with_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_pending_hospitals_with_profiles() TO authenticated;
