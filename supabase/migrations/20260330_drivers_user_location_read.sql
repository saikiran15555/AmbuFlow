-- Allow users to read driver location when they have a booking assigned to that driver
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;

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
    SELECT driver_id FROM public.bookings WHERE user_id = auth.uid() AND driver_id IS NOT NULL
  )
);
