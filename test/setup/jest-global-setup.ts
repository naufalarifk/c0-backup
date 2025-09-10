import { TestContainerSetup } from './test-containers';

export default async function globalSetup() {
  // Set required environment variables for e2e tests
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.APP_NAME = 'TestGadain';
  process.env.ALLOWED_ORIGINS = 'http://localhost:3001,http://localhost:3000';
  process.env.ENABLE_DOCUMENTATION = 'false';
  process.env.API_VERSION = 'v1.0.0';
  process.env.THROTTLER_TTL = '1m';
  process.env.THROTTLER_LIMIT = '1000';
  process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-e2e-tests';
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  process.env.BETTER_AUTH_COOKIE_PREFIX = 'test';
  process.env.BETTER_AUTH_MAXIMUM_SESSIONS = '5';
  process.env.BETTER_AUTH_TELEMETRY = '0';
  process.env.BETTER_AUTH_EXPIRATION_TIME = '3600';
  process.env.SESSION_MAX_AGE = '604800';
  process.env.SESSION_UPDATE_AGE = '86400';
  process.env.SESSION_COOKIE_CACHE_AGE = '300';
  process.env.EMAIL_FROM = 'test@cryptogadai.com';
  process.env.EMAIL_VERIFICATION_GRACE_PERIOD = '24h';
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.FCM_ENABLED = 'false';
  process.env.APNS_ENABLED = 'false';

  // Twilio configuration for SMS/WhatsApp (using valid format)
  process.env.TWILIO_ACCOUNT_SID = 'ACabcdefabcdefabcdefabcdefabcdef01';
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_32_chars_long_123456';
  process.env.TWILIO_VERIFY_SID = 'VAabcdefabcdefabcdefabcdefabcdef02';
  process.env.TWILIO_PHONE_NUMBER = '+15551234567';
  process.env.TWILIO_DEFAULT_WHATSAPP_FROM = 'whatsapp:+15551234567';

  // Google OAuth configuration
  process.env.GOOGLE_CLIENT_ID =
    '123456789-abcdefghijklmnopqrstuvwxyz0123456.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'GOCSPX-test_google_client_secret_value';

  await TestContainerSetup.startContainers();

  // Set mail configuration after containers are started
  const mailConfig = TestContainerSetup.getMailConfig();
  process.env.MAIL_HOST = mailConfig.host;
  process.env.MAIL_SMTP_PORT = String(mailConfig.smtpPort);
  process.env.MAIL_HTTP_PORT = String(mailConfig.httpPort);
  process.env.MAIL_USER = '';
  process.env.MAIL_PASSWORD = '';
  process.env.MAIL_IGNORE_TLS = 'true';
  process.env.MAIL_SECURE = 'false';
  process.env.MAIL_REQUIRE_TLS = 'false';
  process.env.MAIL_DEFAULT_EMAIL = 'test@example.com';
  process.env.MAIL_DEFAULT_NAME = 'Test API';
}
