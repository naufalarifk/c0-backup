-- Push notification tokens table
-- Supports multi-device push notifications with Redis session compatibility
-- References: users table
-- Note: Sessions are stored in Redis, so no FK to sessions table

CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Push token (unique identifier - PRIMARY)
  push_token VARCHAR(255) NOT NULL UNIQUE,

  -- Device information (persistent across sessions)
  device_id VARCHAR(255),                    -- Expo Device.deviceId (persistent)
  device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android')),
  device_name VARCHAR(255),                  -- "iPhone 15 Pro" (from User-Agent)
  device_model VARCHAR(255),                 -- "iPhone15,2" (from Expo Device)

  -- Current session (nullable, references Redis session)
  current_session_id TEXT,                   -- Session ID from Redis (no FK)

  -- Token status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  registered_date TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_date TIMESTAMP NOT NULL DEFAULT NOW(),
  creation_date TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique constraint: One token per device per user
  CONSTRAINT uq_push_tokens_user_device UNIQUE (user_id, device_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_push_token ON push_tokens(push_token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_current_session ON push_tokens(current_session_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_device_id ON push_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_is_active ON push_tokens(is_active) WHERE is_active = true;

-- Trigger function for updated_date (reuse if exists from other migrations)
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic updated_date
DROP TRIGGER IF EXISTS trigger_push_tokens_updated_date ON push_tokens;
CREATE TRIGGER trigger_push_tokens_updated_date
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_date_column();

-- Comments for documentation
COMMENT ON TABLE push_tokens IS 'Stores push notification tokens with persistent device tracking across sessions';
COMMENT ON COLUMN push_tokens.push_token IS 'Expo push token - unique identifier, does not change per device';
COMMENT ON COLUMN push_tokens.device_id IS 'Persistent device ID from Expo Device API';
COMMENT ON COLUMN push_tokens.current_session_id IS 'Current active session from Redis, NULL when logged out';
COMMENT ON COLUMN push_tokens.is_active IS 'Token active status, set to false after 30 days of inactivity';
