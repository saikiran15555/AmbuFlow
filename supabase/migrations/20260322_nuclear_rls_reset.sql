-- STEP 1: Drop every single policy on hospitals and bookings by name
-- Run this first to see what exists:
-- SELECT policyname FROM pg_policies WHERE tablename = 'hospitals';
-- SELECT policyname FROM pg_policies WHERE tablename = 'bookings';

DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Drop ALL policies on hospitals
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hospitals'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hospitals', pol.policyname);
  END LOOP;

  -- Drop ALL policies on bookings
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.bookings', pol.policyname);
  END LOOP;

  -- Drop ALL policies on profiles
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;

  -- Drop ALL policies on drivers
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drivers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.drivers', pol.policyname);
  END LOOP;

  -- Drop ALL policies on ambulances
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ambulances'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ambulances', pol.policyname);
  END LOOP;
END
$$;

-- STEP 2: Ensure RLS is enabled on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
-- Users read/update own profile; admins read all
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================
-- HOSPITALS
-- No subquery into profiles — use auth.jwt() for admin check
-- to avoid any cross-table recursion
-- ============================================================
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

CREATE POLICY "hospitals_delete"
ON public.hospitals FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- ============================================================
-- DRIVERS
-- ============================================================
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

-- ============================================================
-- BOOKINGS
-- No subquery into hospitals to avoid recursion
-- ============================================================
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
);

-- ============================================================
-- AMBULANCES
-- ============================================================
CREATE POLICY "ambulances_select"
ON public.ambulances FOR SELECT TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
  OR driver_id IN (
    SELECT id FROM public.drivers WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "ambulances_insert"
ON public.ambulances FOR INSERT TO authenticated
WITH CHECK (
  hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "ambulances_update"
ON public.ambulances FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
  OR driver_id IN (
    SELECT id FROM public.drivers WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
);
