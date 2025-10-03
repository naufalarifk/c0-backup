import type { ThrottlerOptions } from '@nestjs/throttler';
import type { SocialProviders } from 'better-auth/social-providers';
import type { RedisOptions } from 'ioredis';

import { networkInterfaces } from 'node:os';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import parse from 'parse-duration';
import invariant from 'tiny-invariant';

@Injectable()
export class AppConfigService {
  constructor(@Inject(ConfigService) private configService: ConfigService) {}

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  private getNumber(key: string, defaultValue?: number): number {
    const value = this.configService.get<string>(key);

    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new TypeError(`Environment variable ${key} doesn't exist`);
    }

    const num = Number(value);

    if (Number.isNaN(num)) {
      throw new TypeError(`Environment variable ${key} must be a number. Received: ${value}`);
    }

    return num;
  }

  private getDuration(key: string, format?: Parameters<typeof parse>[1]): number {
    const value = this.getString(key);
    const duration = parse(value, format);

    invariant(
      duration !== null,
      `Environment variable ${key} must be a valid duration. Received: ${value}`,
    );

    return duration;
  }

  private getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = this.configService.get<string>(key);

    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} doesn't exist`);
    }

    try {
      return Boolean(JSON.parse(value));
    } catch {
      throw new Error(`Environment variable ${key} must be a boolean. Received: ${value}`);
    }
  }

  private getString(key: string, defaultValue?: string): string {
    const value = this.configService.get<string>(key);

    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      throw new Error(`${key} environment variable doesn't exist`);
    }

    return value.toString().replaceAll(String.raw`\n`, '\n');
  }

  get nodeEnv() {
    return this.getString('NODE_ENV', 'production');
  }

  get emailConfig() {
    return {
      useSmtp: this.getBoolean('USE_SMTP', true),
      apiKey: this.getString('RESEND_API_KEY', 'test_api_key'),
      from: this.getString('EMAIL_FROM', 'test@cryptogadai.com'),
      host: this.getString('MAIL_HOST', 'localhost'),
      port: this.getNumber('MAIL_SMTP_PORT', 1025),
      user: this.getString('MAIL_USER', 'test'),
      pass: this.getString('MAIL_PASSWORD', 'test'),
      ignoreTLS: this.getBoolean('MAIL_IGNORE_TLS', true),
      secure: this.getBoolean('MAIL_SECURE', false),
      requireTLS: this.getBoolean('MAIL_REQUIRE_TLS', false),
      defaultEmail: this.getString('MAIL_DEFAULT_EMAIL', 'test@cryptogadai.com'),
      defaultName: this.getString('MAIL_DEFAULT_NAME', 'CryptoGadai Test'),
      clientPort: this.getNumber('MAIL_HTTP_PORT', 8025),
    };
  }

  get cryptographyConfig() {
    return {
      engine: this.getString('CRYPTOGRAPHY_ENGINE', 'local'),
      localEncryptionKey: this.getString(
        'CRYPTOGRAPHY_LOCAL_ENCRYPTION_KEY',
        'default_local_encryption_key',
      ),
      vaultAddress: this.getString('CRYPTOGRAPHY_VAULT_ADDRESS', 'http://localhost:8200'),
      vaultToken: this.getString('CRYPTOGRAPHY_VAULT_TOKEN', 'root'),
      vaultRoleId: this.getString('CRYPTOGRAPHY_VAULT_ROLE_ID', ''),
      vaultSecretId: this.getString('CRYPTOGRAPHY_VAULT_SECRET_ID', ''),
    };
  }

  get databaseUrl() {
    return this.getString('DATABASE_URL', ':inmemory:');
  }

  get databaseLogger() {
    return this.getBoolean('DATABASE_LOGGER', false);
  }

  get throttlerConfigs(): ThrottlerOptions {
    return {
      ttl: this.getDuration('THROTTLER_TTL', '1m'),
      limit: this.getNumber('THROTTLER_LIMIT', 100000),
    };
  }

  get rateLimitConfigs(): ThrottlerOptions {
    return {
      ttl: this.getDuration('THROTTLER_TTL', '1m'),
      limit: this.getNumber('THROTTLER_LIMIT', 100000),
    };
  }

  get documentationEnabled(): boolean {
    return this.getBoolean('ENABLE_DOCUMENTATION', false);
  }

  get socialProviderConfigs(): SocialProviders {
    return {
      google: {
        prompt: 'select_account consent',
        accessType: 'offline',
        clientId: this.getString('GOOGLE_CLIENT_ID'),
        clientSecret: this.getString('GOOGLE_CLIENT_SECRET'),
      },
    };
  }

  get twilioConfig() {
    // In test environment, provide valid format test credentials
    if (!this.isProduction) {
      return {
        accountSid: this.getString('TWILIO_ACCOUNT_SID', 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
        authToken: this.getString('TWILIO_AUTH_TOKEN', 'test_auth_token'),
        verifySid: this.getString('TWILIO_VERIFY_SID', 'VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
        phoneNumber: this.getString('TWILIO_PHONE_NUMBER', '+1234567890'),
      };
    }

    return {
      accountSid: this.getString('TWILIO_ACCOUNT_SID'),
      authToken: this.getString('TWILIO_AUTH_TOKEN'),
      verifySid: this.getString('TWILIO_VERIFY_SID'),
      phoneNumber: this.getString('TWILIO_PHONE_NUMBER'),
    };
  }

  get notificationConfig() {
    return {
      fcm: {
        projectId: this.getString('FCM_PROJECT_ID', 'test-project'),
        privateKey: this.getString('FCM_PRIVATE_KEY', 'test-key'),
        clientEmail: this.getString('FCM_CLIENT_EMAIL', 'test@test.com'),
        enabled: this.getBoolean('FCM_ENABLED', false),
      },
      apns: {
        keyId: this.getString('APNS_KEY_ID', 'test-key-id'),
        teamId: this.getString('APNS_TEAM_ID', 'test-team-id'),
        privateKey: this.getString('APNS_PRIVATE_KEY', 'test-private-key'),
        bundleId: this.getString('APNS_BUNDLE_ID', 'com.test.app'),
        production: this.getBoolean('APNS_PRODUCTION', false),
        enabled: this.getBoolean('APNS_ENABLED', false),
      },
      expo: {
        accessToken: this.getString('EXPO_ACCESS_TOKEN', ''),
        enabled: this.getBoolean('EXPO_ENABLED', true),
      },
    };
  }

  get realtimeConfig() {
    return {
      tokenTtlSeconds: this.getNumber('REALTIME_TOKEN_TTL_SECONDS', 300),
      handshakeTimeoutMs: this.getNumber('REALTIME_HANDSHAKE_TIMEOUT_MS', 10000),
      maxSubscriptionsPerConnection: this.getNumber('REALTIME_MAX_SUBSCRIPTIONS', 50),
      redisChannel: this.getString('REALTIME_REDIS_CHANNEL', 'realtime:events'),
    } as const;
  }

  get redisConfig(): RedisOptions {
    return {
      host: this.getString('REDIS_HOST', 'localhost'),
      port: this.getNumber('REDIS_PORT'),
      password: this.getString('REDIS_PASSWORD', ''),
      db: this.getNumber('REDIS_DB', 0),
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 10000,
      maxRetriesPerRequest: null, // Required by BullMQ
    };
  }

  get authConfig() {
    const betterAuthDefaultUrl = this.getDefaultAuthUrl();
    const betterAuthUrl = this.getString('BETTER_AUTH_URL', betterAuthDefaultUrl);
    return {
      secret: this.getString('BETTER_AUTH_SECRET', 'your-secret'),
      url: betterAuthUrl === 'local' ? betterAuthDefaultUrl : betterAuthUrl,
      expirationTime: this.getNumber('BETTER_AUTH_EXPIRATION_TIME', 3600),
      cookiePrefix: this.getString('BETTER_AUTH_COOKIE_PREFIX', 'cg'),
      maximumSessions: this.getNumber('BETTER_AUTH_MAXIMUM_SESSIONS', 3),
      sessionMaxAge: this.getNumber('SESSION_MAX_AGE', 604_800), // 7 days
      sessionUpdateAge: this.getNumber('SESSION_UPDATE_AGE', 86_400), // 1 day
      sessionCookieCacheAge: this.getNumber('SESSION_COOKIE_CACHE_AGE', 300), // 5 minutes
    };
  }

  get appConfig() {
    return {
      port: this.getString('PORT', '3000'),
      name: this.getString('APP_NAME', 'Cryptogadai'),
      scheme: this.getString('APP_SCHEME', 'crypto-gadai://'),
      expoUrl: this.getString('APP_EXPO_URL', 'exp://192.168.0.111:8081/--'),
      allowedOrigins: this.getString('ALLOWED_ORIGINS')
        .split(',')
        .map(origin => origin.trim()),
    };
  }

  get minioConfig() {
    return {
      endpoint: this.getString('MINIO_ENDPOINT', 'localhost:9000'),
      accessKey: this.getString('MINIO_ROOT_USER', 'minioadmin'),
      secretKey: this.getString('MINIO_ROOT_PASSWORD', 'minioadmin'),
      useSSL: this.getBoolean('MINIO_USE_SSL', false),
      defaultBuckets: this.getString('MINIO_DEFAULT_BUCKETS', 'uploads,documents,images')
        .split(',')
        .map(bucket => bucket.trim()),
    };
  }

  private get(key: string): string {
    const value = this.configService.get<string>(key);

    invariant(value != null, `Environment variable ${key} is not set`);

    return value;
  }

  private getDefaultAuthUrl(): string {
    const ip = this.getLocalNetworkIP();
    if (typeof ip === 'string') {
      return `http://${ip}:${this.appConfig.port}`;
    }
    return 'http://localhost:3000';
  }

  get walletConfig() {
    return {
      platformMasterMnemonic: this.getString('PLATFORM_MASTER_MNEMONIC', ''),
      platformSeedEncrypted: this.getString('PLATFORM_MASTER_SEED_ENCRYPTED', ''),
      platformSeedEncryptionKey: this.getString('PLATFORM_SEED_ENCRYPTION_KEY', ''),
      enableTestMode: this.getBoolean('WALLET_TEST_MODE', !this.isProduction),
    };
  }

  get invoiceConfig() {
    return {
      epochMs: this.getNumber('INVOICE_ID_EPOCH_MS', Date.UTC(2024, 0, 1)),
      workerId: this.getNumber('INVOICE_ID_WORKER_ID', 0),
    };
  }

  private getLocalNetworkIP(): string | null {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return null;
  }
}
