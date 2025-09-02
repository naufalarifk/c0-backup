import type { BetterAuthOptions } from 'better-auth';
import type { DrizzleDB } from '../../shared/database/database.module';
import type { AuthModuleOptions } from './auth.module';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { expo } from '@better-auth/expo';
import { sso } from '@better-auth/sso';
import { Auth, betterAuth } from 'better-auth';
import { admin, multiSession, openAPI, phoneNumber, twoFactor } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';

import { DRIZZLE_DB } from '../../shared/database/database.module';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { EmailService } from '../../shared/services/email.service';
import { MailerService } from '../../shared/services/mailer.service';
import { RedisService } from '../../shared/services/redis.service';
import { TwilioService } from '../../shared/services/twilio.service';
import { authAdapter } from './auth.adapter';
import { RESERVED_USERNAMES } from './auth.constants';
import { verificationEmail } from './template/verification-email';

@Injectable()
export class AuthConfig {
  private readonly logger = new Logger(AuthConfig.name);

  constructor(
    @Inject(DRIZZLE_DB) readonly _database: DrizzleDB,
    private readonly configService: AppConfigService,
    readonly _emailService: EmailService,
    private readonly mailerService: MailerService,
    private readonly twilioService: TwilioService,
    private readonly redisService: RedisService,
    private readonly userRepository: CryptogadaiRepository,
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
        'crypto-gadai://', // Production scheme from app.json
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
    return authAdapter({
      userRepo: this.userRepository,
      debugLogs: this.configService.databaseLogger,
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
          companyName: this.configService.appConfig.appName,
        });

        const emailConfirmTitle = 'Verify your email address';

        await this.mailerService.sendMail({
          to: user.email,
          subject: emailConfirmTitle,
          html,
        });

        // const res = await this.emailService.sendEmail({
        //   to: user.email,
        //   subject: emailConfirmTitle,
        //   html,
        // });

        // if (res.error) {
        //   this.logger.error('Failed to send verification email :>> ', res.error);
        // }
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
      // username({
      //   usernameValidator: this.validateUsername.bind(this),
      //   usernameNormalization: this.normalizeUsername.bind(this),
      // }),
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

  // private validateUsername(username: string): boolean {
  //   return !RESERVED_USERNAMES.includes(username.toLowerCase());
  // }

  // private normalizeUsername(username: string): string {
  //   return username.trim().toLowerCase();
  // }
}
