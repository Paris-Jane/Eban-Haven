-- =============================================================================
-- Run in Supabase SQL Editor if login shows: "Database error querying schema"
-- after creating users with SQL (seed_auth_profiles.sql).
--
-- Fixes (1) NULL token columns GoTrue cannot scan — see supabase/auth#1940
--         (2) email identities where provider_id was the email instead of user UUID
-- =============================================================================

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, '')
WHERE confirmation_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR recovery_token IS NULL;

UPDATE auth.identities AS i
SET provider_id = i.user_id::text
WHERE i.provider = 'email'
  AND i.provider_id LIKE '%@%';
