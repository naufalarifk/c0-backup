import type { BetterAuthOptions } from 'better-auth';
import type { DrizzleDB } from '../../shared/database/database.module';
import type { AuthModuleOptions } from './auth.module';

import { Inject, Injectable } from '@nestjs/common';

import { expo } from '@better-auth/expo';
import { sso } from '@better-auth/sso';
import { Auth, betterAuth } from 'better-auth';
import { admin, multiSession, openAPI, phoneNumber, twoFactor } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';

import { DRIZZLE_DB } from '../../shared/database/database.module';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { MailerService } from '../../shared/services/mailer.service';
import { RedisService } from '../../shared/services/redis.service';
import { TwilioService } from '../../shared/services/twilio.service';
import { TelemetryLogger } from '../../telemetry.logger';
import { authAdapter } from './auth.adapter';
import { forgotPasswordEmail } from './template/forget-password';
import { verificationEmail } from './template/verification-email';

@Injectable()
export class AuthConfig {
  private readonly logger = new TelemetryLogger(AuthConfig.name);

  constructor(
    @Inject(DRIZZLE_DB) readonly _database: DrizzleDB,
    private readonly configService: AppConfigService,
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
      database: this.database(),
      session: this.session(),
      secondaryStorage: this.secondaryStorage(),
      emailVerification: this.emailVerification(),
      emailAndPassword: this.emailAndPassword(),
      socialProviders: this.configService.socialProviderConfigs,
      plugins: this.plugins(),
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
      trustedOrigins: this.configService.appConfig.allowedOrigins,
      rateLimit: {
        enabled: true,
        ...this.configService.throttlerConfigs,
      },
      onAPIError: {
        throw: true,
      },
      advanced: this.advanced(),
    };

    return {
      auth: betterAuth(options) as unknown as Auth,
    };
  }

  private database(): BetterAuthOptions['database'] {
    return authAdapter({
      userRepo: this.userRepository,
      debugLogs: this.configService.databaseLogger,
    });
  }

  private session(): BetterAuthOptions['session'] {
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

  private secondaryStorage(): BetterAuthOptions['secondaryStorage'] {
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

  private emailVerification(): BetterAuthOptions['emailVerification'] {
    return {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const html = verificationEmail({
          url,
          userName: user.email,
          companyName: this.configService.appConfig.name,
        });

        const emailConfirmTitle = 'Verify your email address';

        await this.mailerService.sendMail({
          to: user.email,
          subject: emailConfirmTitle,
          html,
        });

        //   // const res = await this.emailService.sendEmail({
        //   //   to: user.email,
        //   //   subject: emailConfirmTitle,
        //   //   html,
        //   // });

        //   // if (res.error) {
        //   //   this.logger.error('Failed to send verification email :>> ', res.error);
        //   // }
      },
    };
  }

  private emailAndPassword(): BetterAuthOptions['emailAndPassword'] {
    return {
      enabled: true,
      requireEmailVerification: this.configService.isProduction,
      sendResetPassword: async ({ user, url, token }) => {
        const isDev = this.configService.isDevelopment;
        const parsed = new URL(url);

        const callbackURL = parsed.searchParams.get('callbackURL');

        const deepLink = isDev
          ? `${this.configService.appConfig.expoUrl}${callbackURL}?token=${token}`
          : `${this.configService.appConfig.scheme}${callbackURL}?token=${token}`;

        const html = forgotPasswordEmail({
          url,
          userName: user.email,
          companyName: this.configService.appConfig.name,
          deepLink,
        });

        const emailConfirmTitle = 'Reset your password';

        await this.mailerService.sendMail({
          to: user.email,
          subject: emailConfirmTitle,
          html,
        });
      },
    };
  }

  private plugins(): BetterAuthOptions['plugins'] {
    return [
      twoFactor({
        issuer: this.configService.appConfig.name,
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
      sso(),
      multiSession({ maximumSessions: this.configService.authConfig.maximumSessions }),
      admin(),
      expo(),
      openAPI(),
    ];
  }

  private advanced(): BetterAuthOptions['advanced'] {
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
}
