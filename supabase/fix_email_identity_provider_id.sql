-- Deprecated: use fix_auth_sql_seed_users.sql (token columns + provider_id).
-- Or run only the UPDATE below if you already fixed NULL tokens.
UPDATE auth.identities AS i
SET provider_id = i.user_id::text
WHERE i.provider = 'email'
  AND i.provider_id LIKE '%@%';
