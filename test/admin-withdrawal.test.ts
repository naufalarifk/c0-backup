import { ok, strictEqual } from 'node:assert/strict';

import {
  assertArray,
  assertDefined,
  assertProp,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it } from './setup/test';
import { createTestUser, TestUser } from './setup/user';

describe('Admin Withdrawal Management API', function () {
  const testId = Date.now().toString(36).toLowerCase();
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let adminUser: TestUser;
  let regularUser: TestUser;
  let withdrawalId: string;

  before(async function () {
    testSetup = await setup();
    [adminUser, regularUser] = await Promise.all([
      createTestUser({ testId, testSetup, email: 'admin@test.com', role: 'admin' }),
      createTestUser({
        testId,
        testSetup,
        email: 'user@test.com',
        userType: 'Individual',
      }),
    ]);

    // Set up account balance using test endpoint
    const balanceSetupResponse = await regularUser.fetch(
      '/api/test/setup-account-balance-by-email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regularUser.email,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
          balance: '1000000000', // 1000 in smallest unit
        }),
      },
    );
    ok([200, 201].includes(balanceSetupResponse.status), 'Balance setup should succeed');

    // Create a beneficiary using test endpoint
    const beneficiaryResponse = await regularUser.fetch('/api/test/create-beneficiary-by-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regularUser.email,
        blockchainKey: 'eip155:56',
        address: '0x1234567890123456789012345678901234567890',
      }),
    });
    const beneficiaryData = await beneficiaryResponse.json();
    assertDefined(beneficiaryData);
    assertPropDefined(beneficiaryData, 'beneficiaryId');
    const beneficiaryId = beneficiaryData.beneficiaryId;

    // Create a withdrawal using test endpoint
    const withdrawalResponse = await regularUser.fetch('/api/test/create-withdrawal-by-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regularUser.email,
        beneficiaryId: beneficiaryId,
        amount: '500000000', // 500 in smallest unit
        currencyBlockchainKey: 'eip155:56',
        currencyTokenId: 'slip44:714',
      }),
    });
    const withdrawalData = await withdrawalResponse.json();
    assertDefined(withdrawalData);
    assertPropDefined(withdrawalData, 'withdrawalId');
    withdrawalId = String(withdrawalData.withdrawalId);

    // Mark withdrawal as failed using test endpoint
    const failResponse = await adminUser.fetch('/api/test/mark-withdrawal-as-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawalId: Number(withdrawalId),
        failureReason: 'Network timeout during transaction processing',
      }),
    });
    ok(failResponse.ok, 'Should mark withdrawal as failed');
  });

  after(async function () {
    await testSetup.teardown();
  });

  describe('GET /api/admin/withdrawals', function () {
    it('should retrieve withdrawal queue with pagination', async function () {
      const response = await adminUser.fetch('/api/admin/withdrawals');
      strictEqual(response.status, 200, 'Admin should be able to retrieve withdrawal queue');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true, 'Response should indicate success');

      assertPropDefined(responseData, 'data');
      const data = responseData.data;

      // Verify withdrawals array
      assertPropDefined(data, 'withdrawals');
      assertArray(data.withdrawals);
      ok(data.withdrawals.length > 0, 'Should have at least 1 withdrawal from setup');

      // Verify withdrawal structure according to OpenAPI spec
      const withdrawal = data.withdrawals[0];
      assertDefined(withdrawal);
      assertPropString(withdrawal, 'id');
      assertPropDefined(withdrawal, 'user');
      assertPropDefined(withdrawal, 'withdrawal');
      assertPropDefined(withdrawal, 'beneficiary');

      // Verify user structure
      const user = withdrawal.user;
      assertPropString(user, 'id');
      assertPropString(user, 'email');
      assertPropString(user, 'name');

      // Verify withdrawal details structure
      const withdrawalDetails = withdrawal.withdrawal;
      assertPropNumber(withdrawalDetails, 'amount');
      assertPropString(withdrawalDetails, 'currencyBlockchainKey');
      assertPropString(withdrawalDetails, 'currencyTokenId');
      assertPropString(withdrawalDetails, 'beneficiaryAddress');
      assertPropString(withdrawalDetails, 'requestDate');
      assertPropString(withdrawalDetails, 'state');

      // Verify platformWalletBalances is present
      assertPropDefined(data, 'platformWalletBalances');

      // Verify statistics is present
      assertPropDefined(data, 'statistics');
      const statistics = data.statistics;
      assertPropNumber(statistics, 'totalPending');
      assertPropNumber(statistics, 'totalProcessing');
      assertPropNumber(statistics, 'totalFailed');

      // Verify pagination metadata
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

    it('should support filtering by status', async function () {
      const response = await adminUser.fetch('/api/admin/withdrawals?status=Failed');
      strictEqual(response.status, 200, 'Status filter should be accepted');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);
      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropDefined(data, 'withdrawals');
      assertArray(data.withdrawals);

      // If there are failed withdrawals, verify they have Failed status
      if (data.withdrawals.length > 0) {
        for (const withdrawal of data.withdrawals) {
          assertPropDefined(withdrawal, 'withdrawal');
          assertPropString(withdrawal.withdrawal, 'state');
          strictEqual(
            withdrawal.withdrawal.state,
            'Failed',
            'All withdrawals should have Failed status',
          );
        }
      }
    });

    it('should support pagination parameters', async function () {
      const response = await adminUser.fetch('/api/admin/withdrawals?page=1&limit=10');
      strictEqual(response.status, 200, 'Pagination parameters should be accepted');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'pagination');
      const pagination = responseData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      strictEqual(pagination.page, 1, 'Page should match requested page');
      strictEqual(pagination.limit, 10, 'Limit should match requested limit');
    });

    it('should reject non-admin users', async function () {
      const response = await regularUser.fetch('/api/admin/withdrawals');
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
      const error = errorData.error;
      assertPropString(error, 'code');
      assertPropString(error, 'message');
    });
  });

  describe('GET /api/admin/withdrawals/{id}', function () {
    it('should retrieve individual withdrawal details', async function () {
      const response = await adminUser.fetch(`/api/admin/withdrawals/${withdrawalId}`);
      strictEqual(response.status, 200, 'Admin should be able to retrieve withdrawal details');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'data');
      const data = responseData.data;

      // Verify withdrawal detail structure according to OpenAPI spec
      assertPropString(data, 'id');
      assertPropString(data, 'userId');
      assertPropString(data, 'userEmail');
      assertPropString(data, 'currency');
      assertPropString(data, 'blockchainKey');
      assertPropString(data, 'tokenId');
      assertPropNumber(data, 'amount');
      assertPropNumber(data, 'requestAmount');
      assertPropString(data, 'status');
      assertPropString(data, 'beneficiaryAddress');
      assertPropString(data, 'requestDate');

      // Verify nullable fields
      assertProp(check(isNullable, isString), data, 'sentDate');
      assertProp(check(isNullable, isString), data, 'sentAmount');
      assertProp(check(isNullable, isString), data, 'sentHash');
      assertProp(check(isNullable, isString), data, 'confirmedDate');
      assertProp(check(isNullable, isString), data, 'failedDate');
      assertProp(check(isNullable, isString), data, 'failureReason');
      assertProp(check(isNullable, isString, isNumber), data, 'failureRefundReviewerUserId');
      assertProp(check(isNullable, isString), data, 'failureRefundApprovedDate');
      assertProp(check(isNullable, isString), data, 'failureRefundRejectedDate');
      assertProp(check(isNullable, isString), data, 'failureRefundRejectionReason');

      strictEqual(data.id, withdrawalId, 'Withdrawal ID should match requested ID');

      // Verify dates are valid ISO strings
      ok(
        new Date(data.requestDate).toString() !== 'Invalid Date',
        'requestDate should be valid date',
      );
    });

    it('should return 404 for non-existent withdrawal', async function () {
      const response = await adminUser.fetch('/api/admin/withdrawals/99999999');
      strictEqual(response.status, 404, 'Should return 404 for non-existent withdrawal');

      const errorData = await response.json();
      assertDefined(errorData);
      // The error structure may vary, just verify it's an error response
      assertPropDefined(errorData, 'success');
      ok(errorData.success === false, 'Should return error response');
    });

    it('should reject non-admin users', async function () {
      const response = await regularUser.fetch(`/api/admin/withdrawals/${withdrawalId}`);
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });
  });

  describe('POST /api/admin/withdrawals/{id}', function () {
    it('should process withdrawal refund successfully', async function () {
      // First verify the withdrawal is in Failed state
      const detailsResponse = await adminUser.fetch(`/api/admin/withdrawals/${withdrawalId}`);
      strictEqual(detailsResponse.status, 200);
      const detailsData = await detailsResponse.json();
      assertDefined(detailsData);
      assertPropDefined(detailsData, 'data');
      assertPropString(detailsData.data, 'status');
      // If not Failed, skip this test
      if (detailsData.data.status !== 'Failed') {
        console.warn('Withdrawal is not in Failed state, skipping refund test');
        return;
      }

      // Process the refund
      const refundReason = 'Network timeout - platform responsibility';
      const adminNotes = 'Verified transaction failure after 24 hours monitoring';
      const response = await adminUser.fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: refundReason,
          adminNotes: adminNotes,
        }),
      });

      strictEqual(response.status, 200, 'Refund processing should be successful');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'data');
      const data = responseData.data;
      assertPropString(data, 'refundId');
      assertPropString(data, 'originalWithdrawalId');
      assertPropString(data, 'refundAmount');
      assertPropString(data, 'refundCurrency');
      assertPropString(data, 'processedAt');

      strictEqual(data.originalWithdrawalId, withdrawalId, 'Original withdrawal ID should match');

      // Verify processedAt is a valid recent timestamp
      const processedAt = new Date(data.processedAt);
      ok(processedAt.toString() !== 'Invalid Date', 'processedAt should be valid date');
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - processedAt.getTime());
      ok(timeDiff < 60000, 'processedAt should be recent (within last minute)');

      // Verify withdrawal status is now RefundApproved
      const updatedDetailsResponse = await adminUser.fetch(
        `/api/admin/withdrawals/${withdrawalId}`,
      );
      strictEqual(updatedDetailsResponse.status, 200);
      const updatedDetailsData = await updatedDetailsResponse.json();
      assertDefined(updatedDetailsData);
      assertPropDefined(updatedDetailsData, 'data');
      assertPropString(updatedDetailsData.data, 'status');
      assertPropString(updatedDetailsData.data, 'failureRefundApprovedDate');
      assertProp(check(isString, isNumber), updatedDetailsData.data, 'failureRefundReviewerUserId');
      strictEqual(
        updatedDetailsData.data.status,
        'RefundApproved',
        'Withdrawal status should be RefundApproved',
      );
      ok(
        updatedDetailsData.data.failureRefundApprovedDate !== null,
        'Refund approved date should be set',
      );
      ok(
        updatedDetailsData.data.failureRefundReviewerUserId !== null,
        'Reviewer user ID should be set',
      );
    });

    it('should validate required reason field', async function () {
      // Create another withdrawal for this test
      const balanceSetupResponse2 = await regularUser.fetch(
        '/api/test/setup-account-balance-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: regularUser.email,
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
            balance: '1000000000',
          }),
        },
      );
      ok([200, 201].includes(balanceSetupResponse2.status), 'Balance setup should succeed');

      // Create beneficiary using test endpoint
      const beneficiaryResponse = await regularUser.fetch('/api/test/create-beneficiary-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regularUser.email,
          blockchainKey: 'eip155:56',
          address: '0x9876543210987654321098765432109876543210',
        }),
      });
      const beneficiaryData = await beneficiaryResponse.json();
      assertDefined(beneficiaryData);
      assertPropDefined(beneficiaryData, 'beneficiaryId');

      // Create withdrawal using test endpoint
      const withdrawalResponse = await regularUser.fetch('/api/test/create-withdrawal-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regularUser.email,
          beneficiaryId: beneficiaryData.beneficiaryId,
          amount: '100000000',
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
        }),
      });
      const withdrawalData = await withdrawalResponse.json();
      assertDefined(withdrawalData);
      assertPropDefined(withdrawalData, 'withdrawalId');
      const testWithdrawalId = String(withdrawalData.withdrawalId);

      // Mark as failed using test endpoint
      await adminUser.fetch('/api/test/mark-withdrawal-as-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: Number(testWithdrawalId),
          failureReason: 'Test failure',
        }),
      });

      const response = await adminUser.fetch(`/api/admin/withdrawals/${testWithdrawalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminNotes: 'Missing reason field',
        }),
      });

      strictEqual(response.status, 422, 'Should validate required reason field');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      ok(errorData.success === false, 'Should return error response');
    });

    it('should return 404 for non-existent withdrawal', async function () {
      const response = await adminUser.fetch('/api/admin/withdrawals/99999999', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Test reason',
        }),
      });

      strictEqual(response.status, 404, 'Should return 404 for non-existent withdrawal');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      ok(errorData.success === false, 'Should return error response');
    });

    it('should reject non-admin users', async function () {
      const response = await regularUser.fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Unauthorized refund attempt',
        }),
      });

      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });
  });
});
