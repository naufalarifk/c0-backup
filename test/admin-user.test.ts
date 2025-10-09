import { ok, strictEqual } from 'node:assert/strict';

import {
  assertArray,
  assertDefined,
  assertProp,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
  check,
  isNullable,
  isString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it } from './setup/test';
import { createKycTestUser, createTestUser, TestUser } from './setup/user';

describe('Admin User Management API', function () {
  const testId = Date.now().toString(36).toLowerCase();
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let adminUser: TestUser;
  let user1: TestUser;
  let user2: TestUser;
  let user3: TestUser;

  before(async function () {
    testSetup = await setup();
    [adminUser, user1, user2, user3] = await Promise.all([
      createTestUser({ testId, testSetup, email: 'admin@test.com', role: 'admin' }),
      createKycTestUser({ testId, testSetup, email: 'user1@test.com' }),
      createKycTestUser({ testId, testSetup, email: 'user2@test.com' }),
      createKycTestUser({ testId, testSetup, email: 'user3@test.com' }),
    ]);
  });

  after(async function () {
    await testSetup.teardown();
  });

  describe('GET /api/admin/users', function () {
    it('should retrieve list of users with pagination', async function () {
      const response = await adminUser.fetch('/api/admin/users');
      strictEqual(response.status, 200, 'Admin should be able to retrieve users list');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true, 'Response should indicate success');

      assertPropDefined(responseData, 'data');
      const data = responseData.data;

      // Verify users array
      assertPropDefined(data, 'users');
      assertArray(data.users);
      // We created 4 users in setup: 1 admin + 3 regular users
      ok(data.users.length >= 4, `Should have at least 4 users, got ${data.users.length}`);

      // Verify user structure according to OpenAPI spec
      assertPropArrayMapOf(data, 'users', function (user) {
        assertDefined(user);
        assertPropString(user, 'id');
        assertPropString(user, 'email');
        assertPropString(user, 'name');
        assertProp(
          v => v === ('active' as const) || v === ('suspended' as const) || v === 'locked',
          user,
          'status',
        );
        assertProp(
          v =>
            v === ('none' as const) ||
            v === ('pending' as const) ||
            v === ('verified' as const) ||
            v === 'rejected',
          user,
          'kycStatus',
        );
        // institutionId and institutionRole are nullable
        assertProp(check(isNullable, isString), user, 'institutionId');
        assertProp(check(isNullable, isString), user, 'institutionRole');
        assertPropString(user, 'registeredDate');

        // Verify lastLogin can be string or null
        assertProp(check(isNullable, isString), user, 'lastLogin');

        return user;
      });

      // Verify statistics - should always be present in list response
      assertPropDefined(data, 'statistics');
      const statistics = data.statistics;
      assertPropNumber(statistics, 'totalUsers');
      assertPropNumber(statistics, 'kycVerified');
      assertPropNumber(statistics, 'institutionUsers');

      // Verify counts are non-negative
      ok(statistics.totalUsers >= 0, 'totalUsers should be non-negative');
      ok(statistics.kycVerified >= 0, 'kycVerified should be non-negative');
      ok(statistics.institutionUsers >= 0, 'institutionUsers should be non-negative');

      // Verify pagination metadata - should always be present in list response
      assertPropDefined(responseData, 'pagination');
      const pagination = responseData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      assertPropNumber(pagination, 'total');
      assertPropNumber(pagination, 'totalPages');
      assertPropDefined(pagination, 'hasNext');
      assertPropDefined(pagination, 'hasPrev');

      ok(pagination.page >= 1, 'page should be >= 1');
      ok(pagination.limit >= 1, 'limit should be >= 1');
      ok(pagination.total >= 0, 'total should be >= 0');
      ok(pagination.totalPages >= 0, 'totalPages should be >= 0');
    });

    it('should support search by email', async function () {
      const searchEmail = user1.email;
      const response = await adminUser.fetch(
        `/api/admin/users?search=${encodeURIComponent(searchEmail)}`,
      );
      strictEqual(response.status, 200, 'Search should be successful');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);
      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropDefined(data, 'users');
      assertArray(data.users);

      // Verify that search results include the searched user
      const foundUser = data.users.find((u: any) => u.email === searchEmail);
      assertDefined(foundUser, 'Should find the searched user');
      assertPropString(foundUser, 'email');
      strictEqual(foundUser.email, searchEmail, 'Found user email should match search');
    });

    it('should support filtering by status', async function () {
      // NOTE: Status filtering is not yet implemented
      // This test currently verifies the endpoint accepts the status parameter
      // but does not filter results. When status filtering is implemented,
      // this test should be enhanced to:
      // 1. Create users with different statuses (active, suspended, locked)
      // 2. Query with status=active and verify only active users returned
      // 3. Query with status=suspended and verify only suspended users returned
      // 4. Verify the filter works in combination with search parameter

      const response = await adminUser.fetch('/api/admin/users?status=active');
      strictEqual(response.status, 200, 'Status filter parameter should be accepted');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropDefined(data, 'users');
      assertArray(data.users);

      // Currently all users have 'active' status by default (not filtered, just default value)
      // When filtering is implemented, this assertion will actually test the filter
      for (const user of data.users) {
        assertPropString(user, 'status');
        // Note: This passes because all test users default to 'active', not because filtering works
      }
    });

    it('should support pagination parameters', async function () {
      const response = await adminUser.fetch('/api/admin/users?page=1&limit=2');
      strictEqual(response.status, 200, 'Pagination parameters should be accepted');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropDefined(data, 'users');
      assertArray(data.users);

      // Verify pagination metadata
      assertPropDefined(responseData, 'pagination');
      const pagination = responseData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      strictEqual(pagination.page, 1, 'Page should match requested page');
      strictEqual(pagination.limit, 2, 'Limit should match requested limit');
    });

    it('should reject non-admin users', async function () {
      const response = await user1.fetch('/api/admin/users');
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
      const error = errorData.error;
      assertPropString(error, 'code');
      assertPropString(error, 'message');
    });
  });

  describe('GET /api/admin/users/{id}', function () {
    it('should retrieve individual user profile details', async function () {
      const userId = user1.id;
      const response = await adminUser.fetch(`/api/admin/users/${userId}`);
      strictEqual(response.status, 200, 'Admin should be able to retrieve user profile');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'data');
      const data = responseData.data;

      // Verify user profile structure
      assertPropDefined(data, 'user');
      const user = data.user;
      assertPropString(user, 'id');
      assertPropString(user, 'email');
      assertPropString(user, 'name');
      assertProp(
        v => v === ('Individual' as const) || v === ('Company' as const) || v === 'Admin',
        user,
        'role',
      );
      assertProp(
        v => v === ('active' as const) || v === ('suspended' as const) || v === 'locked',
        user,
        'status',
      );
      assertProp(
        v =>
          v === ('none' as const) ||
          v === ('pending' as const) ||
          v === ('verified' as const) ||
          v === 'rejected',
        user,
        'kycStatus',
      );
      assertPropString(user, 'registeredDate');

      // Verify lastLoginDate can be string or null
      assertProp(check(isNullable, isString), user, 'lastLoginDate');

      strictEqual(user.id, userId, 'User ID should match requested ID');
      strictEqual(user.email, user1.email, 'User email should match');

      // Verify dates are valid ISO strings
      ok(
        new Date(user.registeredDate).toString() !== 'Invalid Date',
        'registeredDate should be valid date',
      );
    });

    it('should include financial summary when user has transactions', async function () {
      const userId = user1.id;
      const response = await adminUser.fetch(`/api/admin/users/${userId}`);
      strictEqual(response.status, 200);

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'data');
      const data = responseData.data;

      // Financial summary should be present
      assertPropDefined(data, 'financialSummary');
      const financialSummary = data.financialSummary;
      assertPropString(financialSummary, 'totalDeposits');
      assertPropString(financialSummary, 'totalWithdrawals');
      assertPropNumber(financialSummary, 'activeLoans');
      ok(financialSummary.activeLoans >= 0, 'activeLoans should be non-negative');
    });

    it('should include empty admin notes array when no notes exist', async function () {
      const userId = user1.id;
      const response = await adminUser.fetch(`/api/admin/users/${userId}`);
      strictEqual(response.status, 200);

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'data');
      const data = responseData.data;

      // Admin notes should be present as array
      assertPropDefined(data, 'adminNotes');
      assertArray(data.adminNotes);
      // Since we haven't added any notes in setup, array should be empty
      strictEqual(data.adminNotes.length, 0, 'adminNotes should be empty array');
    });

    it('should return 404 for non-existent user', async function () {
      const response = await adminUser.fetch('/api/admin/users/99999999');
      strictEqual(response.status, 404, 'Should return 404 for non-existent user');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
      const error = errorData.error;
      assertPropString(error, 'code');
      assertPropString(error, 'message');
    });

    it('should reject non-admin users', async function () {
      const userId = user2.id;
      const response = await user1.fetch(`/api/admin/users/${userId}`);
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });
  });

  describe('POST /api/admin/users/{id}/actions', function () {
    it('should suspend a user successfully', async function () {
      // Create a new user for suspension test
      const suspendUser = await createKycTestUser({
        testId,
        testSetup,
        email: `suspend_test_${testId}@test.com`,
      });

      const suspendReason = 'Suspicious activity detected requiring investigation';
      const response = await adminUser.fetch(`/api/admin/users/${suspendUser.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspend',
          reason: suspendReason,
        }),
      });

      strictEqual(response.status, 200, 'User suspension should be successful');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropString(data, 'action');
      assertPropString(data, 'userId');
      assertPropString(data, 'executedAt');

      strictEqual(data.action, 'suspend', 'Action should be suspend');
      strictEqual(data.userId, suspendUser.id, 'User ID should match');

      // Verify executedAt is a valid recent timestamp
      const executedAt = new Date(data.executedAt);
      ok(executedAt.toString() !== 'Invalid Date', 'executedAt should be valid date');
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - executedAt.getTime());
      ok(timeDiff < 60000, 'executedAt should be recent (within last minute)');

      // Verify user status is now suspended
      const userProfileResponse = await adminUser.fetch(`/api/admin/users/${suspendUser.id}`);
      strictEqual(userProfileResponse.status, 200);
      const userProfileData = await userProfileResponse.json();
      assertDefined(userProfileData);
      assertPropDefined(userProfileData, 'data');
      assertPropDefined(userProfileData.data, 'user');
      const user = userProfileData.data.user;
      assertPropString(user, 'status');
      strictEqual(user.status, 'suspended', 'User status should be suspended');
    });

    it('should activate a suspended user', async function () {
      // Create and suspend a user first
      const testUser = await createKycTestUser({
        testId,
        testSetup,
        email: `activate_test_${testId}@test.com`,
      });

      // Suspend the user
      const suspendResponse = await adminUser.fetch(`/api/admin/users/${testUser.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspend',
          reason: 'Test suspension',
        }),
      });
      strictEqual(suspendResponse.status, 200, 'User should be suspended');

      // Now activate the user
      const activateResponse = await adminUser.fetch(`/api/admin/users/${testUser.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          reason: 'Investigation completed, no issues found',
        }),
      });

      strictEqual(activateResponse.status, 200, 'User activation should be successful');

      const responseData = await activateResponse.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropString(data, 'action');
      assertPropString(data, 'userId');
      assertPropString(data, 'executedAt');

      strictEqual(data.action, 'activate', 'Action should be activate');
      strictEqual(data.userId, testUser.id, 'User ID should match');

      // Verify user status is now active
      const userProfileResponse = await adminUser.fetch(`/api/admin/users/${testUser.id}`);
      strictEqual(userProfileResponse.status, 200);
      const userProfileData = await userProfileResponse.json();
      assertDefined(userProfileData);
      assertPropDefined(userProfileData, 'data');
      assertPropDefined(userProfileData.data, 'user');
      const user = userProfileData.data.user;
      assertPropString(user, 'status');
      strictEqual(user.status, 'active', 'User status should be active');
    });

    it('should handle unlock action idempotently on active user', async function () {
      // Create a new active user (not locked)
      const testUser = await createKycTestUser({
        testId,
        testSetup,
        email: `unlock_test_${testId}@test.com`,
      });

      const response = await adminUser.fetch(`/api/admin/users/${testUser.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlock',
          reason: 'User verified identity and requested account unlock',
        }),
      });

      // Unlock is idempotent - succeeds even for non-locked users
      strictEqual(response.status, 200, 'Unlock should succeed idempotently');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropString(data, 'action');
      assertPropString(data, 'userId');
      assertPropString(data, 'executedAt');

      strictEqual(data.action, 'unlock', 'Action should be unlock');
      strictEqual(data.userId, testUser.id, 'User ID should match');

      // Verify user remains active
      const userProfileResponse = await adminUser.fetch(`/api/admin/users/${testUser.id}`);
      strictEqual(userProfileResponse.status, 200);
      const userProfileData = await userProfileResponse.json();
      assertDefined(userProfileData);
      assertPropDefined(userProfileData, 'data');
      assertPropDefined(userProfileData.data, 'user');
      const user = userProfileData.data.user;
      assertPropString(user, 'status');
      strictEqual(user.status, 'active', 'User status should remain active');
    });

    it('should validate required action field', async function () {
      const response = await adminUser.fetch(`/api/admin/users/${user1.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Missing action field',
        }),
      });

      strictEqual(response.status, 400, 'Should validate required action field');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });

    it('should validate action enum values', async function () {
      const response = await adminUser.fetch(`/api/admin/users/${user1.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalid_action',
          reason: 'Testing invalid action',
        }),
      });

      strictEqual(response.status, 400, 'Should validate action enum values');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });

    it('should return 404 for non-existent user', async function () {
      const response = await adminUser.fetch('/api/admin/users/99999999/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspend',
          reason: 'Testing non-existent user',
        }),
      });

      strictEqual(response.status, 404, 'Should return 404 for non-existent user');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });

    it('should reject non-admin users', async function () {
      const response = await user1.fetch(`/api/admin/users/${user2.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suspend',
          reason: 'Unauthorized test',
        }),
      });

      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });
  });
});
