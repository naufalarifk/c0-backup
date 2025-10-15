import type { RealtimeEventType } from '../../src/modules/realtime/realtime.types';

import { ok } from 'node:assert/strict';

import { assertDefined, assertPropDefined, assertPropString } from 'typeshaper';

import { setupBetterAuthClient } from './better-auth';
import { loggedFetch } from './fetch';
import { waitForEmailVerification } from './mailpit';
import { setup } from './setup';

export type RealtimeClient = {
  waitForEvent: (
    check: (message: { event: string; data: unknown }) => boolean,
    options: { timeout: number },
  ) => Promise<void>;
  disconnect: () => void;
};

type ConnectRealtimeClient = (
  events: Array<RealtimeEventType>,
  options: { timeout: number },
) => Promise<RealtimeClient>;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  authClient: ReturnType<typeof setupBetterAuthClient>['authClient'];
  cookieJar: ReturnType<typeof setupBetterAuthClient>['cookieJar'];
  connectRealtimeClient: ConnectRealtimeClient;
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
}

export interface TestUserOptions {
  testSetup: Awaited<ReturnType<typeof setup>>;
  testId: string;
  email?: string;
  password?: string;
  name?: string;
  userType?: 'Individual' | 'Institution';
  role?: 'admin' | 'user';
}

/**
 * Creates a test user with authentication and helper functions
 */
