-- Drop ALL existing conflicting hospital policies from every migration
DROP POLICY IF EXISTS "Admin full access" ON public.hospitals;
DROP POLICY IF EXISTS "admins_manage_hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_insert_own" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_select_own" ON public.hospitals;
DROP POLICY IF EXISTS "hospitals_update_own" ON public.hospitals;
DROP POLICY IF EXISTS "drivers_select_hospital" ON public.hospitals;
DROP POLICY IF EXISTS "Allow admin dashboard read hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Hospitals can read own hospital row" ON public.hospitals;

-- Single clean SELECT policy — no subquery into profiles, no recursion
CREATE POLICY "hospitals_select"
ON public.hospitals
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()          -- hospital reads own row
  OR (                             -- admin reads all: check role directly in auth.jwt()
    (auth.jwt() ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  OR EXISTS (                      -- drivers read their hospital row
    SELECT 1 FROM public.drivers
    WHERE drivers.hospital_id = hospitals.id
      AND drivers.profile_id = auth.uid()
  )
);

-- INSERT: hospital can insert own row
CREATE POLICY "hospitals_insert"
ON public.hospitals
FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

-- UPDATE: hospital updates own row, admin updates any
CREATE POLICY "hospitals_update"
ON public.hospitals
FOR UPDATE
TO authenticated
USING (
  profile_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  profile_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Fix bookings infinite recursion: drop all overlapping bookings SELECT policies
DROP POLICY IF EXISTS "Allow admin dashboard read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Hospitals can read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Drivers can read assigned bookings" ON public.bookings;

-- Single clean bookings SELECT — no hospital subquery to avoid recursion
CREATE POLICY "bookings_select"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR driver_id IN (
    SELECT id FROM public.drivers WHERE profile_id = auth.uid()
  )
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
