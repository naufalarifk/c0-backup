CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,

  -- Basic user info
  name VARCHAR(160),
  profile_picture TEXT,

  -- Authentication credentials
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  email_verified_date TIMESTAMP,
  created_date TIMESTAMP DEFAULT NOW(),
  updated_date TIMESTAMP DEFAULT NOW(),
  password_hash TEXT,
  google_id TEXT UNIQUE,

  -- Two-factor authentication fields (for 2FA plugin)
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  two_factor_backup_codes TEXT[],

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

  -- Account status management
  access_status VARCHAR(32) DEFAULT 'active' CHECK (access_status IN ('active', 'suspended')),
  suspension_reason TEXT,
  suspension_date TIMESTAMP,
  suspension_admin_user_id BIGINT,
  reactivation_reason TEXT,
  reactivation_date TIMESTAMP,
  reactivation_admin_user_id BIGINT,

  CHECK (
    email IS NOT NULL AND
    (two_factor_enabled = false OR (two_factor_secret IS NOT NULL AND two_factor_backup_codes IS NOT NULL))
  )
);

-- Add self-referencing foreign key for institution hierarchy
-- DROP CONSTRAINT fk_users_institution_user;
-- ALTER TABLE users ADD CONSTRAINT fk_users_institution_user
--   FOREIGN KEY (institution_user_id) REFERENCES users (id);

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

-- this assume the users id will be 1. This is important because we use id 1 to indicate the system user
INSERT INTO users (email, email_verified, two_factor_enabled, two_factor_secret, two_factor_backup_codes, role, name, profile_picture)
VALUES ('system@platform', true, true, 'invalid_secret_is_imposible_to_verify', ARRAY['invalid_code_is_imposible_to_verify'], 'System', 'System Platform', '')
ON CONFLICT (email) DO NOTHING;
