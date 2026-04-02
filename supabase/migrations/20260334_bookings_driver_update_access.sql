-- Drivers need UPDATE access on bookings to change status (arrived, picked_up, completed).
-- Uses EXISTS on drivers.profile_id — same safe pattern as bookings_select, no recursion.

DROP POLICY IF EXISTS "bookings_update" ON public.bookings;

CREATE POLICY "bookings_update"
ON public.bookings FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = bookings.driver_id
      AND d.profile_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  OR hospital_id IN (
    SELECT id FROM public.hospitals WHERE profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = bookings.driver_id
      AND d.profile_id = auth.uid()
  )
);
