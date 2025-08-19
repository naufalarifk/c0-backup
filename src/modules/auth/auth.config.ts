import type { BetterAuthOptions } from 'better-auth';
import type { DrizzleDB } from '../../shared/database';

import { expo } from '@better-auth/expo';
import { sso } from '@better-auth/sso';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Auth, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  admin,
  bearer,
  multiSession,
  oneTap,
  openAPI,
  phoneNumber,
  twoFactor,
  username,
} from 'better-auth/plugins';
import invariant from 'tiny-invariant';
import { v7 as uuidv7 } from 'uuid';

import { verificationEmail } from '../../lib';
import { DRIZZLE_DB } from '../../shared/database/database.module';
import { ConfigService } from '../../shared/services/config.service';
import { EmailService } from '../../shared/services/email.service';
import { TwilioService } from '../../shared/services/twilio.service';

@Injectable()
export class AuthConfig {
  private readonly logger = new Logger(AuthConfig.name);
  private readonly reservedUsernames = [
    'admin',
    'administrator',
    'root',
    'system',
    'support',
    'help',
    'api',
    'www',
    'mail',
    'email',
    'info',
    'contact',
    'about',
    'blog',
    'news',
    'user',
    'users',
    'account',
    'profile',
    'settings',
    'config',
    'test',
    'demo',
    'null',
    'undefined',
    'me',
    'app',
    'mobile',
    'web',
    'site',
    'page',
    'home',
  ] as const;

  constructor(
    @Inject(DRIZZLE_DB) private readonly database: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly twilioService: TwilioService,
  ) {}

  /**
   * Creates and returns the Better Auth configuration
   * This method is called by the AuthModule to initialize Better Auth
   */
  createAuthOptions() {
    const options: BetterAuthOptions = {
      appName: 'Gadain Better Auth',
      database: this.createDatabaseAdapter(),
      emailVerification: this.createEmailVerificationConfig(),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      socialProviders: this.createSocialProvidersConfig(),
      plugins: this.createPlugins(),
      account: {
        accountLinking: {
          trustedProviders: ['google'],
        },
      },
      trustedOrigins: ['gadainclient://'],
      rateLimit: {
        enabled: true,
        ...this.configService.throttlerConfigs,
      },
      onAPIError: {
        throw: true,
      },
      advanced: this.createAdvancedConfig(),
    };

    const auth = betterAuth(options);

    return {
      auth: auth as unknown as Auth,
    };
  }

  private createDatabaseAdapter() {
    return drizzleAdapter(this.database, {
      provider: 'pg',
      usePlural: true,
      debugLogs: this.configService.databaseLogger,
    });
  }

  private createEmailVerificationConfig() {
    return {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
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

        invariant(!res.error, 'Failed to send verification email');
        this.logger.debug('Email sent successfully:', res.data?.id);
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

  private createPlugins() {
    return [
      bearer(),
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
      multiSession({ maximumSessions: 3 }),
      admin(),
      expo(),
      openAPI(),
    ];
  }

  private createAdvancedConfig() {
    return {
      cookiePrefix: 'gadain',
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
    return !this.reservedUsernames.includes(
      username.toLowerCase() as (typeof this.reservedUsernames)[number],
    );
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }
}
