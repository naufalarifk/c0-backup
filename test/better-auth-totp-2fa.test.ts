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

import * as OTPAuth from 'otpauth';

import { setupBetterAuthClient } from './setup/better-auth';
import { waitForEmailVerification } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';

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

  describe('Two Factor (TOTP)', function () {
    it('shall enable and use TOTP successfully with valid password', async function () {
      const email = `totp1_${testId}@example.com`;
      const password = 'ValidPassword123!';
      await authClient.signUp.email({
        email,
        password,
        name: email,
      });

      await waitForEmailVerification(testSetup.mailpitUrl, email);

      const signInResult = await authClient.signIn.email({
        email,
        password,
      });

      ok(signInResult.data?.user, 'User should be signed in');
      ok(signInResult.data?.token, 'Session token should be present after sign-in');

      const bearerToken = signInResult.data.token;
      const authenticatedFetchOptions = { headers: { Authorization: `Bearer ${bearerToken}` } };

      const getSessionResult = await authClient.getSession({
        fetchOptions: authenticatedFetchOptions,
      });

      ok(getSessionResult.data?.session, 'Session should be valid');
      ok(getSessionResult.data?.user, 'Session should be valid');

      const enableResult = await authClient.twoFactor.enable({
        fetchOptions: authenticatedFetchOptions,
        password,
        issuer: testSetup.backendUrl,
      });

      if (enableResult.error) {
        throw new Error(`2FA enable failed: ${JSON.stringify(enableResult)}`);
      }

      ok(enableResult.data?.totpURI, '2FA enable should return data when successful');

      const totp = OTPAuth.URI.parse(enableResult.data.totpURI);

      ok(totp instanceof OTPAuth.TOTP, 'Parsed TOTP should be an instance of OTPAuth.TOTP');

      const totpCode = totp.generate();

      const verifyResult = await authClient.twoFactor.verifyTotp({
        code: totpCode,
        trustDevice: true,
      });

      if (verifyResult.error) {
        throw new Error(`TOTP verification failed: ${JSON.stringify(verifyResult)}`);
      }

      ok(verifyResult.data, 'TOTP verification should succeed');

      await authClient.signOut({ fetchOptions: authenticatedFetchOptions });

      const signInWithTotpResult = await authClient.signIn.email({
        email,
        password,
      });

      ok('twoFactorRedirect' in (signInWithTotpResult.data ?? {}), 'User should be signed in');

      /** @TODO continue */
    });
  });
});