export async function createTestUser(options: TestUserOptions): Promise<TestUser> {
  const {
    testId,
    testSetup,
    email: providedEmail,
    password = 'ValidPassword123!',
    name: providedName,
    // Do NOT auto-select a user type by default. Tests that need a specific
    // initial userType should pass it explicitly to avoid accidental
    // pre-selection that interferes with type-selection tests.
    userType,
    role = 'user',
  } = options;

  const email = providedEmail ?? `test_user_${testId}_${Date.now()}@test.com`;
  const name = providedName ?? `Test User ${testId}`;

  const betterAuthClient = setupBetterAuthClient(testSetup.backendUrl);
  const { authClient, cookieJar } = betterAuthClient;

  const authenticatedFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const url = `${testSetup.backendUrl}${path}`;

    const cookies = await new Promise<string>((resolve, reject) => {
      cookieJar.getCookieString(url, (error, cookieString) => {
        if (error) return reject(error);
        resolve(cookieString || '');
      });
    });

    const headers = new Headers(init?.headers);
    if (cookies) {
      headers.set('Cookie', cookies);
    }

    const response = await loggedFetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });

    response.headers.getSetCookie()?.forEach(cookie => {
      cookieJar.setCookieSync(cookie, url, { ignoreError: true });
    });

    return response;
  };

  const signUpResult = await authClient.signUp.email({
    email,
    password,
    name,
    callbackURL: 'http://localhost/test-callback',
  });

  if (signUpResult.error) {
    throw new Error(`User sign up failed: ${JSON.stringify(signUpResult.error)}`);
  }

  ok(signUpResult.data?.user.id, 'User ID should exist after sign up');
  const userId = signUpResult.data.user.id;

  await waitForEmailVerification(testSetup.mailpitUrl, email);

  await authClient.signIn.email({ email, password });

  if (userType) {
    const userTypeResponse = await authenticatedFetch('/api/users/type-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userType }),
    });

    if (!userTypeResponse.ok) {
      const errorText = await userTypeResponse.text();
      console.error(
        `User type selection failed with status ${userTypeResponse.status}: ${errorText}`,
      );
    }
    ok(userTypeResponse.ok, 'User type selection should be successful');
  }

  if (role === 'admin') {
    const adminRoleResponse = await authenticatedFetch('/api/test/assign-admin-role', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    ok(adminRoleResponse.ok, 'Admin role assignment should be successful');

    // Sign out and sign back in to refresh the session with the updated admin role
    await authClient.signOut();
    await authClient.signIn.email({ email, password });
  }

  const connectRealtimeClient: ConnectRealtimeClient = async function (
    events,
    { timeout: realtimeTimeout },
  ) {
    const realtimeAuthTokenResp = await authenticatedFetch('/api/realtime-auth-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const realtimeAuthTokenData = (await realtimeAuthTokenResp.json()) as unknown;
    assertDefined(realtimeAuthTokenData);
    assertPropString(realtimeAuthTokenData, 'token');
    return new Promise<RealtimeClient>(function (resolve, reject) {
      let authResolvable = true;

      const connectionTimeout = setTimeout(function () {
        if (authResolvable) {
          authResolvable = false;
          ws.removeEventListener('message', authMessageListener);
          reject(new Error('Timeout waiting for realtime auth confirmation'));
        }
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
          console.error('WebSocket closed due to RealtimeClient connection timeout');
        }
      }, realtimeTimeout);

      const wsUrl = testSetup.backendUrl.replace(/^http/, 'ws');
      const ws = new WebSocket(`${wsUrl}/api/realtime`);

      ws.addEventListener('open', function () {
        ws.send(
          JSON.stringify({
            event: 'auth',
            data: {
              accessToken: realtimeAuthTokenData.token,
              events,
            },
          }),
        );
      });

      const authMessageListener = function (event: MessageEvent) {
        try {
          const message = JSON.parse(String(event.data)) as unknown;
          assertDefined(message);
          assertPropString(message, 'event');
          assertPropDefined(message, 'data');
          if (message.event === 'auth.confirmed') {
            if (authResolvable) {
              authResolvable = false;
              clearTimeout(connectionTimeout);
              ws.removeEventListener('message', authMessageListener);
              resolve({
                disconnect() {
                  ws.close();
                },
                async waitForEvent(check, { timeout: waiterTimeout }) {
                  return new Promise<void>(function (resolve, reject) {
                    let resolvable = true;
                    const eventWaiterTimeout = setTimeout(function () {
                      if (resolvable) {
                        resolvable = false;
                        reject(new Error('Timeout waiting for realtime event'));
                      }
                      if (ws.readyState !== WebSocket.CLOSED) {
                        ws.close();
                        console.error('WebSocket closed due to RealtimeClient event wait timeout');
                        console.error('Raw data:', event);
                      }
                    }, waiterTimeout);
                    const waitMessageListener = function (event: MessageEvent) {
                      try {
                        const message = JSON.parse(String(event.data)) as unknown;
                        assertDefined(message);
                        assertPropString(message, 'event');
                        assertPropDefined(message, 'data');
                        if (check(message)) {
                          if (resolvable) {
                            resolvable = false;
                            resolve();
                          }
                          ws.removeEventListener('message', waitMessageListener);
                          clearTimeout(eventWaiterTimeout);
                        }
                      } catch (error) {
                        if (resolvable) {
                          resolvable = false;
                          reject(new Error(`Failed to parse WebSocket message: ${error}`));
                        }
                        if (ws.readyState !== WebSocket.CLOSED) {
                          ws.close();
                          console.error('WebSocket closed due to message parsing error', error);
                          console.error('Raw data:', event);
                        }
                      }
                    };
                    ws.addEventListener('message', waitMessageListener);
                  });
                },
              });
            }
          }
        } catch (error) {
          if (authResolvable) {
            authResolvable = false;
            clearTimeout(connectionTimeout);
            ws.removeEventListener('message', authMessageListener);
            reject(new Error(`Failed to parse WebSocket message: ${error}`));
          }
          if (ws.readyState !== WebSocket.CLOSED) {
            ws.close();
            console.error('WebSocket closed due to message parsing error', error, event);
          }
        }
      };
      ws.addEventListener('message', authMessageListener);

      ws.addEventListener('error', function (event) {
        if (authResolvable) {
          authResolvable = false;
          clearTimeout(connectionTimeout);
          reject(new Error(`WebSocket closed due to RealtimeClient connection error: ${event}`));
        }
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
          console.error('WebSocket closed due to RealtimeClient connection error', event);
        }
      });
    });
  };

  return {
    id: userId,
    email,
    password,
    name,
    authClient,
    cookieJar,
    connectRealtimeClient,
    fetch: authenticatedFetch,
  };
}

/**
 * Creates a test user specifically configured for KYC testing
 */
export async function createKycTestUser(
  options: Omit<TestUserOptions, 'userType'>,
): Promise<TestUser> {
  return createTestUser({
    ...options,
    userType: 'Individual',
  });
}

/**
 * Creates a test user specifically configured for institution testing
 */
export async function createInstitutionTestUser(
  options: Omit<TestUserOptions, 'userType'>,
): Promise<TestUser> {
  return createTestUser({
    ...options,
    userType: 'Institution',
  });
}

/**
 * Creates an admin test user
 */
export async function createAdminTestUser(
  options: Omit<TestUserOptions, 'role'>,
): Promise<TestUser> {
  return createTestUser({
    ...options,
    role: 'admin',
  });
}
