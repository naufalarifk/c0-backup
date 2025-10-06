import { ok, strictEqual } from 'node:assert/strict';

import { assertDefined, assertPropDefined, assertPropString } from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createTestUser, type TestUser } from './setup/user';

suite('Expo Push Notification Integration', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let testUser: TestUser;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('Push Token Management', function () {
    before(async function () {
      testUser = await createTestUser({ testSetup, testId });
    });

    it('should update push token via dedicated endpoint', async function () {
      const pushToken = 'xxxxxxxxxxxxxxxxxxxxxx'; // Send without prefix

      // Update push token via dedicated endpoint
      const pushTokenResponse = await testUser.fetch('/api/users/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken,
        }),
      });

      strictEqual(pushTokenResponse.status, 200);
      const updateData = await pushTokenResponse.json();

      // Verify the response contains success message
      assertDefined(updateData);
      assertPropString(updateData, 'message');
      assertPropDefined(updateData, 'pushToken');
      ok(updateData.message.includes('successfully'));

      // Verify token was formatted with prefix
      strictEqual(updateData.pushToken, `ExponentPushToken[${pushToken}]`);

      console.log('✅ Push token successfully updated via dedicated endpoint');
    });

    it('should accept token with or without prefix', async function () {
      // Test with prefix
      const tokenWithPrefix = 'ExponentPushToken[abcdef123456]';

      const response1 = await testUser.fetch('/api/users/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken: tokenWithPrefix,
        }),
      });

      strictEqual(response1.status, 200);
      const data1 = await response1.json();
      assertDefined(data1);
      assertPropString(data1, 'pushToken');
      strictEqual(data1.pushToken, tokenWithPrefix);

      // Test without prefix
      const tokenWithoutPrefix = 'xyz789012345';

      const response2 = await testUser.fetch('/api/users/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken: tokenWithoutPrefix,
        }),
      });

      strictEqual(response2.status, 200);
      const data2 = await response2.json();
      assertDefined(data2);
      assertPropString(data2, 'pushToken');
      strictEqual(data2.pushToken, `ExponentPushToken[${tokenWithoutPrefix}]`);

      console.log('✅ Push token accepted with and without prefix');
    });

    it('should clear push token when empty value provided', async function () {
      // First set a token
      const setResponse = await testUser.fetch('/api/users/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken: 'test123',
        }),
      });

      strictEqual(setResponse.status, 200);

      // Clear the token
      const clearResponse = await testUser.fetch('/api/users/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken: undefined,
        }),
      });

      strictEqual(clearResponse.status, 200);
      const clearData = await clearResponse.json();
      assertDefined(clearData);
      assertPropString(clearData, 'message');
      ok(clearData.message.includes('cleared'));

      console.log('✅ Push token successfully cleared');
    });

    it('should be separate from user profile', async function () {
      // Get user profile - should not contain push token fields
      const profileResponse = await testUser.fetch('/api/users/profile');

      strictEqual(profileResponse.status, 200);
      const profileData = await profileResponse.json();
      assertDefined(profileData);
      assertPropDefined(profileData, 'user');

      const user = profileData.user;

      // Verify essential profile fields exist
      assertPropString(user, 'name');
      assertPropString(user, 'email');

      // Verify push token field does NOT exist in profile
      ok(!('expoPushToken' in user), 'expoPushToken should not be in user profile');

      console.log('✅ Push token properly separated from user profile');
    });
  });
});
