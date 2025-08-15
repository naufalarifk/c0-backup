import type { BetterAuthOptions } from 'better-auth';

import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
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
import { passkey } from 'better-auth/plugins/passkey';
import { eq } from 'drizzle-orm';
import parse from 'parse-duration';
import invariant from 'tiny-invariant';
import { v7 as uuidv7 } from 'uuid';

import { db } from './database';
import { users } from './database/schema';
import { sendSMS, sso } from './lib';
import { resend, verificationEmail } from './lib/email';

// Environment validation
const env = {
  enableOrmLogs: process.env.ENABLE_ORM_LOGS,
  betterAuthEmail: process.env.BETTER_AUTH_EMAIL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  throttlerTtl: process.env.THROTTLER_TTL,
  throttlerLimit: process.env.THROTTLER_LIMIT,
  emailVerificationGracePeriod: process.env.EMAIL_VERIFICATION_GRACE_PERIOD || '24h',
} as const;

// Validate all required environment variables
Object.entries(env).forEach(([key, value]) => {
  invariant(value, `Environment variable ${key} must be defined`);
});

const COMPANY_NAME = 'Gadain';
const APP_NAME = 'Gadain Better Auth';
const EMAIL_FROM = `${COMPANY_NAME} <${env.betterAuthEmail}>`;

// Reserved usernames list
const RESERVED_USERNAMES = [
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

// Username validation functions
function usernameValidator(username: string) {
  return !RESERVED_USERNAMES.includes(
    username.toLowerCase() as (typeof RESERVED_USERNAMES)[number],
  );
}

function usernameNormalization(username: string) {
  return username.trim().toLowerCase();
}

const rateLimit = {
  window: parse(env.throttlerTtl, 'second')!,
  max: +env.throttlerLimit!,
};

// Email ownership protection configuration
const EMAIL_OWNERSHIP_CONFIG = {
  // Grace period untuk verifikasi email (configurable via env)
  unverifiedAccountGracePeriod: parse(env.emailVerificationGracePeriod, 'millisecond')!, // parse duration string to milliseconds
} as const;

const options = {
  appName: APP_NAME,
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
    debugLogs: env.enableOrmLogs === 'true',
  }),
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail(data) {
      try {
        const html = verificationEmail({
          url: data.url,
          userName: data.user.email,
          companyName: 'Gadain',
        });

        const res = await resend.emails.send({
          from: EMAIL_FROM,
          to: data.user.email,
          subject: 'Verify your email address',
          html,
        });

        if (res.error) {
          console.error('Email send error:', res.error);
          throw new Error('Failed to send verification email');
        }

        console.log('Email sent successfully:', res.data?.id);
      } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      prompt: 'select_account+consent',
      accessType: 'offline',
      clientId: env.googleClientId!,
      clientSecret: env.googleClientSecret!,
    },
  },
  plugins: [
    bearer(),
    twoFactor(),
    username({
      usernameValidator,
      usernameNormalization,
    }),
    phoneNumber({
      async sendOTP({ phoneNumber, code }) {
        await sendSMS(phoneNumber, `Your verification code is: ${code}`);
      },
      signUpOnVerification: {
        getTempEmail: phoneNumber => `${phoneNumber.replace('+', '')}@temp.app`,
        getTempName: phoneNumber => `User-${phoneNumber.slice(-4)}`,
      },
    }),
    passkey(),
    oneTap(),
    sso(),
    multiSession(),
    admin(),
    expo(),
    openAPI(),
  ],
  account: {
    accountLinking: {
      trustedProviders: ['google'],
    },
  },
  hooks: {
    before: createAuthMiddleware(async ctx => {
      // Email ownership protection untuk sign-up
      if (ctx.path === '/sign-up/email' && ctx.body?.email) {
        const email = ctx.body?.email;

        // Query hanya user yang belum diverifikasi dengan email tersebut
        const existingUnverifiedUser = await db.query.users.findFirst({
          where: eq(users.email, email)
          // Better Auth sudah handle verified users secara default
        });

        // Hanya proses jika ada user yang belum diverifikasi
        if (existingUnverifiedUser && !existingUnverifiedUser.emailVerified) {
          // Cek apakah masih dalam grace period
          const accountCreatedAt = new Date(existingUnverifiedUser.createdAt).getTime();
          const now = Date.now();
          const gracePeriodExpired = (now - accountCreatedAt) > EMAIL_OWNERSHIP_CONFIG.unverifiedAccountGracePeriod;

          if (gracePeriodExpired) {
            // Hapus akun lama yang tidak diverifikasi
            console.log(`Cleaning up expired unverified account for email: ${email} (created: ${existingUnverifiedUser.createdAt})`);

            await db.delete(users).where(eq(users.email, email));

            console.log(`Successfully deleted expired unverified account for: ${email}`);
            // Lanjutkan dengan registrasi normal
          } else {
            // Masih dalam grace period, tolak registrasi baru
            const hoursLeft = Math.ceil((EMAIL_OWNERSHIP_CONFIG.unverifiedAccountGracePeriod - (now - accountCreatedAt)) / (60 * 60 * 1000));
            throw new APIError('CONFLICT', {
              message: `An unverified account with this email exists. Please check your email for verification or try again in ${hoursLeft} hours.`
            });
          }
        }
        // Jika user verified, biarkan Better Auth handle secara default
      }
    }),
  },
  trustedOrigins: ['gadainclient://'],
  rateLimit: {
    enabled: true,
    ...rateLimit,
  },
  onAPIError: {
    throw: true,
  },
  advanced: {
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
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(options);

let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>;
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema());

/**
 * OpenAPI utilities for Better Auth integration
 */
export const OpenAPI = {
  getPaths: (prefix = '/api/auth') =>
    getSchema().then(({ paths }) => {
      const reference = {} as typeof paths;

      for (const path of Object.keys(paths)) {
        const key = prefix + path;
        reference[key] = paths[path];

        for (const method of Object.keys(paths[path])) {
          const operation = reference[key][method];

          operation.tags = ['Auth'];
        }
      }

      return reference;
    }),
  components: getSchema().then(({ components }) => components),
} as const;
