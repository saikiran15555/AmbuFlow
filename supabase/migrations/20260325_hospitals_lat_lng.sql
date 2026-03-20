-- Add lat/lng to hospitals for proximity-based sorting
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- Allow ALL authenticated users to read approved hospitals
-- (previously only profile_id owner or admin could read — regular users were blocked)
DROP POLICY IF EXISTS "hospitals_select" ON public.hospitals;

CREATE POLICY "hospitals_select"
ON public.hospitals FOR SELECT TO authenticated
USING (
  approval_status = 'approved'
  OR profile_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
