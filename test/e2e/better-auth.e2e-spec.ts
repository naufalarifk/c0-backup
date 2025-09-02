/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: <explanation> */
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { App } from 'supertest/types';

import { Test } from '@nestjs/testing';

import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/modules/auth/auth.service';
import MailContainer from '../setup/mail-container';
import { TestContainerSetup } from '../setup/test-containers';
import {
  extractPathAfterHost,
  extractVerificationUrl,
  MailpitHelper,
  TestUser,
  TestUserFactory,
} from '../utils';

// Test data factories
const createTestUser = (overrides?: Partial<TestUser>) => TestUserFactory.createUser(overrides);

describe('Better Auth Complete E2E Tests', () => {
  let app: INestApplication<App>;
  let authService: AuthService;
  let moduleFixture: TestingModule;
  let testUser: TestUser;
  let mailContainer: MailContainer;

  // Setup dan cleanup untuk seluruh test suite
  beforeAll(async () => {
    // Ensure containers are started before accessing them
    await TestContainerSetup.ensureContainersStarted();
    mailContainer = new MailContainer();
    await mailContainer.start();

    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.DATABASE_URL = TestContainerSetup.getPostgresConnectionString();
    process.env.DATABASE_LOGGER = 'false';

    process.env.REDIS_HOST = TestContainerSetup.getRedisConfig().host;
    process.env.REDIS_PORT = String(TestContainerSetup.getRedisConfig().port);
    process.env.REDIS_PASSWORD = TestContainerSetup.getRedisConfig().password;

    process.env.MAIL_HOST = mailContainer.getHost();
    process.env.MAIL_SMTP_PORT = String(mailContainer.getSmtpPort());
    process.env.MAIL_HTTP_PORT = String(mailContainer.getHttpPort());

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    authService = moduleFixture.get<AuthService>(AuthService);
    await app.init();
  }, 60_000);

  beforeEach(() => {
    // Reset test state before each test
    testUser = createTestUser();
  });

  afterAll(async () => {
    // Cleanup test data, close connections, etc.
    // await mailContainer.stop();
    await MailpitHelper.clearAllMessages();
  });

  // ============== AUTHENTICATION FLOW TESTS ==============
  describe('User Registration & Email Verification Flow', () => {
    describe('POST /sign-up/email', () => {
      it('should successfully create a new user with valid email and password', async () => {
        const response = await authService.api.signUpEmail({ body: testUser });

        // Validate response structure
        expect(response).toHaveProperty('token');
        expect(response).toHaveProperty('user');

        // Validate user data
        expect(response.user).toHaveProperty('id');
        expect(response.user).toHaveProperty('name', testUser.name);
        expect(response.user).toHaveProperty('email', testUser.email);
        expect(response.user).toHaveProperty('emailVerified', false);
        expect(response.user).not.toHaveProperty('password');
      });

      it('should return validation error for invalid email format', async () => {
        const invalidUser = TestUserFactory.createUserWithInvalidEmail();

        await expect(authService.api.signUpEmail({ body: invalidUser })).rejects.toThrow();
      });

      it('should return error for missing required fields', async () => {
        const userWithoutEmail = TestUserFactory.createUser({
          email: undefined,
          password: undefined,
        });
        await expect(authService.api.signUpEmail({ body: userWithoutEmail })).rejects.toThrow();
      });

      it('should return error for weak password', async () => {
        const weakPasswordUser = TestUserFactory.createUserWithWeakPassword();
        await expect(authService.api.signUpEmail({ body: weakPasswordUser })).rejects.toThrow();
      });

      it('should return error when email already exists', async () => {
        await authService.api.signUpEmail({ body: testUser });
        await expect(authService.api.signUpEmail({ body: testUser })).rejects.toThrow();
      });

      it('should handle optional fields (name, image, callbackURL)', async () => {
        const userWithOptionalFields = TestUserFactory.createUser({
          name: 'Test User',
          image: 'http://example.com/image.png',
          callbackURL: '/profile',
        });
        console.log('userWithOptionalFields :>> ', userWithOptionalFields);
        const response = await authService.api.signUpEmail({ body: userWithOptionalFields });

        // Validate response structure
        expect(response).toHaveProperty('token');
        expect(response).toHaveProperty('user');

        // Validate user data
        expect(response.user).toHaveProperty('id');
        expect(response.user).toHaveProperty('name', userWithOptionalFields.name);
        expect(response.user).toHaveProperty('email', userWithOptionalFields.email);
        expect(response.user).toHaveProperty('emailVerified', false);
        expect(response.user).not.toHaveProperty('password');
        expect(response.user).toHaveProperty('image', userWithOptionalFields.image);
      });

      it('should send verification email after successful signup', async () => {
        // Register user first
        await authService.api.signUpEmail({ body: testUser });
        // Wait for email to arrive
        const emailMeta = await MailpitHelper.waitForEmailForUser(testUser.email);
        expect(emailMeta).toBeDefined();
        expect(emailMeta.Subject).toContain('Verify your email address');
        expect(emailMeta.To[0].Address).toBe(testUser.email);
        // Get email content and extract verification URL
        const emailText = await MailpitHelper.getEmailText(emailMeta.ID);
        const verificationUrl = extractVerificationUrl(emailText);
        expect(verificationUrl).toBeDefined();
        expect(verificationUrl).toContain('/api/auth/verify-email');
        // Test verification endpoint
        const verificationPath = extractPathAfterHost(verificationUrl!);
        expect(verificationPath).toBeDefined();
        const verificationResponse = await request(app.getHttpServer())
          .get(verificationPath!)
          .expect(302);
        expect(verificationResponse.headers.location).toBeDefined();
      });

      it('should handle multiple registration emails correctly', async () => {
        const users = TestUserFactory.createUsers(3);
        // Register multiple users
        for (const user of users) {
          await authService.api.signUpEmail({ body: user });
        }
        // Verify each user got their own email
        for (const user of users) {
          const emailMeta = await MailpitHelper.waitForEmailForUser(user.email);
          expect(emailMeta.To[0].Address).toBe(user.email);
          expect(emailMeta.Subject).toContain('Verify your email address');
        }
      });
    });

    describe('POST /sign-in/email - Email Verification Behavior', () => {
      describe('when email verification is required', () => {
        it('should allow login for verified users', () => {});
        it('should block login for unverified users', () => {});
        it('should return specific error message for unverified email', () => {});
        it('should provide option to resend verification email', () => {});
      });

      describe('when email verification is optional', () => {
        it('should allow login for verified users', () => {});
        it('should allow login for unverified users', () => {});
        it('should include emailVerified status in response', () => {});
      });

      it('should successfully sign in with valid credentials', () => {});
      it('should return error for invalid email', () => {});
      it('should return error for incorrect password', () => {});
      it('should return error for non-existent user', () => {});
      it('should handle rememberMe parameter', () => {});
      it('should handle callbackURL parameter', () => {});
    });

    describe('Email Verification Process', () => {
      describe('POST /send-verification-email', () => {
        it('should send verification email to valid address', () => {});
        it('should return error when verification is disabled', () => {});
        it('should handle callbackURL parameter', () => {});
        it('should return error for invalid email format', () => {});
        it('should handle rate limiting for verification emails', () => {});
      });

      describe('GET /verify-email', () => {
        it('should successfully verify email with valid token', () => {});
        it('should return error for invalid token', () => {});
        it('should return error for expired token', () => {});
        it('should handle callbackURL parameter', () => {});
        it('should update user emailVerified status to true', () => {});
        it('should allow subsequent login after verification', () => {});
      });

      describe('POST /change-email', () => {
        it('should update email immediately when verification disabled', () => {});
        it('should send verification email when verification enabled', () => {});
        it('should return error for invalid new email', () => {});
        it('should return error for email already in use', () => {});
        it('should require re-verification for new email', () => {});
      });
    });
  });

  // ============== SOCIAL AUTHENTICATION TESTS ==============
  describe('Social Authentication Flow', () => {
    describe('POST /sign-in/social', () => {
      it('should successfully sign in with valid social provider', () => {});
      it('should return error for unsupported provider', () => {});
      it('should handle idToken parameter', () => {});
      it('should handle callback URLs', () => {});
      it('should handle scopes parameter', () => {});
      it('should handle new user registration flow', () => {});
      it('should create verified user from social provider', () => {});
      it('should link existing user if email matches', () => {});
    });

    describe('Social Account Management', () => {
      describe('POST /link-social', () => {
        it('should generate authorization URL for linking', () => {});
        it('should return error for unsupported provider', () => {});
        it('should handle idToken parameter', () => {});
        it('should handle callback URLs', () => {});
        it('should return error for unauthenticated request', () => {});
        it('should prevent linking same provider twice', () => {});
      });

      describe('GET /list-accounts', () => {
        it('should return all linked social accounts', () => {});
        it('should return empty array for user with no linked accounts', () => {});
        it('should return error for unauthenticated request', () => {});
        it('should include account creation dates', () => {});
      });

      describe('POST /unlink-account', () => {
        it('should successfully unlink social account', () => {});
        it('should return error for non-existent account', () => {});
        it('should return error when trying to unlink last account', () => {});
        it('should return error for unauthenticated request', () => {});
        it('should require password if no email auth available', () => {});
      });

      describe('Token Management', () => {
        describe('POST /refresh-token', () => {
          it('should refresh access token with valid refresh token', () => {});
          it('should return error for invalid refresh token', () => {});
          it('should return error for expired refresh token', () => {});
          it('should return new token data', () => {});
        });

        describe('POST /get-access-token', () => {
          it('should return valid access token', () => {});
          it('should refresh token automatically if needed', () => {});
          it('should return error for invalid provider', () => {});
          it('should return token data with expiration', () => {});
        });

        describe('POST /account-info', () => {
          it('should return account info from provider', () => {});
          it('should return error for invalid account ID', () => {});
          it('should return error for expired access token', () => {});
          it('should return user data and additional fields', () => {});
        });
      });
    });
  });

  // ============== PASSWORD MANAGEMENT TESTS ==============
  describe('Password Management Flow', () => {
    describe('POST /forget-password', () => {
      it('should send password reset email for valid email', () => {});
      it('should return error for non-existent email', () => {});
      it('should handle redirectTo parameter', () => {});
      it('should return success even for invalid email (security)', () => {});
      it('should rate limit password reset requests', () => {});
    });

    describe('POST /request-password-reset', () => {
      it('should send password reset email for valid email', () => {});
      it('should handle redirectTo parameter', () => {});
      it('should return consistent response for security', () => {});
    });

    describe('GET /reset-password/{token}', () => {
      it('should redirect to callback URL with valid token', () => {});
      it('should return error for invalid token', () => {});
      it('should handle missing callbackURL parameter', () => {});
      it('should return error for expired token', () => {});
    });

    describe('POST /reset-password', () => {
      it('should successfully reset password with valid token', () => {});
      it('should return error for invalid token', () => {});
      it('should return error for expired token', () => {});
      it('should return error for weak new password', () => {});
      it('should invalidate all existing sessions after reset', () => {});
    });

    describe('POST /change-password', () => {
      it('should successfully change password with valid current password', () => {});
      it('should return error for incorrect current password', () => {});
      it('should return error for weak new password', () => {});
      it('should handle revokeOtherSessions parameter', () => {});
      it('should return new token when other sessions are revoked', () => {});
      it('should maintain current session when not revoking others', () => {});
    });
  });

  // ============== TWO-FACTOR AUTHENTICATION TESTS ==============
  describe('Two-Factor Authentication Flow', () => {
    describe('2FA Setup Process', () => {
      describe('POST /two-factor/enable', () => {
        it('should generate TOTP URI and backup codes with valid password', () => {});
        it('should return error for incorrect password', () => {});
        it('should return error when 2FA already enabled', () => {});
        it('should handle custom issuer parameter', () => {});
        it('should require TOTP verification to complete setup', () => {});
      });

      describe('POST /two-factor/get-totp-uri', () => {
        it('should return TOTP URI with valid password', () => {});
        it('should return error for incorrect password', () => {});
        it('should return error when 2FA not set up', () => {});
        it('should return consistent URI format', () => {});
      });
    });

    describe('2FA Login Process', () => {
      describe('POST /two-factor/send-otp', () => {
        it('should send OTP to user when 2FA enabled', () => {});
        it('should return error when 2FA not enabled', () => {});
        it('should return success status', () => {});
        it('should rate limit OTP requests', () => {});
      });

      describe('POST /two-factor/verify-totp', () => {
        it('should verify valid TOTP code', () => {});
        it('should return error for invalid TOTP code', () => {});
        it('should handle trustDevice parameter', () => {});
        it('should return error when 2FA not enabled', () => {});
        it('should allow 30-second time window tolerance', () => {});
      });

      describe('POST /two-factor/verify-otp', () => {
        it('should verify valid OTP code', () => {});
        it('should return error for invalid OTP code', () => {});
        it('should handle trustDevice parameter', () => {});
        it('should return session token and user data', () => {});
        it('should return error for expired OTP', () => {});
      });

      describe('POST /two-factor/verify-backup-code', () => {
        it('should verify valid backup code', () => {});
        it('should return error for invalid backup code', () => {});
        it('should return error for already used backup code', () => {});
        it('should handle trustDevice parameter', () => {});
        it('should handle disableSession parameter', () => {});
        it('should mark backup code as used after verification', () => {});
      });
    });

    describe('2FA Management', () => {
      describe('POST /two-factor/generate-backup-codes', () => {
        it('should generate new backup codes with valid password', () => {});
        it('should return error for incorrect password', () => {});
        it('should return array of backup codes', () => {});
        it('should invalidate old backup codes', () => {});
        it('should generate exactly 10 backup codes', () => {});
      });

      describe('POST /two-factor/disable', () => {
        it('should disable 2FA with valid password', () => {});
        it('should return error for incorrect password', () => {});
        it('should return error when 2FA not enabled', () => {});
        it('should remove all backup codes', () => {});
        it('should update user twoFactorEnabled status', () => {});
      });
    });
  });

  // ============== ALTERNATIVE AUTH METHODS TESTS ==============
  describe('Username Authentication', () => {
    describe('POST /sign-in/username', () => {
      it('should successfully sign in with valid username and password', () => {});
      it('should return error for invalid username', () => {});
      it('should return error for incorrect password', () => {});
      it('should handle rememberMe parameter', () => {});
      it('should handle callbackURL parameter', () => {});
      it('should be case-insensitive for username', () => {});
    });

    describe('POST /is-username-available', () => {
      it('should return true for available username', () => {});
      it('should return false for taken username', () => {});
      it('should return error for invalid username format', () => {});
      it('should handle case sensitivity correctly', () => {});
      it('should check against reserved usernames', () => {});
    });
  });

  describe('Phone Number Authentication', () => {
    describe('Phone Registration & Verification', () => {
      describe('POST /phone-number/send-otp', () => {
        it('should send OTP to valid phone number', () => {});
        it('should return error for invalid phone number format', () => {});
        it('should handle international phone formats', () => {});
        it('should rate limit OTP requests', () => {});
      });

      describe('POST /phone-number/verify', () => {
        it('should verify valid OTP code', () => {});
        it('should return error for invalid OTP code', () => {});
        it('should return error for expired OTP', () => {});
        it('should handle disableSession parameter', () => {});
        it('should handle updatePhoneNumber parameter', () => {});
        it('should create user if not exists', () => {});
        it('should update existing user phone number', () => {});
      });
    });

    describe('Phone Login & Password Reset', () => {
      describe('POST /sign-in/phone-number', () => {
        it('should successfully sign in with valid phone and password', () => {});
        it('should return error for invalid phone number format', () => {});
        it('should return error for incorrect password', () => {});
        it('should handle rememberMe parameter', () => {});
        it('should require verified phone number', () => {});
      });

      describe('POST /phone-number/forget-password', () => {
        it('should send reset OTP to valid phone number', () => {});
        it('should return error for non-existent phone number', () => {});
        it('should return success status', () => {});
        it('should handle rate limiting', () => {});
      });

      describe('POST /phone-number/reset-password', () => {
        it('should reset password with valid OTP', () => {});
        it('should return error for invalid OTP', () => {});
        it('should return error for weak new password', () => {});
        it('should return error for expired OTP', () => {});
        it('should invalidate all existing sessions', () => {});
      });
    });
  });

  // ============== SSO & ENTERPRISE AUTH TESTS ==============
  describe('Single Sign-On (SSO)', () => {
    describe('SSO Provider Management', () => {
      describe('POST /sso/register', () => {
        it('should register OIDC provider with valid configuration', () => {});
        it('should return error for invalid issuer URL', () => {});
        it('should return error for invalid domain', () => {});
        it('should handle SAML configuration', () => {});
        it('should handle field mapping configuration', () => {});
        it('should require admin privileges', () => {});
      });

      describe('GET /sso/saml2/sp/metadata', () => {
        it('should return SAML metadata XML', () => {});
        it('should return error for invalid provider ID', () => {});
        it('should handle different metadata formats', () => {});
        it('should return proper XML content type', () => {});
      });
    });

    describe('SSO Authentication Flow', () => {
      describe('POST /sign-in/sso', () => {
        it('should generate authorization URL for SSO sign-in', () => {});
        it('should return error for invalid email domain', () => {});
        it('should return error for non-existent provider', () => {});
        it('should handle callback URLs', () => {});
        it('should match email domain to provider', () => {});
      });

      describe('GET /sso/callback/{providerId}', () => {
        it('should handle successful authorization callback', () => {});
        it('should return error for invalid authorization code', () => {});
        it('should return error for state mismatch', () => {});
        it('should handle error responses from provider', () => {});
        it('should create user if not exists', () => {});
      });

      describe('POST /sso/saml2/callback/{providerId}', () => {
        it('should handle SAML response successfully', () => {});
        it('should return error for invalid SAML response', () => {});
        it('should return error for unsigned response', () => {});
        it('should handle RelayState parameter', () => {});
        it('should validate SAML assertions', () => {});
      });
    });
  });

  // describe('Google One Tap Authentication', () => {
  //   describe('POST /one-tap/callback', () => {
  //     it('should authenticate with valid Google ID token', () => {});
  //     it('should return error for invalid ID token', () => {});
  //     it('should return error for expired ID token', () => {});
  //     it('should create new user if not exists', () => {});
  //     it('should return session and user data', () => {});
  //     it('should link to existing user by email', () => {});
  //   });
  // });

  // ============== SESSION MANAGEMENT TESTS ==============

  describe('Session Management', () => {
    describe('Session Information', () => {
      describe('GET /get-session', () => {
        it('should return current session for authenticated user', () => {});
        it('should return error for invalid session token', () => {});
        it('should return error for expired session', () => {});
        it('should return user data with session', () => {});
        it('should include session metadata (IP, user agent)', () => {});
      });

      describe('GET /list-sessions', () => {
        it('should return all active sessions for authenticated user', () => {});
        it('should return empty array for user with no sessions', () => {});
        it('should return error for unauthenticated request', () => {});
        it('should include session details and metadata', () => {});
      });
    });

    describe('Session Revocation', () => {
      describe('POST /revoke-session', () => {
        it('should successfully revoke specified session', () => {});
        it('should return error for invalid session token', () => {});
        it('should return error when trying to revoke non-existent session', () => {});
        it('should not allow revoking current session', () => {});
      });

      describe('POST /revoke-sessions', () => {
        it('should successfully revoke all user sessions', () => {});
        it('should return success even if no sessions exist', () => {});
        it('should invalidate current session as well', () => {});
      });

      describe('POST /revoke-other-sessions', () => {
        it('should revoke all sessions except current one', () => {});
        it('should preserve current session', () => {});
        it('should return success when only one session exists', () => {});
        it('should handle multiple device sessions', () => {});
      });
    });

    describe('Multi-Session Management', () => {
      describe('GET /multi-session/list-device-sessions', () => {
        it('should return all device sessions for user', () => {});
        it('should return empty array for user with no sessions', () => {});
        it('should return error for unauthenticated request', () => {});
        it('should group sessions by device', () => {});
      });

      describe('POST /multi-session/set-active', () => {
        it('should set active session with valid token', () => {});
        it('should return error for invalid session token', () => {});
        it('should return error for expired session', () => {});
        it('should return updated session data', () => {});
      });

      describe('POST /multi-session/revoke', () => {
        it('should revoke device session with valid token', () => {});
        it('should return error for invalid session token', () => {});
        it('should return error for already revoked session', () => {});
        it('should return success status', () => {});
      });
    });
  });

  // ============== USER MANAGEMENT TESTS ==============
  describe('User Profile Management', () => {
    describe('POST /update-user', () => {
      it('should successfully update user name', () => {});
      it('should successfully update user image', () => {});
      it('should return error for unauthenticated request', () => {});
      it('should handle partial updates', () => {});
      it('should validate image URL format', () => {});
    });

    describe('POST /delete-user', () => {
      it('should delete user with valid password', () => {});
      it('should send verification email when enabled', () => {});
      it('should return error for incorrect password', () => {});
      it('should handle callbackURL parameter', () => {});
      it('should require password for security', () => {});
    });

    describe('GET /delete-user/callback', () => {
      it('should successfully delete user with valid token', () => {});
      it('should return error for invalid token', () => {});
      it('should handle callbackURL parameter', () => {});
      it('should remove all user data and sessions', () => {});
    });
  });

  // ============== ADMIN FUNCTIONALITY TESTS ==============
  describe('Admin Operations', () => {
    describe('User Management', () => {
      describe('POST /admin/create-user', () => {
        it('should create user with admin privileges', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should handle role assignment', () => {});
        it('should handle custom user data', () => {});
        it('should bypass email verification for admin-created users', () => {});
      });

      describe('POST /admin/update-user', () => {
        it('should update user data with admin privileges', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for non-existent user', () => {});
        it('should handle partial updates', () => {});
        it('should log admin actions for audit', () => {});
      });

      describe('GET /admin/list-users', () => {
        it('should return paginated list of users', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should handle search parameters', () => {});
        it('should handle filtering and sorting', () => {});
        it('should respect pagination limits', () => {});
      });

      describe('POST /admin/remove-user', () => {
        it('should permanently delete user and related data', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for non-existent user', () => {});
        it('should handle cascading deletions', () => {});
        it('should prevent self-deletion', () => {});
      });
    });

    describe('Role & Permission Management', () => {
      describe('POST /admin/set-role', () => {
        it('should set user role with admin privileges', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for invalid role', () => {});
        it('should handle multiple roles', () => {});
        it('should prevent removing admin role from last admin', () => {});
      });

      describe('POST /admin/has-permission', () => {
        it('should check user permissions correctly', () => {});
        it('should return false for insufficient permissions', () => {});
        it('should handle complex permission structures', () => {});
        it('should return error for invalid permission format', () => {});
      });
    });

    describe('User Moderation', () => {
      describe('POST /admin/ban-user', () => {
        it('should ban user with admin privileges', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should handle ban reason and expiration', () => {});
        it('should revoke user sessions', () => {});
        it('should prevent self-banning', () => {});
      });

      describe('POST /admin/unban-user', () => {
        it('should unban user with admin privileges', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for non-banned user', () => {});
        it('should restore user access', () => {});
      });
    });

    describe('Session Administration', () => {
      describe('POST /admin/list-user-sessions', () => {
        it('should list all sessions for specified user', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for non-existent user', () => {});
        it('should include session metadata', () => {});
      });

      describe('POST /admin/revoke-user-session', () => {
        it('should revoke specific user session', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for invalid session token', () => {});
        it('should log admin action', () => {});
      });

      describe('POST /admin/revoke-user-sessions', () => {
        it('should revoke all sessions for user', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for non-existent user', () => {});
        it('should handle bulk session revocation', () => {});
      });
    });

    describe('User Impersonation', () => {
      describe('POST /admin/impersonate-user', () => {
        it('should create impersonation session', () => {});
        it('should return error for insufficient permissions', () => {});
        it('should return error for non-existent user', () => {});
        it('should track impersonation in session data', () => {});
        it('should prevent impersonating other admins', () => {});
      });

      describe('POST /admin/stop-impersonating', () => {
        it('should stop impersonation session', () => {});
        it('should return error when not impersonating', () => {});
        it('should restore original session', () => {});
        it('should log impersonation end', () => {});
      });
    });

    describe('POST /admin/set-user-password', () => {
      it('should set user password with admin privileges', () => {});
      it('should return error for insufficient permissions', () => {});
      it('should return error for weak password', () => {});
      it('should return error for non-existent user', () => {});
      it('should revoke user sessions after password change', () => {});
    });
  });

  // ============== INTEGRATION & SECURITY TESTS ==============
  describe('Security & Rate Limiting', () => {
    it('should enforce rate limiting on authentication endpoints', () => {});
    it('should return 429 status when rate limit exceeded', () => {});
    it('should handle CSRF protection', () => {});
    it('should validate bearer token authentication', () => {});
    it('should handle cookie-based authentication', () => {});
    it('should return proper CORS headers', () => {});
    it('should sanitize error messages in production', () => {});
    it('should prevent timing attacks on user enumeration', () => {});
    it('should enforce password complexity requirements', () => {});
    it('should handle concurrent session limits', () => {});
  });

  describe('Error Handling', () => {
    it('should return 400 for malformed JSON requests', () => {});
    it('should return 401 for missing authentication', () => {});
    it('should return 403 for insufficient permissions', () => {});
    it('should return 404 for non-existent endpoints', () => {});
    it('should return 500 for internal server errors', () => {});
    it('should return consistent error response format', () => {});
    it('should handle database connection errors gracefully', () => {});
    it('should validate all input parameters', () => {});
  });

  describe('Health Check', () => {
    describe('GET /ok', () => {
      it('should return success status when API is healthy', () => {
        return request(app.getHttpServer()).get('/api/auth/ok').expect(200).expect({ ok: true });
      });
    });

    describe('GET /error', () => {
      it('should display error page HTML', () => {
        return request(app.getHttpServer())
          .get('/api/auth/error')
          .expect(200)
          .expect(res => {
            expect(res.text).toContain('<html');
            expect(res.text).toContain('Better Auth Error');
            expect(res.text).toContain('Return to Application');
            const match = res.text.match(/<span id="errorCode">(.*?)<\/span>/);
            expect(match).not.toBeNull();
            const errorCode = match?.[1];
            expect(errorCode).toBeTruthy();
          });
      });
    });
  });

  // ============== END-TO-END INTEGRATION TESTS ==============
  describe('Complete User Journey Tests', () => {
    it('should complete full email signup and verification flow', async () => {
      // Step 1: Sign up with email
      const signupResponse = await authService.api.signUpEmail({ body: testUser });

      // Validate signup response
      expect(signupResponse).toHaveProperty('token');
      expect(signupResponse).toHaveProperty('user');
      expect(signupResponse.user).toHaveProperty('id');
      expect(signupResponse.user).toHaveProperty('email', testUser.email);
      expect(signupResponse.user).toHaveProperty('emailVerified', false);
      expect(signupResponse.user).not.toHaveProperty('password');

      // Step 2: Wait for verification email
      const emailMeta = await MailpitHelper.waitForEmailForUser(testUser.email);
      expect(emailMeta).toBeDefined();
      expect(emailMeta.Subject).toContain('Verify your email address');
      expect(emailMeta.To[0].Address).toBe(testUser.email);

      // Step 3: Extract verification URL from email
      const emailText = await MailpitHelper.getEmailText(emailMeta.ID);
      const verificationUrl = extractVerificationUrl(emailText);
      expect(verificationUrl).toBeDefined();
      expect(verificationUrl).toContain('/api/auth/verify-email');

      // Step 4: Verify email by clicking the link
      const verificationPath = extractPathAfterHost(verificationUrl!);
      expect(verificationPath).toBeDefined();
      console.log('Verification path:', verificationPath);

      const verificationResponse = await request(app.getHttpServer())
        .get(verificationPath!)
        .expect(302);

      console.log('Verification response headers:', verificationResponse.headers);
      expect(verificationResponse.headers.location).toBeDefined();

      // Step 5: Sign in with verified email
      const signinResponse = await authService.api.signInEmail({
        body: {
          email: testUser.email,
          password: testUser.password,
        },
        returnHeaders: true,
      });

      // Add debug logging
      console.log('Signin Response:', JSON.stringify(signinResponse.response, null, 2));

      // Validate signin response
      expect(signinResponse.response).toHaveProperty('token');
      expect(signinResponse.response).toHaveProperty('user');
      expect(signinResponse.response.user).toHaveProperty('id');
      expect(signinResponse.response.user).toHaveProperty('email', testUser.email);
      expect(signinResponse.response.user).toHaveProperty('emailVerified', true);

      // Step 6: Access protected resource with token
      const sessionResponse = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Cookie', signinResponse.headers.get('set-cookie')!)
        .expect(200);
      // const sessionResponse = await authService.api.getSession({
      //   query: {
      //     disableCookieCache: true,
      //   },
      //   headers: signinResponse.headers,
      // });

      // Validate session response
      expect(sessionResponse.body).toBeDefined();
      expect(sessionResponse.body).toHaveProperty('session');
      expect(sessionResponse.body).toHaveProperty('user');
      expect(sessionResponse.body.session).toHaveProperty(
        'userId',
        signinResponse.response.user.id,
      );
      expect(sessionResponse.body.user).toHaveProperty('id', signinResponse.response.user.id);
      expect(sessionResponse.body.user).toHaveProperty('email', testUser.email);
      expect(sessionResponse.body.user).toHaveProperty('emailVerified', true);
    });
    it('should complete social login and account linking flow', async () => {});
    it('should complete password reset flow', () => {});
    it('should complete 2FA setup and login flow', () => {});
    it('should complete admin user management flow', () => {});
    it('should handle session management across multiple devices', () => {});
    it('should handle account recovery scenarios', () => {});
    it('should maintain security throughout user lifecycle', () => {});
  });
});
