-- Allow authenticated users (including normal app users) to read approved hospitals.
-- This is required for the booking flow hospital search/selection.

DROP POLICY IF EXISTS "hospitals_select_approved_authenticated" ON public.hospitals;

CREATE POLICY "hospitals_select_approved_authenticated"
ON public.hospitals
FOR SELECT
TO authenticated
USING (approval_status = 'approved');
