-- =============================================================================
-- Run ONCE in Supabase Dashboard → SQL Editor (postgres role; bypasses RLS).
-- Creates app roles, profiles table, and four Auth users (email + password).
--
-- Default password for all four (change in Dashboard → Authentication → Users):
--   HavenDemo2026!
--
-- Emails (use these on the login screen when Supabase Auth is enabled):
--   admin@ebanhaven.demo
--   donor@ebanhaven.demo
--   socialworker@ebanhaven.demo
--   resident@ebanhaven.demo
--
-- If a user already exists with the same email, delete them in the Dashboard
-- first, or comment out that block below.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'donor', 'social_worker', 'resident');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text NOT NULL DEFAULT '',
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
CREATE POLICY "profiles_select_self"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;
CREATE POLICY "profiles_admin_select_all"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.profiles IS 'App profile + role; rows mirror auth.users.';

-- ---------------------------------------------------------------------------
-- Seed auth.users + auth.identities + public.profiles
-- instance_id: prefer your project instance; fall back to all-zero UUID.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  inst uuid;
  pw text := crypt('HavenDemo2026!', gen_salt('bf'));

  uid_admin uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
  uid_donor uuid := 'a0000002-0000-4000-8000-000000000001'::uuid;
  uid_sw uuid := 'a0000003-0000-4000-8000-000000000001'::uuid;
  uid_res uuid := 'a0000004-0000-4000-8000-000000000001'::uuid;
BEGIN
  SELECT COALESCE(
    (SELECT id FROM auth.instances LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO inst;

  -- Admin
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_admin OR email = 'admin@ebanhaven.demo') THEN
    -- GoTrue cannot scan NULL into string fields; omitting these causes "Database error querying schema".
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      "role",
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      inst,
      uid_admin,
      'authenticated',
      'authenticated',
      'admin@ebanhaven.demo',
      pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Admin"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- provider_id MUST be the auth user id (UUID text), not the email — otherwise signInWithPassword fails.
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      uid_admin,
      uid_admin::text,
      jsonb_build_object('sub', uid_admin::text, 'email', 'admin@ebanhaven.demo'),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  -- Donor
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_donor OR email = 'donor@ebanhaven.demo') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, "role", email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      inst, uid_donor, 'authenticated', 'authenticated', 'donor@ebanhaven.demo', pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Donor"}'::jsonb,
      now(), now(),
      '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), uid_donor, uid_donor::text,
      jsonb_build_object('sub', uid_donor::text, 'email', 'donor@ebanhaven.demo'),
      'email', now(), now(), now()
    );
  END IF;

  -- Social worker
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_sw OR email = 'socialworker@ebanhaven.demo') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, "role", email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      inst, uid_sw, 'authenticated', 'authenticated', 'socialworker@ebanhaven.demo', pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Social Worker"}'::jsonb,
      now(), now(),
      '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), uid_sw, uid_sw::text,
      jsonb_build_object('sub', uid_sw::text, 'email', 'socialworker@ebanhaven.demo'),
      'email', now(), now(), now()
    );
  END IF;

  -- Resident (portal-style account; adjust app rules as needed)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid_res OR email = 'resident@ebanhaven.demo') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, "role", email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      inst, uid_res, 'authenticated', 'authenticated', 'resident@ebanhaven.demo', pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Resident"}'::jsonb,
      now(), now(),
      '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), uid_res, uid_res::text,
      jsonb_build_object('sub', uid_res::text, 'email', 'resident@ebanhaven.demo'),
      'email', now(), now(), now()
    );
  END IF;
END $$;

INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  x.role::public.app_role
FROM auth.users u
JOIN (VALUES
  ('admin@ebanhaven.demo', 'admin'),
  ('donor@ebanhaven.demo', 'donor'),
  ('socialworker@ebanhaven.demo', 'social_worker'),
  ('resident@ebanhaven.demo', 'resident')
) AS x(email, role) ON lower(u.email) = lower(x.email)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  updated_at = now();
