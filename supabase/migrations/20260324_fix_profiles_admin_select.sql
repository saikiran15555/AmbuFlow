-- Fix profiles SELECT policies so admin can read all profiles.
-- The existing admins_select_all_profiles uses EXISTS(SELECT FROM profiles WHERE role='admin')
-- which is a self-referential check — replace with JWT-based check.

DROP POLICY IF EXISTS "admins_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "users_select_own_profile" ON public.profiles;

-- Single clean policy: own row always readable; admin reads all via JWT
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
