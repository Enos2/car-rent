-- File: backend/migrations/001_create_users.sql
-- Purpose: Creates the "users" table: login details, account type (individual or
--          company), roles (renter, owner and the ranks of staff admins) and
--          verification status.
-- Note: the first two lines remove the test table made by the earlier NestJS
--       version. It only held test data. Never do this in later migrations.

DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS users_account_type_enum, users_roles_enum, users_verification_status_enum;

CREATE TYPE account_type AS ENUM ('individual', 'company');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  account_type account_type NOT NULL DEFAULT 'individual',
  company_name text,
  roles text[] NOT NULL DEFAULT ARRAY['renter']::text[],
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_roles_valid CHECK (
    roles <@ ARRAY['renter', 'owner', 'support_agent', 'verification_officer',
                   'hub_manager', 'finance_admin', 'content_moderator',
                   'super_admin']::text[]
  ),
  CONSTRAINT users_company_name_required CHECK (
    account_type <> 'company' OR company_name IS NOT NULL
  )
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- File: backend/migrations/001_create_users.sql
-- END OF FILE
