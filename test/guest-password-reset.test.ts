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

import {
  assertDefined,
  assertPropArrayOf,
  assertPropDefined,
  assertPropString,
  assertString,
} from 'typeshaper';

import { setupBetterAuthClient } from './setup/better-auth';
import { waitForEmailVerification, waitForPasswordResetEmail } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';

suite('Guest Password Reset UI Flow', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let testUser: ReturnType<typeof setupBetterAuthClient>;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
    testUser = setupBetterAuthClient(testSetup.backendUrl);
  });

  after(async function () {
    await testSetup.teardown();
  });

  describe('Password Reset Request Page (Initial State)', function () {
    it('shall accept valid email address for password reset', async function () {
      const email = `reset_request_${testId}@test.com`;
      const password = 'ValidPassword123!';

      await testUser.authClient.signUp.email({
        email,
        password,
        name: email,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, email);

      const { data, error } = await testUser.authClient.forgetPassword({ email });

      ok(!error, `Password reset request failed: ${error?.message}`);
      ok(data !== null, 'Password reset request should return data');
    });

    it('shall handle non-existent email addresses gracefully', async function () {
      const nonExistentEmail = `nonexistent_${testId}@test.com`;

      const { error } = await testUser.authClient.forgetPassword({ email: nonExistentEmail });

      ok(!error, 'Password reset request should not error for non-existent emails (privacy)');
    });

    it('shall handle invalid email format gracefully', async function () {
      const invalidEmail = 'invalid-email-format';

      const { error } = await testUser.authClient.forgetPassword({ email: invalidEmail });

      ok(error, 'Password reset request should return error for invalid email format');
      assertString(error.message);
      ok(error.message.length > 0, `Error message should not be empty, got: ${error.message}`);
    });

    it('shall handle empty email field gracefully', async function () {
      const emptyEmail = '';

      const { error } = await testUser.authClient.forgetPassword({ email: emptyEmail });

      ok(error, 'Password reset request should return error for empty email');
      assertString(error.message);
      ok(error.message.length > 0, `Error message should not be empty, got: ${error.message}`);
    });
  });

  describe('Password Reset Request Page (Error States)', function () {
    let validEmail: string;
    let validResetToken: string;

    before(async function () {
      validEmail = `error_states_${testId}@test.com`;
      const password = 'ValidPassword123!';

      await testUser.authClient.signUp.email({
        email: validEmail,
        password,
        name: validEmail,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, validEmail);
      await testUser.authClient.forgetPassword({ email: validEmail });

      const { resetToken } = await waitForPasswordResetEmail(testSetup.mailpitUrl, validEmail);
      validResetToken = resetToken;
    });

    it('shall handle invalid reset link with proper error message', async function () {
      const invalidToken = 'invalid-token-xyz';
      const newPassword = 'NewPassword123!';

      const { data, error } = await testUser.authClient.resetPassword({
        newPassword,
        token: invalidToken,
      });

      ok(error, 'Should return error for invalid token');
      assertString(error.message);
      ok(error.message.toLowerCase().includes('invalid'), 'Error should mention invalid link');
      ok(!data, 'Should not return data for invalid token');
    });

    it('shall handle expired reset link with proper error message', async function () {
      const expiredToken = validResetToken;
      const newPassword = 'NewPassword123!';

      await testUser.authClient.resetPassword({
        newPassword,
        token: expiredToken,
      });

      const { data, error } = await testUser.authClient.resetPassword({
        newPassword: 'AnotherPassword123!',
        token: expiredToken,
      });

      ok(error, 'Should return error for already used/expired token');
      assertString(error.message);
      ok(!data, 'Should not return data for expired token');
    });

    it('shall handle server errors gracefully', async function () {
      const malformedToken = 'malformed.token.structure';
      const newPassword = 'NewPassword123!';

      const { data, error } = await testUser.authClient.resetPassword({
        newPassword,
        token: malformedToken,
      });

      ok(error, 'Should return error for malformed token');
      ok(!data, 'Should not return data for server error');
    });
  });

  describe('New Password Creation Page (Empty State)', function () {
    let resetEmail: string;
    let resetToken: string;

    before(async function () {
      resetEmail = `new_password_${testId}@test.com`;
      const password = 'ValidPassword123!';

      await testUser.authClient.signUp.email({
        email: resetEmail,
        password,
        name: resetEmail,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, resetEmail);
      await testUser.authClient.forgetPassword({ email: resetEmail });

      const result = await waitForPasswordResetEmail(testSetup.mailpitUrl, resetEmail);
      resetToken = result.resetToken;
    });

    it('shall accept valid new password', async function () {
      const newPassword = 'ValidNewPassword123!';

      const { data, error } = await testUser.authClient.resetPassword({
        newPassword,
        token: resetToken,
      });

      ok(data, `Password reset failed: ${error?.message}`);
      ok(!error, 'Password reset should not have an error');
    });

    it('shall validate password strength requirements', async function () {
      const weakPassword = '123';

      const { data, error } = await testUser.authClient.resetPassword({
        newPassword: weakPassword,
        token: resetToken,
      });

      ok(error, 'Should return error for weak password');
      ok(!data, 'Should not return data for weak password');
    });

    it('shall reject passwords that are too short', async function () {
      const shortPassword = 'Aa1!';

      const { data, error } = await testUser.authClient.resetPassword({
        newPassword: shortPassword,
        token: resetToken,
      });

      ok(error, 'Should return error for password that is too short');
      ok(!data, 'Should not return data for short password');
    });

    it('shall reject passwords without required character types', async function () {
      const noSpecialChars = 'Password123';
      const noNumbers = 'Password!!!';
      const noUppercase = 'password123!';
      const noLowercase = 'PASSWORD123!';

      const testCases = [
        { password: noSpecialChars, description: 'no special characters' },
        { password: noNumbers, description: 'no numbers' },
        { password: noUppercase, description: 'no uppercase' },
        { password: noLowercase, description: 'no lowercase' },
      ];

      for (const testCase of testCases) {
        const { data, error } = await testUser.authClient.resetPassword({
          newPassword: testCase.password,
          token: resetToken,
        });

        ok(error, `Should return error for password with ${testCase.description}`);
        ok(!data, `Should not return data for password with ${testCase.description}`);
      }
    });
  });

  describe('Password Reset Success Page (Sign In Variant)', function () {
    let successEmail: string;

    before(async function () {
      successEmail = `success_signin_${testId}@test.com`;
    });

    it('shall successfully complete password reset flow and allow sign in', async function () {
      const originalPassword = 'OriginalPassword123!';
      const newPassword = 'NewPassword123!';

      await testUser.authClient.signUp.email({
        email: successEmail,
        password: originalPassword,
        name: successEmail,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, successEmail);

      await testUser.authClient.forgetPassword({ email: successEmail });

      const { resetToken } = await waitForPasswordResetEmail(testSetup.mailpitUrl, successEmail);

      const resetResult = await testUser.authClient.resetPassword({
        newPassword,
        token: resetToken,
      });

      ok(resetResult.data, `Password reset failed: ${resetResult.error?.message}`);
      ok(!resetResult.error, 'Password reset should not have an error');

      const signInResult = await testUser.authClient.signIn.email({
        email: successEmail,
        password: newPassword,
      });

      ok(
        signInResult.data?.user,
        `Sign in with new password failed: ${signInResult.error?.message}`,
      );
      assertDefined(signInResult.data.user);
      assertPropString(signInResult.data.user, 'id');
      ok(signInResult.data.user.id.length > 0, 'User ID should not be empty');
    });

    it('shall prevent sign in with old password after reset', async function () {
      const oldPasswordEmail = `old_password_${testId}@test.com`;
      const originalPassword = 'OriginalPassword123!';
      const newPassword = 'NewPassword123!';

      await testUser.authClient.signUp.email({
        email: oldPasswordEmail,
        password: originalPassword,
        name: oldPasswordEmail,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, oldPasswordEmail);

      await testUser.authClient.forgetPassword({ email: oldPasswordEmail });

      const { resetToken } = await waitForPasswordResetEmail(
        testSetup.mailpitUrl,
        oldPasswordEmail,
      );

      await testUser.authClient.resetPassword({
        newPassword,
        token: resetToken,
      });

      const oldPasswordSignIn = await testUser.authClient.signIn.email({
        email: oldPasswordEmail,
        password: originalPassword,
      });

      ok(oldPasswordSignIn.error, 'Sign in with old password should fail');
      ok(
        !('user' in (oldPasswordSignIn.data ?? {})),
        'Should not return user data for old password',
      );
    });
  });

  describe('Password Reset Success Page (Mobile App Variant)', function () {
    it('shall handle success flow for mobile app context', async function () {
      const mobileEmail = `mobile_success_${testId}@test.com`;
      const originalPassword = 'OriginalPassword123!';
      const newPassword = 'NewPassword123!';

      await testUser.authClient.signUp.email({
        email: mobileEmail,
        password: originalPassword,
        name: mobileEmail,
        callbackURL: 'cryptogadai://email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, mobileEmail);

      await testUser.authClient.forgetPassword({ email: mobileEmail });

      const { resetToken } = await waitForPasswordResetEmail(testSetup.mailpitUrl, mobileEmail);

      const resetResult = await testUser.authClient.resetPassword({
        newPassword,
        token: resetToken,
      });

      ok(resetResult.data, `Mobile password reset failed: ${resetResult.error?.message}`);
      ok(!resetResult.error, 'Mobile password reset should not have an error');

      const signInResult = await testUser.authClient.signIn.email({
        email: mobileEmail,
        password: newPassword,
      });

      ok(
        signInResult.data?.user,
        `Mobile sign in with new password failed: ${signInResult.error?.message}`,
      );
    });
  });

  describe('Overall Flow Summary', function () {
    it('shall complete full logical user journey from request to success', async function () {
      const journeyEmail = `full_journey_${testId}@test.com`;
      const originalPassword = 'OriginalPassword123!';
      const newPassword = 'NewPassword123!';

      await testUser.authClient.signUp.email({
        email: journeyEmail,
        password: originalPassword,
        name: journeyEmail,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, journeyEmail);

      const resetRequestResult = await testUser.authClient.forgetPassword({ email: journeyEmail });
      ok(!resetRequestResult.error, 'Step 1: Password reset request should succeed');

      const { resetToken } = await waitForPasswordResetEmail(testSetup.mailpitUrl, journeyEmail);
      assertString(resetToken);
      ok(resetToken.length > 0, 'Step 2: Should receive valid reset token');

      const passwordResetResult = await testUser.authClient.resetPassword({
        newPassword,
        token: resetToken,
      });
      ok(passwordResetResult.data, 'Step 3: Password reset should succeed');
      ok(!passwordResetResult.error, 'Step 3: Password reset should not have errors');

      const signInResult = await testUser.authClient.signIn.email({
        email: journeyEmail,
        password: newPassword,
      });
      ok(signInResult.data?.user, 'Step 4: Sign in with new password should succeed');
      assertDefined(signInResult.data.user);
      assertPropString(signInResult.data.user, 'id');
    });

    it('shall provide consistent error handling across all steps', async function () {
      const invalidEmail = 'invalid-email';
      const invalidToken = 'invalid-token';
      const weakPassword = '123';

      const emailResult = await testUser.authClient.forgetPassword({ email: invalidEmail });
      ok(emailResult.error, 'Should handle invalid email with proper error response');

      const tokenResult = await testUser.authClient.resetPassword({
        newPassword: 'ValidPassword123!',
        token: invalidToken,
      });
      ok(tokenResult.error, 'Should handle invalid token consistently');

      const passwordResult = await testUser.authClient.resetPassword({
        newPassword: weakPassword,
        token: 'some-token',
      });
      ok(passwordResult.error, 'Should handle weak password consistently');
    });

    it('shall maintain security throughout the flow', async function () {
      const securityEmail = `security_test_${testId}@test.com`;
      const password = 'ValidPassword123!';

      await testUser.authClient.signUp.email({
        email: securityEmail,
        password,
        name: securityEmail,
        callbackURL: 'http://localhost/email-sign-up-callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, securityEmail);

      await testUser.authClient.forgetPassword({ email: securityEmail });

      const { resetToken } = await waitForPasswordResetEmail(testSetup.mailpitUrl, securityEmail);

      const usedTokenResult = await testUser.authClient.resetPassword({
        newPassword: 'FirstNewPassword123!',
        token: resetToken,
      });
      ok(usedTokenResult.data, 'First use of token should succeed');

      const reuseTokenResult = await testUser.authClient.resetPassword({
        newPassword: 'SecondNewPassword123!',
        token: resetToken,
      });
      ok(reuseTokenResult.error, 'Reusing token should fail for security');
    });
  });
});
