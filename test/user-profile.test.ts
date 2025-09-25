import { deepStrictEqual, doesNotReject, ok, rejects, strictEqual } from 'node:assert/strict';

import {
  assertDefined,
  assertPropArray,
  assertPropArrayOf,
  assertPropDefined,
  assertPropNullableString,
  assertPropNullableStringOrNumber,
  assertPropNumber,
  assertPropOneOf,
  assertPropString,
} from './setup/assertions';
import { setupBetterAuthClient } from './setup/better-auth';
import { waitForEmailVerification } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';

suite('User Profile Management', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let authClient: ReturnType<typeof setupBetterAuthClient>['authClient'];
  let cookieJar: ReturnType<typeof setupBetterAuthClient>['cookieJar'];
  let authenticatedFetch: (url: string, init?: RequestInit) => Promise<Response>;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
    const betterAuthClient = setupBetterAuthClient(testSetup.backendUrl);
    authClient = betterAuthClient.authClient;
    cookieJar = betterAuthClient.cookieJar;

    // Create authenticated fetch helper using standard fetch with cookies
    authenticatedFetch = async function (path: string, init?: RequestInit) {
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
      const response = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
      });

      // Store any new cookies
      response.headers.getSetCookie()?.forEach(cookie => {
        cookieJar.setCookieSync(cookie, url, { ignoreError: true });
      });

      const _clonedResponse = response.clone();
      // console.debug('authenticatedFetch', init?.method, url, {
      //   status: response.status,
      //   // resHeaders: Array.from(response.headers.entries()).reduce(
      //   //   (acc, [key, value]) => {
      //   //     acc[key] = value;
      //   //     return acc;
      //   //   },
      //   //   {} as Record<string, string>,
      //   // ),
      //   reqBody: init?.body,
      //   resBody: await clonedResponse.text(),
      // });

      return response;
    };
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('User Type Selection', function () {
    let userEmail: string;
    let userPassword: string;

    before(async function () {
      userEmail = `user_type_${testId}@test.com`;
      userPassword = 'ValidPassword123!';

      // Create and verify user
      await authClient.signUp.email({
        email: userEmail,
        password: userPassword,
        name: 'Test User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, userEmail);
      await authClient.signIn.email({ email: userEmail, password: userPassword });
    });

    it('should allow user to select Individual type', async function () {
      const response = await authenticatedFetch('/api/users/type-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: 'Individual' }),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'userType');
      assertPropString(data, 'message');
      strictEqual(data.userType, 'Individual');
      ok(data.message.includes('Individual successfully selected'));
    });

    it('should allow user to select Institution type', async function () {
      const newUserEmail = `inst_user_${testId}@test.com`;
      const newUserPassword = 'ValidPassword123!';

      // Create new user for institution test
      await authClient.signUp.email({
        email: newUserEmail,
        password: newUserPassword,
        name: 'Institution User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, newUserEmail);
      await authClient.signIn.email({ email: newUserEmail, password: newUserPassword });

      const response = await authenticatedFetch('/api/users/type-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: 'Institution' }),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'userType');
      assertPropString(data, 'message');
      strictEqual(data.userType, 'Institution');
      ok(data.message.includes('Institution successfully selected'));
    });

    it('should return 422 for invalid user type', async function () {
      const newUserEmail = `invalid_type_${testId}@test.com`;
      const newUserPassword = 'ValidPassword123!';

      await authClient.signUp.email({
        email: newUserEmail,
        password: newUserPassword,
        name: 'Invalid Type User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, newUserEmail);
      await authClient.signIn.email({ email: newUserEmail, password: newUserPassword });

      const response = await authenticatedFetch('/api/users/type-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: 'InvalidType' }),
      });

      strictEqual(response.status, 422);
    });

    it('should return 409 if user type already selected', async function () {
      // Re-authenticate as the original user who already selected Individual type
      await authClient.signIn.email({ email: userEmail, password: userPassword });

      const response = await authenticatedFetch('/api/users/type-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: 'Institution' }),
      });

      strictEqual(response.status, 409);
      const data = await response.json();
      assertDefined(data);
      assertPropString(data, 'message');
      ok(data.message.includes('already selected'));
    });

    it('should return 401 for unauthenticated user', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/users/type-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: 'Individual' }),
      });

      strictEqual(response.status, 401);
    });
  });

  describe('User Profile Retrieval', function () {
    let profileUserEmail: string;
    let profileUserPassword: string;

    before(async function () {
      profileUserEmail = `profile_user_${testId}@test.com`;
      profileUserPassword = 'ValidPassword123!';

      // Create and verify user
      await authClient.signUp.email({
        email: profileUserEmail,
        password: profileUserPassword,
        name: 'Profile Test User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, profileUserEmail);
      await authClient.signIn.email({ email: profileUserEmail, password: profileUserPassword });
    });

    it('should retrieve user profile successfully', async function () {
      const response = await authenticatedFetch('/api/users/profile');

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'user');

      const user = data.user;
      assertPropNumber(user, 'id');
      assertPropString(user, 'role');
      assertPropString(user, 'email');
      assertPropString(user, 'name');
      assertPropNullableString(user, 'profilePictureUrl');
      assertPropNullableString(user, 'googleId');
      assertPropString(user, 'createdDate');

      strictEqual(user.email, profileUserEmail);
      strictEqual(user.name, 'Profile Test User');
      strictEqual(user.role, 'User');
    });

    it('should include verification status fields', async function () {
      const response = await authenticatedFetch('/api/users/profile');
      const data = await response.json();
      const user = data.user;

      // Check KYC related fields
      if ('kycStatus' in user) {
        assertPropOneOf(user, 'kycStatus', ['none', 'pending', 'verified', 'rejected']);
      }

      // Check phone verification
      if ('phoneVerified' in user) {
        ok(typeof user.phoneVerified === 'boolean');
      }

      // Check feature unlock status for unverified users
      if ('featureUnlockStatus' in user) {
        assertDefined(user.featureUnlockStatus);
        const features = user.featureUnlockStatus;
        ok(typeof features.tradingEnabled === 'boolean');
        ok(typeof features.withdrawalEnabled === 'boolean');
        ok(typeof features.loanBorrowingEnabled === 'boolean');
        ok(typeof features.loanLendingEnabled === 'boolean');
        ok(typeof features.institutionalFeaturesEnabled === 'boolean');
      }

      // Check required verifications array
      if ('requiredVerifications' in user) {
        assertPropArray(user, 'requiredVerifications');
        if (user.requiredVerifications.length > 0) {
          assertPropArrayOf(user, 'requiredVerifications', item => {
            assertDefined(item);
            assertPropString(item, 'type');
            assertPropString(item, 'title');
            assertPropString(item, 'description');
            assertPropString(item, 'actionText');
            assertPropOneOf(item, 'priority', ['low', 'medium', 'high', 'critical']);
            return item;
          });
        }
      }
    });

    it('should include all profile fields from OpenAPI schema', async function () {
      const response = await authenticatedFetch('/api/users/profile');
      const data = await response.json();
      const user = data.user;

      // Core required fields
      assertPropNumber(user, 'id');
      assertPropString(user, 'role');
      assertPropString(user, 'email');
      assertPropString(user, 'name');
      assertPropString(user, 'createdDate');

      // Nullable fields that should be present
      assertPropNullableStringOrNumber(user, 'profilePictureUrl');
      assertPropNullableStringOrNumber(user, 'googleId');
      assertPropNullableStringOrNumber(user, 'emailVerifiedDate');
      assertPropNullableStringOrNumber(user, 'lastLoginDate');
      assertPropNullableStringOrNumber(user, 'userType');
      assertPropNullableStringOrNumber(user, 'kycId');
      assertPropNullableStringOrNumber(user, 'institutionId');
      assertPropNullableStringOrNumber(user, 'institutionRole');

      // Boolean fields
      if ('twoFaEnabled' in user) {
        ok(typeof user.twoFaEnabled === 'boolean');
      }

      if ('isVerified' in user) {
        ok(typeof user.isVerified === 'boolean');
      }

      // Verification level field
      if ('verificationLevel' in user) {
        assertPropOneOf(user, 'verificationLevel', [
          'verified',
          'unverified',
          'pending',
          'rejected',
        ]);
      }
    });

    it('should return 401 for unauthenticated user', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/users/profile`);
      strictEqual(response.status, 401);
    });
  });

  describe('User Profile Updates', function () {
    let updateUserEmail: string;
    let updateUserPassword: string;

    before(async function () {
      updateUserEmail = `update_user_${testId}@test.com`;
      updateUserPassword = 'ValidPassword123!';

      // Create and verify user
      await authClient.signUp.email({
        email: updateUserEmail,
        password: updateUserPassword,
        name: 'Update Test User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, updateUserEmail);
      await authClient.signIn.email({ email: updateUserEmail, password: updateUserPassword });
    });

    it('should update user name successfully', async function () {
      const formData = new FormData();
      formData.append('name', 'Updated Test User Name');

      const response = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        body: formData,
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'user');
      assertPropDefined(data.user, 'name');
      assertPropString(data, 'message');

      strictEqual(data.user.name, 'Updated Test User Name');
      ok(data.message.includes('successfully'));
    });

    it('should update profile with empty name successfully', async function () {
      const formData = new FormData();
      formData.append('name', '');

      const response = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        body: formData,
      });

      // Should accept empty name or return validation error
      ok(response.status === 200 || response.status === 400 || response.status === 422);
    });

    it('should return 422 for name too long', async function () {
      const longName = 'a'.repeat(161); // Exceeds 160 character limit
      const formData = new FormData();
      formData.append('name', longName);

      const response = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        body: formData,
      });

      strictEqual(response.status, 422);
    });

    it('should return 401 for unauthenticated user', async function () {
      const formData = new FormData();
      formData.append('name', 'Unauthorized Update');

      const response = await fetch(`${testSetup.backendUrl}/api/users/profile`, {
        method: 'PUT',
        body: formData,
      });

      strictEqual(response.status, 401);
    });
  });

  describe('User Preferences', function () {
    let prefsUserEmail: string;
    let prefsUserPassword: string;

    before(async function () {
      prefsUserEmail = `prefs_user_${testId}@test.com`;
      prefsUserPassword = 'ValidPassword123!';

      // Create and verify user
      await authClient.signUp.email({
        email: prefsUserEmail,
        password: prefsUserPassword,
        name: 'Preferences Test User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, prefsUserEmail);
      await authClient.signIn.email({ email: prefsUserEmail, password: prefsUserPassword });
    });

    it('should retrieve user preferences with default values', async function () {
      const response = await authenticatedFetch('/api/users/preferences');

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success === true);
      assertPropDefined(data, 'data');

      const prefs = data.data;

      // Check notifications structure
      assertPropDefined(prefs, 'notifications');
      assertPropDefined(prefs.notifications, 'email');
      assertPropDefined(prefs.notifications, 'push');
      assertPropDefined(prefs.notifications, 'sms');

      // Check display preferences
      assertPropDefined(prefs, 'display');
      assertPropOneOf(prefs.display, 'theme', ['light', 'dark']);
      assertPropOneOf(prefs.display, 'language', ['en', 'id']);
      assertPropOneOf(prefs.display, 'currency', ['USD', 'IDR', 'EUR', 'BTC', 'ETH']);

      // Check privacy preferences
      assertPropDefined(prefs, 'privacy');
      assertPropOneOf(prefs.privacy, 'profileVisibility', ['private', 'public']);
      assertPropDefined(prefs.privacy, 'dataSharing');
    });

    it('should update notification preferences', async function () {
      const updateData = {
        notifications: {
          email: {
            enabled: false,
          },
          push: {
            enabled: true,
            types: {
              paymentAlerts: true,
              systemNotifications: false,
            },
          },
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      ok(data.success === true);
      strictEqual(data.data.notifications.email.enabled, false);
      strictEqual(data.data.notifications.push.enabled, true);
    });

    it('should update display preferences', async function () {
      const updateData = {
        display: {
          theme: 'dark',
          language: 'id',
          currency: 'IDR',
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      ok(data.success === true);
      strictEqual(data.data.display.theme, 'dark');
      strictEqual(data.data.display.language, 'id');
      strictEqual(data.data.display.currency, 'IDR');
    });

    it('should update privacy preferences', async function () {
      const updateData = {
        privacy: {
          profileVisibility: 'private',
          dataSharing: {
            analytics: false,
            thirdPartyIntegrations: false,
          },
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      ok(data.success === true);
      strictEqual(data.data.privacy.profileVisibility, 'private');
      strictEqual(data.data.privacy.dataSharing.analytics, false);
    });

    it('should update additional display preferences', async function () {
      const updateData = {
        display: {
          theme: 'dark',
          language: 'id',
          currency: 'EUR',
          timezone: 'Asia/Jakarta',
          dateFormat: 'DD/MM/YYYY',
          numberFormat: 'id-ID',
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      ok(data.success === true);
      strictEqual(data.data.display.theme, 'dark');
      strictEqual(data.data.display.language, 'id');
      strictEqual(data.data.display.currency, 'EUR');

      // Check additional fields if supported
      if ('timezone' in data.data.display) {
        strictEqual(data.data.display.timezone, 'Asia/Jakarta');
      }
      if ('dateFormat' in data.data.display) {
        strictEqual(data.data.display.dateFormat, 'DD/MM/YYYY');
      }
      if ('numberFormat' in data.data.display) {
        strictEqual(data.data.display.numberFormat, 'id-ID');
      }
    });

    it('should update comprehensive privacy preferences', async function () {
      const updateData = {
        privacy: {
          profileVisibility: 'public',
          dataSharing: {
            analytics: true,
            thirdPartyIntegrations: true,
            marketResearch: true,
          },
          activityTracking: false,
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      ok(data.success === true);
      strictEqual(data.data.privacy.profileVisibility, 'public');
      strictEqual(data.data.privacy.dataSharing.analytics, true);
      strictEqual(data.data.privacy.dataSharing.thirdPartyIntegrations, true);

      // Check additional fields if supported
      if ('marketResearch' in data.data.privacy.dataSharing) {
        strictEqual(data.data.privacy.dataSharing.marketResearch, true);
      }
      if ('activityTracking' in data.data.privacy) {
        strictEqual(data.data.privacy.activityTracking, false);
      }
    });

    it('should return 422 for invalid theme value', async function () {
      const updateData = {
        display: {
          theme: 'invalid-theme',
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      ok(data.success === false);
      ok(data.error.message.includes('Invalid theme value'));
    });

    it('should return 422 for unsupported language', async function () {
      const updateData = {
        display: {
          language: 'unsupported',
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      ok(data.success === false);
      ok(data.error.message.includes('Unsupported language'));
    });

    it('should return 422 for invalid currency', async function () {
      const updateData = {
        display: {
          currency: 'INVALID',
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      ok(data.success === false);
    });

    it('should return 422 for invalid profile visibility', async function () {
      const updateData = {
        privacy: {
          profileVisibility: 'invalid-visibility',
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      ok(data.success === false);
    });

    it('should return 401 for unauthenticated requests', async function () {
      // Test GET without auth
      const getResponse = await fetch(`${testSetup.backendUrl}/api/users/preferences`);
      strictEqual(getResponse.status, 401);

      // Test PUT without auth
      const putResponse = await fetch(`${testSetup.backendUrl}/api/users/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display: { theme: 'dark' } }),
      });
      strictEqual(putResponse.status, 401);
    });
  });

  describe('User Institution Memberships', function () {
    let instMemberEmail: string;
    let instMemberPassword: string;

    before(async function () {
      instMemberEmail = `inst_member_${testId}@test.com`;
      instMemberPassword = 'ValidPassword123!';

      // Create and verify user
      await authClient.signUp.email({
        email: instMemberEmail,
        password: instMemberPassword,
        name: 'Institution Member User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, instMemberEmail);
      await authClient.signIn.email({ email: instMemberEmail, password: instMemberPassword });
    });

    it('should retrieve empty memberships for individual user', async function () {
      const response = await authenticatedFetch('/api/user/institutions');

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropArray(data, 'memberships');
      strictEqual(data.memberships.length, 0);
    });

    it('should return 401 for unauthenticated user', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/user/institutions`);
      strictEqual(response.status, 401);
    });
  });

  describe('Edge Cases and Error Handling', function () {
    let edgeUserEmail: string;
    let edgeUserPassword: string;

    before(async function () {
      edgeUserEmail = `edge_user_${testId}@test.com`;
      edgeUserPassword = 'ValidPassword123!';

      await authClient.signUp.email({
        email: edgeUserEmail,
        password: edgeUserPassword,
        name: 'Edge Case User',
        callbackURL: 'http://localhost/callback',
      });

      await waitForEmailVerification(testSetup.mailpitUrl, edgeUserEmail);
      await authClient.signIn.email({ email: edgeUserEmail, password: edgeUserPassword });
    });

    it('should handle missing request body in user type selection', async function () {
      const response = await authenticatedFetch('/api/users/type-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      strictEqual(response.status, 422);
    });

    it('should handle empty name in profile update', async function () {
      const formData = new FormData();
      formData.append('name', '');

      const response = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        body: formData,
      });

      // Should either accept empty name or return validation error
      ok(response.status === 200 || response.status === 400 || response.status === 422);
    });

    it('should handle large profile picture file (413 error)', async function () {
      // Create a large buffer to simulate file > 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a'); // 6MB buffer
      const blob = new Blob([largeBuffer], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('name', 'Test User');
      formData.append('profilePicture', blob, 'large-image.jpg');

      const response = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        body: formData,
      });

      // Should return 413 for file too large or 400 for validation error
      ok(response.status === 413 || response.status === 400);
    });

    it('should handle invalid file type for profile picture', async function () {
      const textContent = 'This is not an image file';
      const blob = new Blob([textContent], { type: 'text/plain' });

      const formData = new FormData();
      formData.append('name', 'Test User');
      formData.append('profilePicture', blob, 'not-an-image.txt');

      const response = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        body: formData,
      });

      // Should return validation error for invalid file type
      ok(response.status === 400 || response.status === 422);
    });

    it('should handle missing multipart form data', async function () {
      const response = await authenticatedFetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User' }),
      });

      // Should handle content-type mismatch gracefully
      ok(response.status === 400 || response.status === 415 || response.status === 422);
    });

    it('should handle malformed JSON in preferences update', async function () {
      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      });

      strictEqual(response.status, 400);
    });

    it('should handle partial preferences update correctly', async function () {
      // First, get current preferences
      const getResponse = await authenticatedFetch('/api/users/preferences');
      const currentPrefs = await getResponse.json();

      // Update only one field
      const updateData = {
        display: {
          theme: currentPrefs.data.display.theme === 'light' ? 'dark' : 'light',
        },
      };

      const response = await authenticatedFetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 200);
      const updatedPrefs = await response.json();

      // Verify the updated field changed
      ok(updatedPrefs.data.display.theme !== currentPrefs.data.display.theme);

      // Verify other fields remained the same
      strictEqual(updatedPrefs.data.display.language, currentPrefs.data.display.language);
      strictEqual(updatedPrefs.data.display.currency, currentPrefs.data.display.currency);
    });
  });
});
