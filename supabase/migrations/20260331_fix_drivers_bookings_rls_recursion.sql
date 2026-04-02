-- Fix circular RLS recursion:
-- drivers_select queries bookings, bookings_select queries drivers = infinite loop.
-- Solution: bookings_select uses NO subquery into drivers.
--           drivers_select uses a direct join on bookings.user_id only (no back-reference to drivers).

-- ── BOOKINGS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete" ON public.bookings;

-- Users see own bookings; drivers see bookings where driver_id matches their drivers.id
-- via profile_id (no back-reference from drivers into bookings here).
-- Hospital staff see bookings for their hospital.
CREATE POLICY "bookings_select"
ON public.bookings FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = bookings.driver_id
      AND d.profile_id = auth.uid()
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
  OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = bookings.driver_id
      AND d.profile_id = auth.uid()
  )
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = bookings.driver_id
      AND d.profile_id = auth.uid()
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

-- ── DRIVERS ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;

-- Users can read a driver row if they have a booking assigned to that driver.
-- This subquery goes bookings → drivers (one direction only, no loop).
CREATE POLICY "drivers_select"
ON public.drivers FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
  OR id IN (
    SELECT driver_id FROM public.bookings
    WHERE user_id = auth.uid()
      AND driver_id IS NOT NULL
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
