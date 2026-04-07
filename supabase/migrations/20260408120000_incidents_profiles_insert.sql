-- Incident reports (JSONB rows, same pattern as other lighthouse tables)
CREATE TABLE IF NOT EXISTS public.lighthouse_incident_reports (
  incident_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.lighthouse_incident_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS lighthouse_staff_all ON public.lighthouse_incident_reports';
  EXECUTE 'CREATE POLICY lighthouse_staff_all ON public.lighthouse_incident_reports FOR ALL TO authenticated USING (true) WITH CHECK (true)';
END $$;

-- Allow new users to insert their own profile row after signUp (client-side)
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
