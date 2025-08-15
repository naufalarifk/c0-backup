import type { ThrottlerOptions } from '@nestjs/throttler';

import { Injectable } from '@nestjs/common';
import { ConfigService as _ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import parse from 'parse-duration';
import { Pool } from 'pg';
import invariant from 'tiny-invariant';

import * as schema from '../../database/schema';

@Injectable()
export class ConfigService {
  constructor(private configService: _ConfigService) {}

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  private getNumber(key: string): number {
    const value = this.get(key);
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

  get databaseUrl() {
    return this.getString('DATABASE_URL');
  }

  get drizzleConfig() {
    const pool = new Pool({ connectionString: this.databaseUrl });

    return drizzle(pool, { logger: true, schema, casing: 'snake_case' });
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

  get redisConfig() {
    return {
      host: this.getString('REDIS_HOST', 'localhost'),
      port: this.getNumber('REDIS_PORT'),
      password: this.getString('REDIS_PASSWORD', ''),
    };
  }

  get authConfig() {
    return {
      betterAuthUrl: this.getString('BETTER_AUTH_URL'),
      betterAuthExpirationTime: this.getNumber('BETTER_AUTH_EXPIRATION_TIME'),
    };
  }

  get appConfig() {
    return {
      port: this.getString('PORT'),
      allowedOrigins: this.getString('ALLOWED_ORIGINS').split(','),
    };
  }

  private get(key: string): string {
    const value = this.configService.get<string>(key);

    invariant(value != null, `Environment variable ${key} is not set`);

    return value;
  }
}
