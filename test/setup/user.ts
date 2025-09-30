import { ok } from 'node:assert/strict';

import { setupBetterAuthClient } from './better-auth';
import { loggedFetch } from './fetch';
import { waitForEmailVerification } from './mailpit';
import { setup } from './setup';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  authClient: ReturnType<typeof setupBetterAuthClient>['authClient'];
  cookieJar: ReturnType<typeof setupBetterAuthClient>['cookieJar'];
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

  // Setup better auth client
  const betterAuthClient = setupBetterAuthClient(testSetup.backendUrl);
  const { authClient, cookieJar } = betterAuthClient;

  // Create authenticated fetch helper
  const authenticatedFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const url = `${testSetup.backendUrl}${path}`;

    // Get cookies from cookieJar
    const cookies = await new Promise<string>((resolve, reject) => {
      cookieJar.getCookieString(url, (error, cookieString) => {
        if (error) return reject(error);
        resolve(cookieString || '');
      });
    });

    // Add cookies to headers
    const headers = new Headers(init?.headers);
    if (cookies) {
      headers.set('Cookie', cookies);
    }

    // Make the request
    const response = await loggedFetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });

    // Store any new cookies
    response.headers.getSetCookie()?.forEach(cookie => {
      cookieJar.setCookieSync(cookie, url, { ignoreError: true });
    });

    return response;
  };

  // Sign up the user
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

  // Wait for email verification
  await waitForEmailVerification(testSetup.mailpitUrl, email);

  // Sign in the user
  await authClient.signIn.email({
    email,
    password,
  });

  // Set user type if specified
  if (userType) {
    const userTypeResponse = await authenticatedFetch('/api/users/type-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userType,
      }),
    });

    if (!userTypeResponse.ok) {
      const errorText = await userTypeResponse.text();
      console.error(
        `User type selection failed with status ${userTypeResponse.status}: ${errorText}`,
      );
    }
    ok(userTypeResponse.ok, 'User type selection should be successful');
  }

  // Assign admin role if specified
  if (role === 'admin') {
    const adminRoleResponse = await authenticatedFetch('/api/assign-admin-role', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    if (!adminRoleResponse.ok) {
      const errorText = await adminRoleResponse.text();
      console.error(
        `Admin role assignment failed with status ${adminRoleResponse.status}: ${errorText}`,
      );
    }
    ok(adminRoleResponse.ok, 'Admin role assignment should be successful');

    // Add a small delay to allow session to sync with database changes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    id: userId,
    email,
    password,
    name,
    authClient,
    cookieJar,
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
