-- Allow anonymous (unauthenticated) users to read approved hospitals.
-- This is needed so the driver registration page can show the hospital dropdown
-- before the user has signed up / logged in.
DROP POLICY IF EXISTS "hospitals_select_anon" ON public.hospitals;

CREATE POLICY "hospitals_select_anon"
ON public.hospitals FOR SELECT TO anon
USING (approval_status = 'approved');
