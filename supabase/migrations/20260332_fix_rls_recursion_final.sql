-- ============================================================
-- FINAL FIX: Break bookings <-> drivers RLS recursion completely
-- Strategy:
--   bookings_select: NO subquery into drivers at all
--   drivers_select:  NO subquery into bookings at all
--   Driver location for users: handled via a SECURITY DEFINER function
--                              that bypasses RLS safely
-- ============================================================

-- ── BOOKINGS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete" ON public.bookings;

-- No subquery into drivers — driver access handled separately
CREATE POLICY "bookings_select"
ON public.bookings FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "bookings_insert"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookings_update"
ON public.bookings FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "bookings_delete"
ON public.bookings FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ── DRIVERS ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;

-- No subquery into bookings — user access to driver location handled via function below
CREATE POLICY "drivers_select"
ON public.drivers FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "drivers_insert"
ON public.drivers FOR INSERT TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "drivers_update"
ON public.drivers FOR UPDATE TO authenticated
USING (
  profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
);

-- ── SECURITY DEFINER FUNCTION ────────────────────────────────────────────────
-- Bypasses RLS to return driver location for a booking the user owns.
-- Safe: checks user_id = auth.uid() inside the function itself.
DROP FUNCTION IF EXISTS public.get_driver_location(uuid);

CREATE OR REPLACE FUNCTION public.get_driver_location(booking_id uuid)
RETURNS TABLE(current_lat double precision, current_lng double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT d.current_lat, d.current_lng
    FROM public.bookings b
    JOIN public.drivers d ON d.id = b.driver_id
    WHERE b.id = booking_id
      AND b.user_id = auth.uid()
      AND b.driver_id IS NOT NULL;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.get_driver_location(uuid) TO authenticated;
