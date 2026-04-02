-- Restore driver access to their assigned bookings in bookings_select.
-- Uses EXISTS on drivers.profile_id = auth.uid() — no subquery back into bookings,
-- so no recursion with drivers_select (which no longer queries bookings).

DROP POLICY IF EXISTS "bookings_select" ON public.bookings;

CREATE POLICY "bookings_select"
ON public.bookings FOR SELECT TO authenticated
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
);
