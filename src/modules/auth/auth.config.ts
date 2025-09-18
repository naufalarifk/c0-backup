import type { BetterAuthOptions } from 'better-auth';
import type { AuthModuleOptions } from './auth.module';

import { Injectable } from '@nestjs/common';

import { expo } from '@better-auth/expo';
import { sso } from '@better-auth/sso';
import { Auth, betterAuth } from 'better-auth';
import {
  admin,
  customSession,
  multiSession,
  openAPI,
  phoneNumber,
  twoFactor,
} from 'better-auth/plugins';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { MailerService } from '../../shared/services/mailer.service';
import { MinioService } from '../../shared/services/minio.service';
import { RedisService } from '../../shared/services/redis.service';
import { TwilioService } from '../../shared/services/twilio.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { EmailVerificationNotificationData } from '../notifications/composers/email-verification-notification.composer';
import { EmailPasswordResetNotificationData } from '../notifications/composers/password-reset-notification.composer';
import { UserRegisteredNotificationData } from '../notifications/composers/user-registered-notification.composer';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { authAdapter } from './auth.adapter';

@Injectable()
export class AuthConfig {
  private readonly logger = new TelemetryLogger(AuthConfig.name);

  constructor(
    private readonly configService: AppConfigService,
    private readonly mailerService: MailerService,
    private readonly twilioService: TwilioService,
    private readonly redisService: RedisService,
    private readonly repo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly notificationQueueService: NotificationQueueService,
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
      rateLimit: this.rateLimit(),
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
      userRepo: this.repo,
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
        const notificationData: EmailVerificationNotificationData = {
          type: 'EmailVerification',
          name: 'Verify your email address',
          email: user.email,
          url,
        };

        await this.notificationQueueService.queueNotification(notificationData);
      },
      onEmailVerification: async ({ id, email, name }) => {
        const notificationData: UserRegisteredNotificationData = {
          type: 'UserRegistered',
          userId: id,
          email,
          name,
        };

        await this.notificationQueueService.queueNotification(notificationData);
      },
    };
  }

  private emailAndPassword(): BetterAuthOptions['emailAndPassword'] {
    return {
      enabled: true,
      autoSignIn: true,
      sendResetPassword: async ({ user, url, token }) => {
        const isDev = this.configService.isDevelopment;
        const parsed = new URL(url);

        const callbackURL = parsed.searchParams.get('callbackURL');

        const deepLink = isDev
          ? `${this.configService.appConfig.expoUrl}${callbackURL}?token=${token}`
          : `${this.configService.appConfig.scheme}${callbackURL}?token=${token}`;

        const notificationData: EmailPasswordResetNotificationData = {
          type: 'PasswordResetRequested',
          email: user.email,
          url,
          deepLink,
        };

        await this.notificationQueueService.queueNotification(notificationData);
      },
      onPasswordReset: async ({ user }) => {
        console.log('user :>> ', user);
        // const notificationData: SMSPasswordResetCompletedNotificationData = {
        //   type: 'PasswordResetCompleted',
        //   phoneNumber: user.phoneNumber,
        // };

        // await this.notificationQueueService.queueNotification(notificationData);
      },
    };
  }

  private plugins(): BetterAuthOptions['plugins'] {
    return [
      twoFactor({
        issuer: this.configService.appConfig.name,
      }),
      phoneNumber({
        sendOTP: async ({ phoneNumber, code }) => {
          const res = await this.twilioService.sendSMS({
            to: phoneNumber,
            body: `Your verification code is: ${code}`,
          });
          console.log('res :>> ', res);
        },
        signUpOnVerification: {
          getTempEmail: (phoneNumber: string) => `${phoneNumber.replace('+', '')}@temp.app`,
          getTempName: (phoneNumber: string) => `User-${phoneNumber.slice(-4)}`,
        },
      }),
      sso(),
      multiSession({ maximumSessions: this.configService.authConfig.maximumSessions }),
      customSession(async ({ session, user }) => {
        const rows = await this.repo
          .sql`SELECT profile_picture, email_verified_date, two_factor_enabled_date, user_type FROM users WHERE id = ${user.id} LIMIT 1`;

        // biome-ignore lint/suspicious/noExplicitAny: Enable explicit any for database result
        const data = rows.length ? (rows[0] as any) : null;

        let profilePictureUrl = data?.profile_picture;

        // If profile_picture exists and doesn't start with http/https, get from MinIO
        if (profilePictureUrl && !/^https?:\/\//.test(profilePictureUrl)) {
          try {
            // Parse bucket:objectPath format
            const [bucket, objectPath] = profilePictureUrl.split(':');
            if (bucket && objectPath) {
              // SECURITY: Basic validation - ensure path is not manipulated
              if (objectPath.includes('../') || objectPath.includes('..\\')) {
                this.logger.warn(`Path traversal attempt detected: ${objectPath}`);
                profilePictureUrl = null;
              } else {
                // Generate presigned URL with short expiry
                profilePictureUrl = await this.minioService.getFileUrl(bucket, objectPath, 900);
              }
            }
          } catch (error) {
            this.logger.error('Failed to get profile picture from MinIO:', error);
            profilePictureUrl = null;
          }
        }

        return {
          session,
          user: {
            ...user,
            role: data.role || 'User',
            userType: data.user_type || 'Undecided',
            twoFactorEnabled: !!data.two_factor_enabled_date,
            image: profilePictureUrl,
          },
        };
      }),
      admin(),
      expo(),
      openAPI(),
    ];
  }

  private rateLimit(): BetterAuthOptions['rateLimit'] {
    return {
      enabled: true,
      window: +this.configService.rateLimitConfigs.ttl,
      max: +this.configService.rateLimitConfigs.limit,
      customRules: {
        '/sign-in/*': {
          window: 60,
          max: 5,
        },
        '/forget-password': {
          window: 3600,
          max: 3,
        },
      },
    };
  }

  private advanced(): BetterAuthOptions['advanced'] {
    return {
      cookiePrefix: this.configService.authConfig.cookiePrefix,
      useSecureCookies: this.configService.isProduction,
      disableCSRFCheck: false,
      crossSubDomainCookies: {
        enabled: !this.configService.isProduction,
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: this.configService.isProduction ? 'Strict' : 'None',
      },
    };
  }
}
