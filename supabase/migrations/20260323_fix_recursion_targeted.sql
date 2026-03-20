-- Fix infinite recursion by replacing only the specific conflicting policies.
-- Uses exact policy names from the live Supabase schema.

-- ============================================================
-- HOSPITALS: replace hospitals_select with JWT-based admin check
-- (no subquery into profiles = no recursion)
-- ============================================================
DROP POLICY IF EXISTS "hospitals_select" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_insert" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_update" ON public.hospitals;

CREATE POLICY "hospitals_select"
ON public.hospitals FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

CREATE POLICY "hospitals_insert"
ON public.hospitals FOR INSERT TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "hospitals_update"
ON public.hospitals FOR UPDATE TO authenticated
USING (
  profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ============================================================
-- BOOKINGS: drop all overlapping SELECT policies, create one clean one
-- hospital_select_requests and hospitals_select_hospital_bookings
-- both do EXISTS(SELECT FROM hospitals) which triggers hospitals_select
-- which previously queried profiles = recursion chain
-- Now hospitals_select uses JWT only, so the subquery is safe.
-- ============================================================
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_admin" ON public.bookings;
DROP POLICY IF EXISTS "hospital_select_requests" ON public.bookings;
DROP POLICY IF EXISTS "hospitals_select_hospital_bookings" ON public.bookings;
DROP POLICY IF EXISTS "drivers_select_assigned_bookings" ON public.bookings;
DROP POLICY IF EXISTS "users_manage_own_bookings" ON public.bookings;
DROP POLICY IF EXISTS "admins_manage_all_bookings" ON public.bookings;

CREATE POLICY "bookings_select"
ON public.bookings FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR driver_id IN (
    SELECT id FROM public.drivers WHERE profile_id = auth.uid()
  )
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
  OR driver_id IN (
    SELECT id FROM public.drivers WHERE profile_id = auth.uid()
  )
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR driver_id IN (
    SELECT id FROM public.drivers WHERE profile_id = auth.uid()
  )
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
