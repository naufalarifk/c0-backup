import { deepStrictEqual, doesNotReject, ok, rejects, strictEqual } from 'node:assert/strict';

import {
  assertArray,
  assertDefined,
  assertProp,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNullableString,
  assertPropNumber,
  assertPropString,
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { waitForBeneficiaryVerificationEmail } from './setup/mailpit';
import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createTestUser, type TestUser } from './setup/user';

suite('User Withdrawal Feature', function () {
  const testId = Date.now().toString(36).toLowerCase();
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let testUser: TestUser;

  before(async function () {
    testSetup = await setup();
    testUser = await createTestUser({
      testId,
      testSetup,
      userType: 'Individual',
    });
  });

  after(async function () {
    await testSetup.teardown();
  });

  describe('POST /api/withdrawals', function () {
    let withdrawalUser: TestUser;
    let beneficiaryId: string;

    before(async function () {
      withdrawalUser = await createTestUser({
        testId,
        testSetup,
        email: `withdrawal_test_${testId}@test.com`,
        userType: 'Individual',
      });

      // Mark user as KYC verified for testing
      const kycResponse = await withdrawalUser.fetch('/api/test/mark-kyc-verified-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: withdrawalUser.email,
        }),
      });
      ok(kycResponse.ok, 'KYC verification should succeed');

      // Create and verify a beneficiary using test endpoint
      const beneficiaryResponse = await withdrawalUser.fetch(
        '/api/test/create-beneficiary-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: withdrawalUser.email,
            blockchainKey: 'eip155:56',
            address: '0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567',
          }),
        },
      );
      ok(beneficiaryResponse.ok, 'Beneficiary creation should succeed');

      const beneficiaryData = await beneficiaryResponse.json();
      assertDefined(beneficiaryData);
      assertPropString(beneficiaryData, 'beneficiaryId');
      beneficiaryId = beneficiaryData.beneficiaryId;

      // Set up account balance using test endpoint
      const balanceSetupResponse = await withdrawalUser.fetch(
        '/api/test/setup-account-balance-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: withdrawalUser.email,
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
            balance: '10000000000', // 10,000 in smallest unit
          }),
        },
      );
      ok([200, 201].includes(balanceSetupResponse.status), 'Balance setup should succeed');
    });

    it('should reject if not authenticated', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiaryId: beneficiaryId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
          amount: '1000.000000000000000000',
          twoFactorCode: '123456',
          phoneNumberCode: '123456',
        }),
      });
      strictEqual(response.status, 401, 'Unauthenticated requests should be rejected');
    });

    it('should reject if no beneficiary is set', async function () {
      const response = await withdrawalUser.fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiaryId: 999999,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
          amount: '1000.000000000000000000',
          twoFactorCode: '123456',
          phoneNumberCode: '123456',
        }),
      });
      ok(
        response.status === 404 || response.status === 403,
        'Should reject withdrawal request with non-existent beneficiary or unverified security',
      );

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      strictEqual(errorData.success, false);
    });

    it('should create withdrawal request successfully', async function () {
      // Note: The actual API endpoint requires 2FA and phone verification setup
      // This test verifies withdrawal can be created using test endpoint
      const response = await withdrawalUser.fetch('/api/test/create-withdrawal-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: withdrawalUser.email,
          beneficiaryId: beneficiaryId,
          amount: '1000000000', // 1000 in smallest unit
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
        }),
      });

      ok(response.ok, 'Withdrawal request should be created successfully');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'withdrawalId');
      assertPropNumber(responseData, 'withdrawalId');
      assertPropDefined(responseData, 'userId');
      assertPropString(responseData, 'amount');
      assertPropDefined(responseData, 'currency');
      assertPropString(responseData.currency, 'blockchainKey');
      assertPropString(responseData.currency, 'tokenId');
    });

    it('should validate required fields', async function () {
      const response = await withdrawalUser.fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      ok(
        response.status === 422 || response.status === 403,
        'Should return validation error or security requirement',
      );

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      strictEqual(errorData.success, false);
    });

    it('should validate 2FA and phone verification requirements', async function () {
      // Note: The API requires both 2FA and phone number verification to be set up
      // This test verifies the security requirements are enforced
      const response = await withdrawalUser.fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiaryId: beneficiaryId,
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
          amount: '100.000000000000000000',
          twoFactorCode: '123456',
          phoneNumberCode: '123456',
        }),
      });

      strictEqual(
        response.status,
        403,
        'Should require phone number or 2FA verification to be set up',
      );

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      strictEqual(errorData.success, false);
      assertPropDefined(errorData, 'error');
      assertPropString(errorData.error, 'message');
      ok(
        errorData.error.message.toLowerCase().includes('phone') ||
          errorData.error.message.toLowerCase().includes('2fa') ||
          errorData.error.message.toLowerCase().includes('verify'),
        'Error message should mention security verification requirement',
      );
    });
  });

  describe('GET /api/withdrawals', function () {
    let listWithdrawalUser: TestUser;
    let listBeneficiaryId: string;
    const withdrawalIds: number[] = [];

    before(async function () {
      listWithdrawalUser = await createTestUser({
        testId,
        testSetup,
        email: `list_withdrawal_${testId}@test.com`,
        userType: 'Individual',
      });

      // Mark user as KYC verified
      const kycResponse = await listWithdrawalUser.fetch('/api/test/mark-kyc-verified-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: listWithdrawalUser.email,
        }),
      });
      ok(kycResponse.ok, 'KYC verification should succeed');

      // Create a beneficiary
      const beneficiaryResponse = await listWithdrawalUser.fetch(
        '/api/test/create-beneficiary-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: listWithdrawalUser.email,
            blockchainKey: 'eip155:56',
            address: '0x1111111111111111111111111111111111111111',
          }),
        },
      );
      ok(beneficiaryResponse.ok, 'Beneficiary creation should succeed');

      const beneficiaryData = await beneficiaryResponse.json();
      assertDefined(beneficiaryData);
      assertPropString(beneficiaryData, 'beneficiaryId');
      listBeneficiaryId = beneficiaryData.beneficiaryId;

      // Set up account balance
      const balanceSetupResponse = await listWithdrawalUser.fetch(
        '/api/test/setup-account-balance-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: listWithdrawalUser.email,
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
            balance: '100000000000', // 100,000 in smallest unit
          }),
        },
      );
      ok([200, 201].includes(balanceSetupResponse.status), 'Balance setup should succeed');

      // Create multiple withdrawals using test endpoint
      for (let i = 0; i < 3; i++) {
        const withdrawalResponse = await listWithdrawalUser.fetch(
          '/api/test/create-withdrawal-by-email',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: listWithdrawalUser.email,
              beneficiaryId: listBeneficiaryId,
              amount: String((i + 1) * 1000000000), // 1000, 2000, 3000
              currencyBlockchainKey: 'eip155:56',
              currencyTokenId: 'slip44:714',
            }),
          },
        );
        ok(withdrawalResponse.ok, `Withdrawal ${i + 1} creation should succeed`);

        const withdrawalData = await withdrawalResponse.json();
        assertDefined(withdrawalData);
        assertPropNumber(withdrawalData, 'withdrawalId');
        withdrawalIds.push(withdrawalData.withdrawalId);
      }
    });

    it('should reject if not authenticated', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/withdrawals`);
      strictEqual(response.status, 401, 'Unauthenticated requests should be rejected');
    });

    it('should return empty array when user has no withdrawals', async function () {
      const noWithdrawalUser = await createTestUser({
        testId,
        testSetup,
        email: `no_withdrawal_${testId}@test.com`,
        userType: 'Individual',
      });

      const response = await noWithdrawalUser.fetch('/api/withdrawals');
      strictEqual(response.status, 200, 'Should successfully retrieve withdrawals');

      const responseData = await response.json();
      assertDefined(responseData);

      // Response structure: {withdrawals: [], pagination: {...}}
      assertPropArray(responseData, 'withdrawals');
      strictEqual(
        responseData.withdrawals.length,
        0,
        'Should return empty array for user with no withdrawals',
      );

      assertPropDefined(responseData, 'pagination');
      const pagination = responseData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      assertPropNumber(pagination, 'total');
      assertPropNumber(pagination, 'totalPages');
      assertPropDefined(pagination, 'hasNext');
      assertPropDefined(pagination, 'hasPrev');
      strictEqual(pagination.total, 0, 'Total should be 0 for user with no withdrawals');
    });

    it('should list withdrawals for authenticated user', async function () {
      const response = await listWithdrawalUser.fetch('/api/withdrawals');
      strictEqual(response.status, 200, 'Should successfully retrieve withdrawals');

      const responseData = await response.json();
      assertDefined(responseData);

      // Response structure: {withdrawals: [...], pagination: {...}}
      assertPropArray(responseData, 'withdrawals');
      strictEqual(responseData.withdrawals.length, 3, 'Should return 3 withdrawals from setup');

      // Verify withdrawal structure
      const withdrawal = responseData.withdrawals[0];
      assertDefined(withdrawal);
      assertPropNumber(withdrawal, 'id');
      assertPropDefined(withdrawal, 'currency');
      assertPropDefined(withdrawal, 'beneficiary');
      assertPropString(withdrawal, 'requestAmount');
      assertPropNullableString(withdrawal, 'sentAmount');
      assertPropNullableString(withdrawal, 'networkFee');
      assertPropNullableString(withdrawal, 'platformFee');
      assertPropString(withdrawal, 'requestDate');
      assertPropNullableString(withdrawal, 'sentDate');
      assertPropNullableString(withdrawal, 'sentHash');
      assertPropNullableString(withdrawal, 'confirmedDate');
      assertPropNullableString(withdrawal, 'failedDate');
      assertPropNullableString(withdrawal, 'failureReason');
      assertPropString(withdrawal, 'state');
      assertPropNullableString(withdrawal, 'blockchainExplorerUrl');
      assertPropNullableString(withdrawal, 'estimatedConfirmationTime');
    });

    it('should support pagination', async function () {
      const response = await listWithdrawalUser.fetch('/api/withdrawals?page=1&limit=2');
      strictEqual(response.status, 200, 'Should successfully retrieve withdrawals with pagination');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropArray(responseData, 'withdrawals');
      strictEqual(responseData.withdrawals.length, 2, 'Should return 2 withdrawals per page');

      assertPropDefined(responseData, 'pagination');
      const pagination = responseData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      assertPropNumber(pagination, 'total');
      assertPropNumber(pagination, 'totalPages');
      assertPropDefined(pagination, 'hasNext');
      assertPropDefined(pagination, 'hasPrev');

      strictEqual(pagination.page, 1, 'Page should be 1');
      strictEqual(pagination.limit, 2, 'Limit should be 2');
      ok(pagination.total >= 3, 'Total should be at least 3');
      strictEqual(pagination.hasPrev, false, 'First page should not have previous');
    });

    it('should filter withdrawals by state', async function () {
      const response = await listWithdrawalUser.fetch('/api/withdrawals?state=requested');
      strictEqual(response.status, 200, 'Should successfully filter withdrawals');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropArray(responseData, 'withdrawals');

      // Verify all withdrawals have 'requested' state
      for (const withdrawal of responseData.withdrawals) {
        assertDefined(withdrawal);
        assertPropString(withdrawal, 'state');
        strictEqual(withdrawal.state, 'requested', 'All withdrawals should have requested state');
      }
    });

    it('should return withdrawals in reverse chronological order', async function () {
      const response = await listWithdrawalUser.fetch('/api/withdrawals');
      strictEqual(response.status, 200);

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropArray(responseData, 'withdrawals');

      if (responseData.withdrawals.length >= 2) {
        const first = responseData.withdrawals[0];
        const second = responseData.withdrawals[1];
        assertDefined(first);
        assertDefined(second);
        assertPropString(first, 'requestDate');
        assertPropString(second, 'requestDate');

        const firstDate = new Date(first.requestDate).getTime();
        const secondDate = new Date(second.requestDate).getTime();

        ok(
          firstDate >= secondDate,
          'Withdrawals should be in reverse chronological order (newest first)',
        );
      }
    });
  });

  describe('GET /api/withdrawals/{withdrawalId}', function () {
    let detailWithdrawalUser: TestUser;
    let detailBeneficiaryId: string;
    let detailWithdrawalId: number;

    before(async function () {
      detailWithdrawalUser = await createTestUser({
        testId,
        testSetup,
        email: `detail_withdrawal_${testId}@test.com`,
        userType: 'Individual',
      });

      // Mark user as KYC verified
      const kycResponse = await detailWithdrawalUser.fetch('/api/test/mark-kyc-verified-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: detailWithdrawalUser.email,
        }),
      });
      ok(kycResponse.ok, 'KYC verification should succeed');

      // Create a beneficiary
      const beneficiaryResponse = await detailWithdrawalUser.fetch(
        '/api/test/create-beneficiary-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: detailWithdrawalUser.email,
            blockchainKey: 'eip155:56',
            address: '0x2222222222222222222222222222222222222222',
          }),
        },
      );
      ok(beneficiaryResponse.ok, 'Beneficiary creation should succeed');

      const beneficiaryData = await beneficiaryResponse.json();
      assertDefined(beneficiaryData);
      assertPropString(beneficiaryData, 'beneficiaryId');
      detailBeneficiaryId = beneficiaryData.beneficiaryId;

      // Set up account balance
      const balanceSetupResponse = await detailWithdrawalUser.fetch(
        '/api/test/setup-account-balance-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: detailWithdrawalUser.email,
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
            balance: '10000000000',
          }),
        },
      );
      ok([200, 201].includes(balanceSetupResponse.status), 'Balance setup should succeed');

      // Create a withdrawal
      const withdrawalResponse = await detailWithdrawalUser.fetch(
        '/api/test/create-withdrawal-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: detailWithdrawalUser.email,
            beneficiaryId: detailBeneficiaryId,
            amount: '5000000000',
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
          }),
        },
      );
      ok(withdrawalResponse.ok, 'Withdrawal creation should succeed');

      const withdrawalData = await withdrawalResponse.json();
      assertDefined(withdrawalData);
      assertPropNumber(withdrawalData, 'withdrawalId');
      detailWithdrawalId = withdrawalData.withdrawalId;
    });

    it('should reject if not authenticated', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/withdrawals/${detailWithdrawalId}`);
      strictEqual(response.status, 401, 'Unauthenticated requests should be rejected');
    });

    it('should return 404 for non-existent withdrawal', async function () {
      const response = await detailWithdrawalUser.fetch('/api/withdrawals/999999999');
      strictEqual(response.status, 404, 'Should return 404 for non-existent withdrawal');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      strictEqual(errorData.success, false);
    });

    it('should retrieve withdrawal details successfully', async function () {
      const response = await detailWithdrawalUser.fetch(`/api/withdrawals/${detailWithdrawalId}`);
      strictEqual(response.status, 200, 'Should successfully retrieve withdrawal details');

      const data = await response.json();
      assertDefined(data);

      // Verify complete withdrawal structure - response is the withdrawal object directly
      assertPropNumber(data, 'id');
      assertPropDefined(data, 'currency');
      assertPropDefined(data, 'beneficiary');
      assertPropString(data, 'requestAmount');
      assertPropNullableString(data, 'sentAmount');
      assertPropNullableString(data, 'networkFee');
      assertPropNullableString(data, 'platformFee');
      assertPropString(data, 'requestDate');
      assertPropNullableString(data, 'sentDate');
      assertPropNullableString(data, 'sentHash');
      assertPropNullableString(data, 'confirmedDate');
      assertPropNullableString(data, 'failedDate');
      assertPropNullableString(data, 'failureReason');
      assertPropString(data, 'state');
      assertPropNullableString(data, 'blockchainExplorerUrl');
      assertPropNullableString(data, 'estimatedConfirmationTime');

      strictEqual(data.id, detailWithdrawalId, 'ID should match requested withdrawal');

      // Verify currency details
      const currency = data.currency;
      assertPropString(currency, 'blockchainKey');
      assertPropString(currency, 'tokenId');
      assertPropString(currency, 'name');
      assertPropString(currency, 'symbol');
      assertPropNumber(currency, 'decimals');

      // Verify beneficiary details
      const beneficiary = data.beneficiary;
      assertPropNumber(beneficiary, 'id');
      assertPropString(beneficiary, 'blockchainKey');
      assertPropString(beneficiary, 'address');
      assertPropString(beneficiary, 'createdDate');
      assertPropNullableString(beneficiary, 'verifiedDate');
      assertPropDefined(beneficiary, 'isActive');
      assertPropDefined(beneficiary, 'blockchain');

      strictEqual(beneficiary.id, Number(detailBeneficiaryId), 'Beneficiary ID should match');

      // Verify date is valid
      ok(
        new Date(data.requestDate).toString() !== 'Invalid Date',
        'requestDate should be valid date',
      );
    });

    it('should not allow user to view another user withdrawal', async function () {
      const anotherUser = await createTestUser({
        testId,
        testSetup,
        email: `another_user_${testId}@test.com`,
        userType: 'Individual',
      });

      const response = await anotherUser.fetch(`/api/withdrawals/${detailWithdrawalId}`);
      strictEqual(response.status, 404, 'User should not be able to view another user withdrawal');
    });
  });

  describe('POST /api/withdrawals/{withdrawalId}/refund', function () {
    let refundUser: TestUser;
    let refundBeneficiaryId: string;
    let failedWithdrawalId: number;

    before(async function () {
      refundUser = await createTestUser({
        testId,
        testSetup,
        email: `refund_user_${testId}@test.com`,
        userType: 'Individual',
      });

      // Mark user as KYC verified
      const kycResponse = await refundUser.fetch('/api/test/mark-kyc-verified-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: refundUser.email,
        }),
      });
      ok(kycResponse.ok, 'KYC verification should succeed');

      // Create a beneficiary
      const beneficiaryResponse = await refundUser.fetch('/api/test/create-beneficiary-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: refundUser.email,
          blockchainKey: 'eip155:56',
          address: '0x3333333333333333333333333333333333333333',
        }),
      });
      ok(beneficiaryResponse.ok, 'Beneficiary creation should succeed');

      const beneficiaryData = await beneficiaryResponse.json();
      assertDefined(beneficiaryData);
      assertPropString(beneficiaryData, 'beneficiaryId');
      refundBeneficiaryId = beneficiaryData.beneficiaryId;

      // Set up account balance
      const balanceSetupResponse = await refundUser.fetch(
        '/api/test/setup-account-balance-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: refundUser.email,
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
            balance: '10000000000',
          }),
        },
      );
      ok([200, 201].includes(balanceSetupResponse.status), 'Balance setup should succeed');

      // Create a withdrawal
      const withdrawalResponse = await refundUser.fetch('/api/test/create-withdrawal-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: refundUser.email,
          beneficiaryId: refundBeneficiaryId,
          amount: '2500000000',
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
        }),
      });
      ok(withdrawalResponse.ok, 'Withdrawal creation should succeed');

      const withdrawalData = await withdrawalResponse.json();
      assertDefined(withdrawalData);
      assertPropNumber(withdrawalData, 'withdrawalId');
      failedWithdrawalId = withdrawalData.withdrawalId;

      // Mark withdrawal as failed using admin test endpoint
      const adminUser = await createTestUser({
        testId,
        testSetup,
        email: `admin_refund_${testId}@test.com`,
        role: 'admin',
      });

      const failResponse = await adminUser.fetch('/api/test/mark-withdrawal-as-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: failedWithdrawalId,
          failureReason: 'Network timeout during transaction processing',
        }),
      });
      ok(failResponse.ok, 'Should mark withdrawal as failed');
    });

    it('should reject if not authenticated', async function () {
      const response = await fetch(
        `${testSetup.backendUrl}/api/withdrawals/${failedWithdrawalId}/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Test refund request',
          }),
        },
      );
      strictEqual(response.status, 401, 'Unauthenticated requests should be rejected');
    });

    it('should return 404 for non-existent withdrawal', async function () {
      const response = await refundUser.fetch('/api/withdrawals/999999999/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Test refund request',
        }),
      });
      strictEqual(response.status, 404, 'Should return 404 for non-existent withdrawal');
    });

    it('should request refund successfully for failed withdrawal', async function () {
      const refundReason =
        'Transaction failed due to insufficient gas. Network congestion caused gas estimation to be inaccurate.';

      const response = await refundUser.fetch(`/api/withdrawals/${failedWithdrawalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: refundReason,
        }),
      });

      strictEqual(response.status, 200, 'Refund request should be submitted successfully');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true);

      assertPropDefined(responseData, 'message');
      assertPropString(responseData, 'message');

      // Validate all response fields from WithdrawalRefundRequestResponseDto
      assertPropString(responseData, 'withdrawalId');
      strictEqual(
        responseData.withdrawalId,
        String(failedWithdrawalId),
        'Withdrawal ID should match',
      );

      assertPropString(responseData, 'status');
      strictEqual(responseData.status, 'RefundRequested', 'Status should be RefundRequested');

      assertPropString(responseData, 'estimatedProcessingTime');
      ok(
        responseData.estimatedProcessingTime.length > 0,
        'Estimated processing time should be provided',
      );

      // Verify withdrawal state changed by fetching withdrawal details
      const detailsResponse = await refundUser.fetch(`/api/withdrawals/${failedWithdrawalId}`);
      strictEqual(detailsResponse.status, 200, 'Should successfully retrieve withdrawal details');

      const withdrawalDetails = await detailsResponse.json();
      assertDefined(withdrawalDetails);
      assertPropString(withdrawalDetails, 'state');
      strictEqual(
        withdrawalDetails.state,
        'refund_requested',
        'Withdrawal state should be refund_requested after refund request',
      );
    });

    it('should validate required reason field', async function () {
      const response = await refundUser.fetch(`/api/withdrawals/${failedWithdrawalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      strictEqual(response.status, 422, 'Should validate required reason field');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      strictEqual(errorData.success, false);
    });

    it('should reject empty reason', async function () {
      const response = await refundUser.fetch(`/api/withdrawals/${failedWithdrawalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: '',
        }),
      });

      strictEqual(response.status, 422, 'Should reject empty reason');
    });

    it('should reject reason shorter than 10 characters', async function () {
      const response = await refundUser.fetch(`/api/withdrawals/${failedWithdrawalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Too short', // 9 characters
        }),
      });

      strictEqual(response.status, 422, 'Should reject reason shorter than 10 characters');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      strictEqual(errorData.success, false);
    });

    it('should reject refund request for non-failed withdrawal', async function () {
      // Create another withdrawal that is not failed
      const balanceSetupResponse = await refundUser.fetch(
        '/api/test/setup-account-balance-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: refundUser.email,
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
            balance: '10000000000',
          }),
        },
      );
      ok([200, 201].includes(balanceSetupResponse.status), 'Balance setup should succeed');

      const withdrawalResponse = await refundUser.fetch('/api/test/create-withdrawal-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: refundUser.email,
          beneficiaryId: refundBeneficiaryId,
          amount: '1000000000',
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
        }),
      });
      ok(withdrawalResponse.ok, 'Withdrawal creation should succeed');

      const withdrawalData = await withdrawalResponse.json();
      assertDefined(withdrawalData);
      assertPropDefined(withdrawalData, 'withdrawalId');
      const nonFailedWithdrawalId = withdrawalData.withdrawalId;

      // Try to request refund for non-failed withdrawal
      const response = await refundUser.fetch(`/api/withdrawals/${nonFailedWithdrawalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Test refund for non-failed withdrawal',
        }),
      });

      ok(
        response.status === 400 || response.status === 422,
        'Should reject refund request for non-failed withdrawal',
      );
    });

    it('should reject duplicate refund request', async function () {
      // Create a new failed withdrawal for this test
      const balanceSetupResponse = await refundUser.fetch(
        '/api/test/setup-account-balance-by-email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: refundUser.email,
            currencyBlockchainKey: 'eip155:56',
            currencyTokenId: 'slip44:714',
            balance: '10000000000',
          }),
        },
      );
      ok([200, 201].includes(balanceSetupResponse.status), 'Balance setup should succeed');

      // Create withdrawal
      const withdrawalResponse = await refundUser.fetch('/api/test/create-withdrawal-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: refundUser.email,
          beneficiaryId: refundBeneficiaryId,
          amount: '1500000000',
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'slip44:714',
        }),
      });
      ok(withdrawalResponse.ok, 'Withdrawal creation should succeed');

      const withdrawalData = await withdrawalResponse.json();
      assertDefined(withdrawalData);
      assertPropDefined(withdrawalData, 'withdrawalId');
      const duplicateTestWithdrawalId = withdrawalData.withdrawalId;

      // Mark as failed
      const adminUser = await createTestUser({
        testId,
        testSetup,
        email: `admin_duplicate_${testId}@test.com`,
        role: 'admin',
      });

      const failResponse = await adminUser.fetch('/api/test/mark-withdrawal-as-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: duplicateTestWithdrawalId,
          failureReason: 'Network timeout for duplicate test',
        }),
      });
      ok(failResponse.ok, 'Should mark withdrawal as failed');

      // First refund request should succeed
      const firstRefundResponse = await refundUser.fetch(
        `/api/withdrawals/${duplicateTestWithdrawalId}/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'First refund request - network timeout issue',
          }),
        },
      );
      strictEqual(firstRefundResponse.status, 200, 'First refund request should succeed');

      // Second refund request should fail
      const secondRefundResponse = await refundUser.fetch(
        `/api/withdrawals/${duplicateTestWithdrawalId}/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Second refund request - should be rejected',
          }),
        },
      );
      ok(
        secondRefundResponse.status === 400 || secondRefundResponse.status === 422,
        'Second refund request should be rejected',
      );

      const errorData = await secondRefundResponse.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'success');
      strictEqual(errorData.success, false);
    });

    it('should not allow user to request refund for another user withdrawal', async function () {
      const anotherUser = await createTestUser({
        testId,
        testSetup,
        email: `another_refund_user_${testId}@test.com`,
        userType: 'Individual',
      });

      const response = await anotherUser.fetch(`/api/withdrawals/${failedWithdrawalId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Unauthorized refund request',
        }),
      });

      strictEqual(
        response.status,
        404,
        'User should not be able to request refund for another user withdrawal',
      );
    });
  });
});
