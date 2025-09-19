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

import { BetterAuthClientPlugin, createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';
import * as OTPAuth from 'otpauth';
import { CookieJar, MemoryCookieStore } from 'tough-cookie';

import { waitForEmailVerification, waitForPasswordResetEmail } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';

export function setupBetterAuthClient(backendUrl: string) {
  return createAuthClient({
    baseURL: backendUrl,
    plugins: [
      twoFactorClient(),
      (function (): BetterAuthClientPlugin {
        const cookieJar = new CookieJar(new MemoryCookieStore(), {
          prefixSecurity: 'silent',
          // Allow cookies with Secure flag to be sent over HTTP in tests
          rejectPublicSuffixes: false,
          ignoreCookieErrors: true,
        });
        return {
          id: 'cookie-manager',
          fetchPlugins: [
            {
              id: 'cookie-jar',
              name: 'Cookie Jar',
              async init(url, options) {
                const fullUrl = url.startsWith('http') ? url : `${options?.baseURL}${url}`;

                try {
                  // Debug: Check what cookies are stored before attempting to get them
                  const allCookies = await cookieJar.getCookies(fullUrl);
                  console.log(
                    'All stored cookies for URL:',
                    fullUrl,
                    allCookies.map(c => `${c.key}=${c.value}`),
                  );

                  const cookieString = await cookieJar.getCookieString(fullUrl);
                  if (cookieString) {
                    options = {
                      ...options,
                      headers: {
                        ...options?.headers,
                        cookie: cookieString,
                      },
                    };
                    console.log('Sending cookies:', cookieString);
                  } else {
                    console.log('No cookies found for URL:', fullUrl);
                    console.log('Cookie jar stored cookies:', allCookies.length);

                    // Additional debugging: Show all cookies in the jar
                    if (allCookies.length > 0) {
                      console.log('Cookie details:');
                      allCookies.forEach((cookie, index) => {
                        console.log(`  Cookie ${index + 1}:`, {
                          key: cookie.key,
                          value: cookie.value,
                          domain: cookie.domain,
                          path: cookie.path,
                          secure: cookie.secure,
                          httpOnly: cookie.httpOnly,
                          sameSite: cookie.sameSite,
                          expires: cookie.expires,
                        });
                      });
                    }
                  }
                } catch (error) {
                  console.warn('Error getting cookies:', error);
                }

                console.log('BetterAuthClient Init:', { url, options });

                return { url, options };
              },
              hooks: {
                async onResponse(context) {
                  console.log('BetterAuthClient Response status:', context.response.status);

                  // For getSession responses, log the body
                  if (context.request.url.pathname.includes('/get-session')) {
                    const responseClone = context.response.clone();
                    const responseText = await responseClone.text();
                    console.log('getSession response body:', responseText);
                  }

                  const setCookieHeaders =
                    context.response.headers.getSetCookie?.() ||
                    context.response.headers.get('set-cookie');

                  if (setCookieHeaders) {
                    const cookies = Array.isArray(setCookieHeaders)
                      ? setCookieHeaders
                      : setCookieHeaders.split(',').map(c => c.trim());

                    console.log('Setting cookies:', cookies);

                    for (const cookie of cookies) {
                      try {
                        // For testing: remove Secure flag to allow HTTP cookies and adjust SameSite
                        let modifiedCookie = cookie.replace(/;\s*Secure/gi, '');
                        // Also handle SameSite=None which requires Secure in production but not in tests
                        modifiedCookie = modifiedCookie.replace(
                          /;\s*SameSite=None/gi,
                          '; SameSite=Lax',
                        );

                        await cookieJar.setCookie(modifiedCookie, context.request.url.toString());
                        console.log('Successfully set cookie:', cookie.split(';')[0]);
                        console.log('Modified cookie attributes:', modifiedCookie);
                      } catch (error) {
                        console.warn('Failed to set cookie:', cookie, error);
                        console.warn('Original cookie was:', cookie);
                      }
                    }
                  }

                  return context;
                },
              },
            },
          ],
        };
      })(),
    ],
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
      console.log('Sign-in result:', {
        hasUser: !!signInResult.data?.user,
        userId: signInResult.data?.user?.id,
        hasSession: !!signInResult.data?.session,
        sessionId: signInResult.data?.session?.id,
        emailVerified: signInResult.data?.user?.emailVerified,
      });

      // Use session data directly from sign-in response instead of getSession call
      const sessionData = signInResult.data;

      console.log('Session from sign-in:', {
        hasToken: !!sessionData?.token,
        userId: sessionData?.user?.id,
        emailVerified: sessionData?.user?.emailVerified,
        twoFactorEnabled: sessionData?.user?.twoFactorEnabled,
        fullData: sessionData,
      });

      // Validate session before attempting 2FA enable
      // Better Auth with multi-session plugin returns token and user directly in the response
      if (!sessionData?.token || !sessionData?.user) {
        throw new Error(
          `No valid session found before 2FA enable. Session data: ${JSON.stringify(sessionData)}`,
        );
      }

      if (!sessionData.user.emailVerified) {
        throw new Error('Email must be verified before enabling 2FA');
      }

      console.log('Session validation passed, proceeding with 2FA enable...');

      const enableResult = await authClient.twoFactor.enable({ password });

      if (enableResult.error) {
        console.error('2FA enable error details:', {
          error: enableResult.error,
          response: enableResult.response,
          status: enableResult.response?.status,
          statusText: enableResult.response?.statusText,
        });
        throw new Error(`2FA enable failed: ${JSON.stringify(enableResult.error)}`);
      }

      console.log('2FA enable successful:', {
        hasTotpURI: !!enableResult.data?.totpURI,
        dataKeys: Object.keys(enableResult.data || {}),
      });

      ok(enableResult.data?.totpURI, '2FA enable should return data when successful');

      const totp = OTPAuth.URI.parse(enableResult.data.totpURI);

      ok(totp instanceof OTPAuth.TOTP, 'Parsed TOTP should be an instance of OTPAuth.TOTP');

      // Generate TOTP code and verify it to complete 2FA setup
      const totpCode = totp.generate();
      console.log('Generated TOTP code:', totpCode);

      const verifyResult = await authClient.twoFactor.verifyTotp({
        code: totpCode,
      });

      if (verifyResult.error) {
        console.error('TOTP verification error details:', {
          error: verifyResult.error,
          response: verifyResult.response,
          status: verifyResult.response?.status,
          statusText: verifyResult.response?.statusText,
          totpCode,
        });
        throw new Error(`TOTP verification failed: ${JSON.stringify(verifyResult.error)}`);
      }

      console.log('TOTP verification successful:', verifyResult.data);
      ok(verifyResult.data, 'TOTP verification should succeed');

      await authClient.signOut();

      const signInWithTotpResult = await authClient.signIn.email({
        email,
        password,
      });

      /** @todo continue flow */
    });
  });
});
