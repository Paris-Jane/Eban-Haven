-- Lighthouse program data for browser access via Supabase (PostgREST) + optional CSV import.
-- Run in Supabase SQL Editor or via supabase db push.
-- After migrate: import CSVs with frontend/scripts/import-lighthouse-csv.mjs (service role key, never in Vite).

CREATE TABLE IF NOT EXISTS public.lighthouse_site_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'Haven of Hope',
  description text
);

INSERT INTO public.lighthouse_site_settings (id, name, description)
VALUES (
  1,
  'Haven of Hope',
  'A comprehensive platform to manage survivor rehabilitation programs, track case outcomes, and provide transparent impact reporting for supporters.'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.lighthouse_residents (
  resident_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_supporters (
  supporter_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_donations (
  donation_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_donation_allocations (
  allocation_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_safehouses (
  safehouse_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_process_recordings (
  recording_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_home_visitations (
  visitation_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_intervention_plans (
  plan_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_education_records (
  education_record_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_health_wellbeing_records (
  health_record_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_public_impact_snapshots (
  snapshot_id integer PRIMARY KEY,
  published boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lighthouse_safehouse_monthly_metrics (
  metric_id integer PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.lighthouse_site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_supporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_donation_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_safehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_process_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_home_visitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_intervention_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_education_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_health_wellbeing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_public_impact_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lighthouse_safehouse_monthly_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lighthouse_site_select_anon ON public.lighthouse_site_settings;
CREATE POLICY lighthouse_site_select_anon ON public.lighthouse_site_settings
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS lighthouse_site_all_auth ON public.lighthouse_site_settings;
CREATE POLICY lighthouse_site_all_auth ON public.lighthouse_site_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS lighthouse_snapshots_select_anon ON public.lighthouse_public_impact_snapshots;
CREATE POLICY lighthouse_snapshots_select_anon ON public.lighthouse_public_impact_snapshots
  FOR SELECT TO anon USING (published = true);

DROP POLICY IF EXISTS lighthouse_snapshots_all_auth ON public.lighthouse_public_impact_snapshots;
CREATE POLICY lighthouse_snapshots_all_auth ON public.lighthouse_public_impact_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Staff data: full access for authenticated Supabase users only (configure app login accordingly).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lighthouse_residents',
    'lighthouse_supporters',
    'lighthouse_donations',
    'lighthouse_donation_allocations',
    'lighthouse_safehouses',
    'lighthouse_process_recordings',
    'lighthouse_home_visitations',
    'lighthouse_intervention_plans',
    'lighthouse_education_records',
    'lighthouse_health_wellbeing_records',
    'lighthouse_safehouse_monthly_metrics'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS lighthouse_staff_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY lighthouse_staff_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Public impact aggregates (no PII) — callable by anonymous site visitors.
CREATE OR REPLACE FUNCTION public.get_public_impact_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  utc_now timestamptz := timezone('utc', now());
  lm_start date := (date_trunc('month', utc_now) - interval '1 month')::date;
  lm_end date := (date_trunc('month', utc_now))::date;
BEGIN
  RETURN json_build_object(
    'activeResidents',
    (SELECT COUNT(*)::int FROM lighthouse_residents WHERE lower(data->>'case_status') = 'active'),
    'safehouseCount',
    (SELECT COUNT(*)::int FROM lighthouse_safehouses WHERE lower(data->>'status') = 'active'),
    'avgEducationProgressPercent',
    COALESCE(
      (
        SELECT ROUND(AVG(NULLIF(trim(data->>'progress_percent'), '')::numeric), 2)
        FROM lighthouse_education_records
        WHERE (data->>'progress_percent') ~ '^[0-9]+\.?[0-9]*$'
      ),
      0
    ),
    'avgHealthScore',
    COALESCE(
      (
        SELECT ROUND(AVG(NULLIF(trim(data->>'general_health_score'), '')::numeric), 2)
        FROM lighthouse_health_wellbeing_records
        WHERE (data->>'general_health_score') ~ '^[0-9]+\.?[0-9]*$'
      ),
      0
    ),
    'donationsLastMonthPhp',
    COALESCE(
      (
        SELECT SUM(NULLIF(trim(d.data->>'amount'), '')::numeric)
        FROM lighthouse_donations d
        WHERE lower(d.data->>'donation_type') = 'monetary'
          AND d.data->>'donation_date' IS NOT NULL
          AND d.data->>'donation_date' <> ''
          AND to_date(left(trim(d.data->>'donation_date'), 10), 'YYYY-MM-DD') >= lm_start
          AND to_date(left(trim(d.data->>'donation_date'), 10), 'YYYY-MM-DD') < lm_end
      ),
      0
    ),
    'supporterCount',
    (SELECT COUNT(*)::int FROM lighthouse_supporters),
    'reintegrationSuccessRatePercent',
    (
      WITH r AS (
        SELECT data->>'reintegration_status' AS rs FROM lighthouse_residents
      ),
      c AS (SELECT COUNT(*)::numeric AS n FROM r WHERE lower(rs) = 'completed'),
      d AS (SELECT GREATEST(COUNT(*)::numeric, 1) AS n FROM r WHERE rs IS NOT NULL AND trim(rs) <> '')
      SELECT ROUND(100.0 * (SELECT n FROM c) / (SELECT n FROM d), 1)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_impact_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_impact_summary() TO anon, authenticated;
