-- Drop BetterAuth tables if they exist with wrong schema
DROP TABLE IF EXISTS auth_verifications CASCADE;
DROP TABLE IF EXISTS auth_providers CASCADE;
DROP TABLE IF EXISTS two_factor CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,

  -- Basic user info
  name VARCHAR(160),
  profile_picture TEXT,

  -- Authentication credentials
  email TEXT UNIQUE NOT NULL,
  email_verified_date TIMESTAMP,
  created_date TIMESTAMP DEFAULT NOW(),
  updated_date TIMESTAMP DEFAULT NOW(),
  google_id TEXT UNIQUE,

  -- Two-factor authentication fields (for 2FA plugin)
  two_factor_enabled BOOLEAN DEFAULT FALSE,

  -- Phone number authentication fields (for phone number plugin)
  phone_number TEXT, -- added to support phone number verification
  phone_number_verified BOOLEAN, -- added to support phone number verification

  last_login_date TIMESTAMP,

  -- User profile and role fields (merged from users table)
  role VARCHAR(32) NOT NULL DEFAULT 'User' CHECK (role IN ('System', 'Admin', 'User')),

  -- User type selection (mandatory after registration)
  user_type VARCHAR(32) DEFAULT 'Undecided' CHECK (user_type IN ('Undecided', 'Individual', 'Institution')),
  user_type_selected_date TIMESTAMP,

  -- Institution fields
  institution_user_id BIGINT,
  institution_role VARCHAR(32) CHECK (institution_role IN ('Owner', 'Finance')),

  -- Business fields
  business_name VARCHAR(160),
  business_type VARCHAR(100),

  CHECK (
    email IS NOT NULL
  )
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'locked'));

-- Add self-referencing foreign key for institution hierarchy
-- DROP CONSTRAINT fk_users_institution_user;
-- ALTER TABLE users ADD CONSTRAINT fk_users_institution_user FOREIGN KEY (institution_user_id) REFERENCES users (id);

-- The session is stored in Redis
-- CREATE TABLE IF NOT EXISTS auth_sessions (
--   id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
--   expires_date TIMESTAMP NOT NULL,
--   token TEXT NOT NULL UNIQUE,
--   created_date TIMESTAMP DEFAULT NOW(),
--   updated_date TIMESTAMP DEFAULT NOW(),
--   ip_address TEXT,
--   user_agent TEXT,
--   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
-- );

CREATE TABLE IF NOT EXISTS auth_providers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_date TIMESTAMP,
  refresh_token_expires_date TIMESTAMP,
  scope TEXT,
  password TEXT,
  created_date TIMESTAMP,
  updated_date TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_verifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_date TIMESTAMP NOT NULL,
  created_date TIMESTAMP DEFAULT NOW(),
  updated_date TIMESTAMP DEFAULT NOW()
);

-- Two-factor authentication table for better-auth plugin
CREATE TABLE IF NOT EXISTS two_factor (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  secret TEXT NOT NULL,
  backup_codes TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

-- this assume the users id will be 1. This is important because we use id 1 to indicate the system user
INSERT INTO users (email, role, name, profile_picture)
VALUES ('system@platform', 'System', 'System Platform', '')
ON CONFLICT (email) DO NOTHING;
