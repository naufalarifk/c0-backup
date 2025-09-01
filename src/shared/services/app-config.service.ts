import type { ThrottlerOptions } from '@nestjs/throttler';
import type { RedisOptions } from 'ioredis';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import parse from 'parse-duration';
import { Pool } from 'pg';
import invariant from 'tiny-invariant';

import * as schema from '../database/schema';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

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

  private getBoolean(key: string): boolean {
    const value = this.get(key);

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
    return this.getString('NODE_ENV');
  }

  get emailConfig() {
    return {
      apiKey: this.getString('RESEND_API_KEY'),
      from: this.getString('EMAIL_FROM'),
      host: this.getString('MAIL_HOST'),
      port: this.getNumber('MAIL_PORT'),
      user: this.getString('MAIL_USER'),
      pass: this.getString('MAIL_PASSWORD'),
      ignoreTLS: this.getBoolean('MAIL_IGNORE_TLS'),
      secure: this.getBoolean('MAIL_SECURE'),
      requireTLS: this.getBoolean('MAIL_REQUIRE_TLS'),
      defaultEmail: this.getString('MAIL_DEFAULT_EMAIL'),
      defaultName: this.getString('MAIL_DEFAULT_NAME'),
      clientPort: this.getNumber('MAIL_CLIENT_PORT'),
    };
  }

  get databaseUrl() {
    return this.getString('DATABASE_URL');
  }

  get databaseLogger() {
    return this.getBoolean('DATABASE_LOGGER');
  }

  get drizzleConfig() {
    const pool = new Pool({ connectionString: this.databaseUrl });

    return drizzle(pool, { logger: this.databaseLogger, schema, casing: 'snake_case' });
  }

  get throttlerConfigs(): ThrottlerOptions {
    return {
      ttl: this.getDuration('THROTTLER_TTL', 'second'),
      limit: this.getNumber('THROTTLER_LIMIT'),
    };
  }

  get documentationEnabled(): boolean {
    return this.getBoolean('ENABLE_DOCUMENTATION');
  }

  get socialProviderConfig() {
    return {
      google: {
        clientId: this.getString('GOOGLE_CLIENT_ID'),
        clientSecret: this.getString('GOOGLE_CLIENT_SECRET'),
      },
    };
  }

  get twilioConfig() {
    return {
      accountSid: this.getString('TWILIO_ACCOUNT_SID'),
      authToken: this.getString('TWILIO_AUTH_TOKEN'),
      verifySid: this.getString('TWILIO_VERIFY_SID'),
      phoneNumber: this.getString('TWILIO_PHONE_NUMBER'),
    };
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
      commandTimeout: 5000,
    };
  }

  get authConfig() {
    return {
      url: this.getString('BETTER_AUTH_URL'),
      expirationTime: this.getNumber('BETTER_AUTH_EXPIRATION_TIME'),
      cookiePrefix: this.getString('BETTER_AUTH_COOKIE_PREFIX'),
      maximumSessions: this.getNumber('BETTER_AUTH_MAXIMUM_SESSIONS'),
      sessionMaxAge: this.getNumber('SESSION_MAX_AGE', 604_800), // 7 days
      sessionUpdateAge: this.getNumber('SESSION_UPDATE_AGE', 86_400), // 1 day
      sessionCookieCacheAge: this.getNumber('SESSION_COOKIE_CACHE_AGE', 300), // 5 minutes
    };
  }

  get appConfig() {
    return {
      port: this.getString('PORT', '3000'),
      appName: this.getString('APP_NAME', 'Gadain'),
      allowedOrigins: this.getString('ALLOWED_ORIGINS').split(','),
    };
  }

  private get(key: string): string {
    const value = this.configService.get<string>(key);

    invariant(value != null, `Environment variable ${key} is not set`);

    return value;
  }
}
