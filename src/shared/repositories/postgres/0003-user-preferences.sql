CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Email notification preferences
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  email_payment_alerts BOOLEAN DEFAULT TRUE,
  email_system_notifications BOOLEAN DEFAULT TRUE,

  -- Push notification preferences
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  push_payment_alerts BOOLEAN DEFAULT TRUE,
  push_system_notifications BOOLEAN DEFAULT TRUE,

  -- SMS notification preferences
  sms_notifications_enabled BOOLEAN DEFAULT FALSE,
  sms_payment_alerts BOOLEAN DEFAULT FALSE,
  sms_system_notifications BOOLEAN DEFAULT FALSE,

  -- Display preferences
  theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'id')),
  currency VARCHAR(10) DEFAULT 'USD' CHECK (currency IN ('USD', 'IDR', 'EUR', 'BTC', 'ETH')),
  timezone VARCHAR(50),
  date_format VARCHAR(20),
  number_format VARCHAR(20),

  -- Privacy preferences
  profile_visibility VARCHAR(10) DEFAULT 'private' CHECK (profile_visibility IN ('public', 'private')),
  analytics_enabled BOOLEAN DEFAULT TRUE,
  third_party_integrations_enabled BOOLEAN DEFAULT FALSE,
  market_research_enabled BOOLEAN DEFAULT FALSE,
  activity_tracking_enabled BOOLEAN DEFAULT FALSE,

  created_date TIMESTAMP DEFAULT NOW(),
  updated_date TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);