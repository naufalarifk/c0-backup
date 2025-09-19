import {
  deepStrictEqual,
  doesNotReject,
  doesNotThrow,
  notStrictEqual,
  ok,
  rejects,
  strictEqual,
  throws,
} from 'node:assert/strict';

import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import * as OTPAuth from 'otpauth';

import { waitForEmailVerification, waitForPasswordResetEmail } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';

export function setupBetterAuthClient(backendUrl: string) {
  return createAuthClient({
    baseURL: backendUrl,
    plugins: [twoFactorClient()],
  });
}

suite('Better Auth', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let authClient: ReturnType<typeof setupBetterAuthClient>;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
    authClient = setupBetterAuthClient(testSetup.backendUrl);
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('Email Sign-Up', function () {
    it('shall sign up a user with email and password', async function () {
      const email = `user_${testId}@test.com`;
      const password = 'ValidPassword123!';

      await doesNotReject(
        authClient.signUp
          .email({
            email: email,
            password: password,
            name: email,
            callbackURL: 'http://localhost/email-sign-up-callback',
          })
          .then(function (result) {
            result.data?.token;
            result.data?.user.id;
            ok(result.data?.user.id, 'User ID should exist');
            strictEqual(typeof result.data.user.id, 'string', 'User ID should be a string');
            ok(result.data.user.id.length > 0, 'User ID should not be empty');
          }),
      );

      const { emailVerificationRedirectLocation } = await waitForEmailVerification(
        testSetup.mailpitUrl,
        email,
      );

      ok(
        emailVerificationRedirectLocation.includes('http://localhost/email-sign-up-callback'),
        `expect redirect to contain callback URL, got: ${emailVerificationRedirectLocation}`,
      );
    });
  });

  describe('Email Sign-In', function () {
    it('shall sign in a user with email and password', async function () {
      const email = `signin_${testId}@test.com`;
      const password = 'ValidPassword123!';

      await authClient.signUp.email({
        email,
        password,
        name: email,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, email);

      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      ok(data?.user, `Sign in failed: ${error?.message}`);
      ok(data.user.id, 'User ID should exist after sign in');
      strictEqual(typeof data.user.id, 'string', 'User ID should be a string');
      ok(data.user.id.length > 0, 'User ID should not be empty');
    });
  });

  describe('Password Reset', function () {
    it('shall reset password', async function () {
      const email = `reset_${testId}@test.com`;
      const password = 'ValidPassword123!';
      const newPassword = 'NewPassword123!';

      await authClient.signUp.email({
        email,
        password,
        name: email,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, email);

      await authClient.forgetPassword({ email });

      const { resetToken } = await waitForPasswordResetEmail(testSetup.mailpitUrl, email);

      const { data, error } = await authClient.resetPassword({
        newPassword,
        token: resetToken,
      });

      ok(data, `Password reset failed: ${error?.message}`);
      ok(!error, 'Password reset should not have an error');

      const signInResult = await authClient.signIn.email({
        email,
        password: newPassword,
      });

      ok(
        signInResult.data?.user,
        `Sign in with new password failed: ${signInResult.error?.message}`,
      );
    });
  });
});
