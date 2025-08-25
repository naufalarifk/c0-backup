import type { BetterAuthOptions } from 'better-auth';
import type { DrizzleDB } from '../../shared/database/database.module';
import type { AuthModuleOptions } from './auth.module';

import { expo } from '@better-auth/expo';
import { sso } from '@better-auth/sso';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Auth, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  admin,
  multiSession,
  oneTap,
  openAPI,
  phoneNumber,
  twoFactor,
  username,
} from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';

import { verificationEmail } from '../../lib';
import { DRIZZLE_DB } from '../../shared/database/database.module';
import * as schema from '../../shared/database/schema';
import { ConfigService } from '../../shared/services/config.service';
import { EmailService } from '../../shared/services/email.service';
import { RedisService } from '../../shared/services/redis.service';
import { TwilioService } from '../../shared/services/twilio.service';
import { RESERVED_USERNAMES } from './auth.constants';

@Injectable()
export class AuthConfig {
  private readonly logger = new Logger(AuthConfig.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly database: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly twilioService: TwilioService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Creates and returns the Better Auth configuration
   * This method is called by the AuthModule to initialize Better Auth
   */
  createAuthOptions(): { auth: Auth; options?: AuthModuleOptions } {
    const options: BetterAuthOptions = {
      database: this.createDatabaseAdapter(),
      session: this.createSessionConfig(),
      secondaryStorage: this.createSecondaryStorage(),
      emailVerification: this.createEmailVerificationConfig(),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: this.configService.isProduction,
      },
      socialProviders: this.createSocialProvidersConfig(),
      plugins: this.createPlugins(),
      user: {
        changeEmail: {
          enabled: true,
        },
        deleteUser: {
          enabled: true,
        },
      },
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ['google'],
        },
      },
      trustedOrigins: [
        'exp://192.168.0.109:8081', // Development
        'gadainclient://', // Production scheme from app.json
        // Add your production URL
      ],
      rateLimit: {
        enabled: true,
        ...this.configService.throttlerConfigs,
      },
      onAPIError: {
        throw: true,
      },
      advanced: this.createAdvancedConfig(),
    };

    return {
      auth: betterAuth(options) as unknown as Auth,
    };
  }

  private createDatabaseAdapter() {
    return drizzleAdapter(this.database, {
      provider: 'pg',
      usePlural: true,
      debugLogs: this.configService.databaseLogger,
      schema,
    });
  }

  private createSessionConfig(): BetterAuthOptions['session'] {
    const authConfig = this.configService.authConfig;

    return {
      expiresIn: authConfig.sessionMaxAge, // 7 days by default
      updateAge: authConfig.sessionUpdateAge, // 1 day by default
      cookieCache: {
        enabled: true,
        maxAge: authConfig.sessionCookieCacheAge, // 5 minutes by default
      },
      storeSessionInDatabase: true,
      preserveSessionInDatabase: true,
    };
  }

  private createSecondaryStorage(): BetterAuthOptions['secondaryStorage'] {
    return {
      get: async (key: string) => {
        try {
          const value = await this.redisService.get(key);
          return value ? value : null;
        } catch (error) {
          this.logger.error(`Error getting secondary storage key ${key}:`, error);
          return null;
        }
      },
      set: async (key: string, value: string, ttl?: number) => {
        try {
          if (ttl) {
            await this.redisService.set(key, value, ttl);
          } else {
            await this.redisService.set(key, value);
          }
        } catch (error) {
          this.logger.error(`Error setting secondary storage key ${key}:`, error);
        }
      },
      delete: async (key: string) => {
        try {
          await this.redisService.del(key);
        } catch (error) {
          this.logger.error(`Error deleting secondary storage key ${key}:`, error);
        }
      },
    };
  }

  private createEmailVerificationConfig(): BetterAuthOptions['emailVerification'] {
    return {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const html = verificationEmail({
          url,
          userName: user.email,
          companyName: 'Gadain',
        });
        const res = await this.emailService.sendEmail({
          to: user.email,
          subject: 'Verify your email address',
          html,
        });

        if (res.error) {
          this.logger.error('Failed to send verification email :>> ', res.error);
        }
      },
    };
  }

  private createSocialProvidersConfig(): BetterAuthOptions['socialProviders'] {
    return {
      google: {
        prompt: 'select_account consent',
        accessType: 'offline',
        ...this.configService.socialProviderConfig.google,
      },
    };
  }

  private createPlugins(): BetterAuthOptions['plugins'] {
    return [
      twoFactor(),
      username({
        usernameValidator: this.validateUsername.bind(this),
        usernameNormalization: this.normalizeUsername.bind(this),
      }),
      phoneNumber({
        sendOTP: async ({ phoneNumber, code }: { phoneNumber: string; code: string }) => {
          await this.twilioService.sendSMS({
            to: phoneNumber,
            body: `Your verification code is: ${code}`,
          });
        },
        signUpOnVerification: {
          getTempEmail: (phoneNumber: string) => `${phoneNumber.replace('+', '')}@temp.app`,
          getTempName: (phoneNumber: string) => `User-${phoneNumber.slice(-4)}`,
        },
      }),
      oneTap(),
      sso(),
      multiSession({ maximumSessions: this.configService.authConfig.maximumSessions }),
      admin(),
      expo(),
      openAPI(),
    ];
  }

  private createAdvancedConfig(): BetterAuthOptions['advanced'] {
    return {
      cookiePrefix: this.configService.authConfig.cookiePrefix,
      useSecureCookies: true,
      disableCSRFCheck: false,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
      },
      database: {
        generateId: () => uuidv7(),
      },
    };
  }

  private validateUsername(username: string): boolean {
    return !RESERVED_USERNAMES.includes(username.toLowerCase());
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }
}
