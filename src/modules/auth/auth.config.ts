import type { BetterAuthOptions } from 'better-auth';
import type { AuthConfigProvider, ExtendedAuth, UserSession } from './types';

import { Injectable } from '@nestjs/common';

import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
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
import { MinioService } from '../../shared/services/minio.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { EmailVerificationNotificationData } from '../notifications/composers/email-verification-notification.composer';
import { EmailPasswordResetNotificationData } from '../notifications/composers/password-reset-notification.composer';
import { PhoneNumberVerificationNotificationData } from '../notifications/composers/phone-number-verification-notification.composer';
import { UserRegisteredNotificationData } from '../notifications/composers/user-registered-notification.composer';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { authAdapter } from './auth.adapter';

@Injectable()
export class AuthConfig implements AuthConfigProvider {
  private readonly logger = new TelemetryLogger(AuthConfig.name);

  constructor(
    private readonly configService: AppConfigService,
    private readonly repo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  /**
   * Creates and returns the Better Auth configuration
   * This method is called by the AuthModule to initialize Better Auth
   */
  createAuthConfig() {
    const options: BetterAuthOptions = {
      database: this.database(),
      session: this.session(),
      secondaryStorage: undefined, // session storage already handled by database adapter
      emailVerification: this.emailVerification(),
      emailAndPassword: this.emailAndPassword(),
      socialProviders: this.configService.socialProviderConfigs,
      plugins: this.plugins(),
      user: {
        additionalFields: {
          role: {
            type: 'string',
            defaultValue: 'User',
          },
          userType: {
            type: 'string',
            defaultValue: 'Undecided',
          },
          kycStatus: {
            type: 'string',
            defaultValue: 'none',
          },
          institutionUserId: {
            type: 'string',
            defaultValue: null,
          },
          institutionRole: {
            type: 'string',
            defaultValue: null,
          },
          businessName: {
            type: 'string',
            defaultValue: null,
          },
          businessType: {
            type: 'string',
            defaultValue: null,
          },
        },
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
      auth: betterAuth(options) as unknown as ExtendedAuth,
      disableExceptionFilter: false,
      disableGlobalAuthGuard: false,
      disableTrustedOriginsCors: false,
      disableBodyParser: false,
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

  private emailVerification(): BetterAuthOptions['emailVerification'] {
    return {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const notificationData: EmailVerificationNotificationData = {
          type: 'EmailVerificationSent',
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
          console.log('CODE: ', code);
          const payload: PhoneNumberVerificationNotificationData = {
            type: 'PhoneNumberVerification',
            phoneNumber,
            code,
          };

          this.notificationQueueService.queueNotification(payload);
        },
      }),
      admin(),
      multiSession({ maximumSessions: this.configService.authConfig.maximumSessions }),
      customSession(async ({ session, user }: UserSession) => {
        // Process image URL if it's a MinIO path
        let image = user.image;

        if (image && !/^https?:\/\//.test(image)) {
          const [bucket, objectPath] = image.split(':');
          if (bucket && objectPath && !objectPath.includes('../')) {
            // If getFileUrl errors, user.image still uses the original value.
            image = await this.minioService.getFileUrl(bucket, objectPath, 900).catch(err => {
              this.logger.error('Failed to get profile picture from MinIO:', err);
              return image; // return original value
            });
          }
        }

        return {
          session,
          user: {
            ...user,
            image,
          },
        };
      }),
      expo(),
      openAPI(),
    ];
  }

  private rateLimit(): BetterAuthOptions['rateLimit'] {
    return {
      enabled: this.configService.isProduction,
      window: +this.configService.rateLimitConfigs.ttl,
      max: +this.configService.rateLimitConfigs.limit,
      customRules: this.configService.isProduction
        ? {
            '/sign-in/*': {
              window: 60,
              max: 5,
            },
            '/forget-password': {
              window: 3600,
              max: 3,
            },
          }
        : {},
    };
  }

  private advanced(): BetterAuthOptions['advanced'] {
    const sameSite = this.configService.isProduction ? 'strict' : 'none';

    return {
      cookiePrefix: this.configService.authConfig.cookiePrefix,
      // When sameSite is 'none', secure must be true for browser compatibility
      useSecureCookies: sameSite === 'none' ? true : this.configService.isProduction,
      disableCSRFCheck: false,
      crossSubDomainCookies: {
        enabled: !this.configService.isProduction,
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite,
      },
    };
  }
}
