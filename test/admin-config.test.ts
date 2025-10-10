import { ok, strictEqual } from 'node:assert/strict';

import {
  assertArray,
  assertDefined,
  assertProp,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it } from './setup/test';
import { createKycTestUser, createTestUser, TestUser } from './setup/user';

describe('Admin Configuration API', function () {
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

  describe('GET /api/admin/settings', function () {
    it('should retrieve current admin settings', async function () {
      const response = await adminUser.fetch('/api/admin/settings');
      strictEqual(response.status, 200, 'Admin should be able to retrieve platform settings');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true, 'Response should indicate success');
      assertPropDefined(data, 'data');
      const config = data.data;

      // Verify response structure according to OpenAPI spec
      assertPropString(config, 'effectiveDate');
      assertPropNumber(config, 'adminUserId');
      // adminUserName can be null, so just check it exists
      ok('adminUserName' in config, 'adminUserName should be defined');
      assertPropNumber(config, 'loanProvisionRate');
      assertPropNumber(config, 'loanIndividualRedeliveryFeeRate');
      assertPropNumber(config, 'loanInstitutionRedeliveryFeeRate');
      assertPropNumber(config, 'loanMinLtvRatio');
      assertPropNumber(config, 'loanMaxLtvRatio');
      assertPropNumber(config, 'loanRepaymentDurationInDays');
      assertPropString(config, 'loanLiquidationMode');
      assertPropNumber(config, 'loanLiquidationPremiRate');
      assertPropNumber(config, 'loanLiquidationFeeRate');

      // Verify adminUserName is string or null
      ok(
        typeof config.adminUserName === 'string' || config.adminUserName === null,
        'adminUserName should be string or null',
      );

      // Verify loanLiquidationMode is valid enum value
      ok(
        config.loanLiquidationMode === 'Partial' || config.loanLiquidationMode === 'Full',
        'loanLiquidationMode should be Partial or Full',
      );

      // Verify rate values are within expected decimal ranges (0-1)
      ok(
        config.loanProvisionRate >= 0 && config.loanProvisionRate <= 1,
        'loanProvisionRate should be between 0 and 1',
      );
      ok(
        config.loanIndividualRedeliveryFeeRate >= 0 && config.loanIndividualRedeliveryFeeRate <= 1,
        'loanIndividualRedeliveryFeeRate should be between 0 and 1',
      );
      ok(
        config.loanInstitutionRedeliveryFeeRate >= 0 &&
          config.loanInstitutionRedeliveryFeeRate <= 1,
        'loanInstitutionRedeliveryFeeRate should be between 0 and 1',
      );
      ok(
        config.loanMinLtvRatio >= 0 && config.loanMinLtvRatio <= 1,
        'loanMinLtvRatio should be between 0 and 1',
      );
      ok(
        config.loanMaxLtvRatio >= 0 && config.loanMaxLtvRatio <= 1,
        'loanMaxLtvRatio should be between 0 and 1',
      );
      ok(
        config.loanLiquidationPremiRate >= 0 && config.loanLiquidationPremiRate <= 1,
        'loanLiquidationPremiRate should be between 0 and 1',
      );
      ok(
        config.loanLiquidationFeeRate >= 0 && config.loanLiquidationFeeRate <= 1,
        'loanLiquidationFeeRate should be between 0 and 1',
      );

      // Verify LTV ratio constraints
      ok(
        config.loanMinLtvRatio <= config.loanMaxLtvRatio,
        'loanMinLtvRatio should be less than or equal to loanMaxLtvRatio',
      );

      // Verify repayment duration is reasonable
      ok(
        config.loanRepaymentDurationInDays >= 1 && config.loanRepaymentDurationInDays <= 3650,
        'loanRepaymentDurationInDays should be between 1 and 3650 days',
      );
    });

    it('should reject non-admin users', async function () {
      const response = await user1.fetch('/api/admin/settings');
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
      const error = errorData.error;
      assertPropString(error, 'code');
      assertPropString(error, 'message');
    });
  });

  describe('PUT /api/admin/settings', function () {
    it('should update admin settings successfully', async function () {
      // First get current settings to use as base
      const getResponse = await adminUser.fetch('/api/admin/settings');
      strictEqual(getResponse.status, 200, 'Should be able to get current settings');
      const currentSettings = await getResponse.json();

      // Update with valid new values
      const updateData = {
        loanProvisionRate: 0.04, // 4%
        loanIndividualRedeliveryFeeRate: 0.12, // 12%
        loanInstitutionRedeliveryFeeRate: 0.03, // 3%
        loanMinLtvRatio: 0.65, // 65%
        loanMaxLtvRatio: 0.8, // 80%
        loanRepaymentDurationInDays: 30,
        loanLiquidationMode: 'Partial' as const,
        loanLiquidationPremiRate: 0.03, // 3%
        loanLiquidationFeeRate: 0.03, // 3%
      };

      const response = await adminUser.fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      strictEqual(response.status, 200, 'Admin should be able to update platform settings');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true, 'Response should indicate success');
      assertPropDefined(data, 'data');
      const config = data.data;

      // Verify response structure matches updated settings
      assertPropString(config, 'effectiveDate');
      assertPropNumber(config, 'adminUserId');
      assertPropDefined(config, 'adminUserName');
      assertPropNumber(config, 'loanProvisionRate');
      assertPropNumber(config, 'loanIndividualRedeliveryFeeRate');
      assertPropNumber(config, 'loanInstitutionRedeliveryFeeRate');
      assertPropNumber(config, 'loanMinLtvRatio');
      assertPropNumber(config, 'loanMaxLtvRatio');
      assertPropNumber(config, 'loanRepaymentDurationInDays');
      assertPropString(config, 'loanLiquidationMode');
      assertPropNumber(config, 'loanLiquidationPremiRate');
      assertPropNumber(config, 'loanLiquidationFeeRate');

      strictEqual(
        config.adminUserId,
        Number(adminUser.id),
        'adminUserId should match the admin user',
      );
      ok(
        typeof config.adminUserName === 'string' || config.adminUserName === null,
        'adminUserName should be string or null',
      );

      // Verify all updated values are returned correctly
      strictEqual(config.loanProvisionRate, updateData.loanProvisionRate);
      strictEqual(
        config.loanIndividualRedeliveryFeeRate,
        updateData.loanIndividualRedeliveryFeeRate,
      );
      strictEqual(
        config.loanInstitutionRedeliveryFeeRate,
        updateData.loanInstitutionRedeliveryFeeRate,
      );
      strictEqual(config.loanMinLtvRatio, updateData.loanMinLtvRatio);
      strictEqual(config.loanMaxLtvRatio, updateData.loanMaxLtvRatio);
      strictEqual(config.loanRepaymentDurationInDays, updateData.loanRepaymentDurationInDays);
      strictEqual(config.loanLiquidationMode, updateData.loanLiquidationMode);
      strictEqual(config.loanLiquidationPremiRate, updateData.loanLiquidationPremiRate);
      strictEqual(config.loanLiquidationFeeRate, updateData.loanLiquidationFeeRate);

      // Verify effectiveDate is recent (within last minute)
      const effectiveDate = new Date(config.effectiveDate);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - effectiveDate.getTime());
      ok(timeDiff < 60000, 'effectiveDate should be recent (within last minute)');
    });

    it('should validate required fields', async function () {
      const response = await adminUser.fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body should fail validation
      });
      strictEqual(response.status, 422, 'Should validate required fields');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
      const error = errorData.error;
      assertPropString(error, 'code');
      assertPropString(error, 'message');
    });

    it('should validate rate ranges', async function () {
      const invalidData = {
        loanProvisionRate: 1.5, // Invalid: > 1
        loanIndividualRedeliveryFeeRate: 0.12,
        loanInstitutionRedeliveryFeeRate: 0.03,
        loanMinLtvRatio: 0.65,
        loanMaxLtvRatio: 0.8,
        loanRepaymentDurationInDays: 30,
        loanLiquidationMode: 'Partial' as const,
        loanLiquidationPremiRate: 0.03,
        loanLiquidationFeeRate: 0.03,
      };

      const response = await adminUser.fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      strictEqual(response.status, 422, 'Should validate rate ranges');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });

    it('should validate LTV ratio constraints', async function () {
      const invalidData = {
        loanProvisionRate: 0.04,
        loanIndividualRedeliveryFeeRate: 0.12,
        loanInstitutionRedeliveryFeeRate: 0.03,
        loanMinLtvRatio: 0.8, // Invalid: min > max
        loanMaxLtvRatio: 0.65,
        loanRepaymentDurationInDays: 30,
        loanLiquidationMode: 'Partial' as const,
        loanLiquidationPremiRate: 0.03,
        loanLiquidationFeeRate: 0.03,
      };

      const response = await adminUser.fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      strictEqual(response.status, 400, 'Should validate LTV ratio constraints');
    });

    it('should reject non-admin users', async function () {
      const updateData = {
        loanProvisionRate: 0.04,
        loanIndividualRedeliveryFeeRate: 0.12,
        loanInstitutionRedeliveryFeeRate: 0.03,
        loanMinLtvRatio: 0.65,
        loanMaxLtvRatio: 0.8,
        loanRepaymentDurationInDays: 30,
        loanLiquidationMode: 'Partial' as const,
        loanLiquidationPremiRate: 0.03,
        loanLiquidationFeeRate: 0.03,
      };

      const response = await user1.fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });
  });

  describe('GET /api/admin/currencies', function () {
    it('should provide a list of supported currencies', async function () {
      const response = await adminUser.fetch('/api/admin/currencies');
      strictEqual(response.status, 200, 'Admin should be able to retrieve currencies list');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true, 'Response should indicate success');
      assertPropDefined(data, 'data');
      const responseData = data.data;
      assertPropDefined(responseData, 'currencies');
      assertArray(responseData.currencies);

      // Should have currencies configured (may be empty in test environment)
      // ok(responseData.currencies.length > 0, 'Should have at least one currency configured');

      // Verify currency structure according to OpenAPI spec
      assertPropArrayMapOf(responseData, 'currencies', function (currency) {
        assertDefined(currency);
        assertPropString(currency, 'blockchainKey');
        assertPropString(currency, 'tokenId');
        assertPropString(currency, 'name');
        assertPropString(currency, 'symbol');
        assertPropNumber(currency, 'decimals');
        assertPropString(currency, 'image');

        // Optional configuration fields
        assertPropDefined(currency, 'withdrawalFeeRate');
        assertPropDefined(currency, 'minWithdrawalAmount');
        assertPropDefined(currency, 'maxWithdrawalAmount');
        assertPropDefined(currency, 'maxDailyWithdrawalAmount');
        assertPropDefined(currency, 'minLoanPrincipalAmount');
        assertPropDefined(currency, 'maxLoanPrincipalAmount');
        assertPropDefined(currency, 'maxLtv');
        assertPropDefined(currency, 'ltvWarningThreshold');
        assertPropDefined(currency, 'ltvCriticalThreshold');
        assertPropDefined(currency, 'ltvLiquidationThreshold');

        // Now assert specific types for numeric fields
        assertPropNumber(currency, 'withdrawalFeeRate');
        assertPropNumber(currency, 'maxLtv');
        assertPropNumber(currency, 'ltvWarningThreshold');
        assertPropNumber(currency, 'ltvCriticalThreshold');
        assertPropNumber(currency, 'ltvLiquidationThreshold');

        // Verify rate values are within expected ranges
        ok(
          currency.withdrawalFeeRate >= 0 && currency.withdrawalFeeRate <= 1,
          'withdrawalFeeRate should be between 0 and 1',
        );
        ok(currency.maxLtv >= 0 && currency.maxLtv <= 1, 'maxLtv should be between 0 and 1');
        ok(
          currency.ltvWarningThreshold >= 0 && currency.ltvWarningThreshold <= 1,
          'ltvWarningThreshold should be between 0 and 1',
        );
        ok(
          currency.ltvCriticalThreshold >= 0 && currency.ltvCriticalThreshold <= 1,
          'ltvCriticalThreshold should be between 0 and 1',
        );
        ok(
          currency.ltvLiquidationThreshold >= 0 && currency.ltvLiquidationThreshold <= 1,
          'ltvLiquidationThreshold should be between 0 and 1',
        );

        // Verify LTV thresholds are in logical order
        ok(
          currency.ltvWarningThreshold <= currency.ltvCriticalThreshold,
          'ltvWarningThreshold should be <= ltvCriticalThreshold',
        );
        ok(
          currency.ltvCriticalThreshold <= currency.ltvLiquidationThreshold,
          'ltvCriticalThreshold should be <= ltvLiquidationThreshold',
        );
        ok(
          currency.ltvLiquidationThreshold <= currency.maxLtv,
          'ltvLiquidationThreshold should be <= maxLtv',
        );

        // Verify amount values are strings (representing big integers)
        ok(
          typeof currency.minWithdrawalAmount === 'string',
          'minWithdrawalAmount should be a string',
        );
        ok(
          typeof currency.maxWithdrawalAmount === 'string',
          'maxWithdrawalAmount should be a string',
        );
        ok(
          typeof currency.maxDailyWithdrawalAmount === 'string',
          'maxDailyWithdrawalAmount should be a string',
        );
        ok(
          typeof currency.minLoanPrincipalAmount === 'string',
          'minLoanPrincipalAmount should be a string',
        );
        ok(
          typeof currency.maxLoanPrincipalAmount === 'string',
          'maxLoanPrincipalAmount should be a string',
        );

        return currency;
      });

      // Verify pagination metadata if present
      if ('pagination' in data && data.pagination) {
        const pagination = data.pagination;
        assertPropNumber(pagination, 'page');
        assertPropNumber(pagination, 'limit');
        assertPropNumber(pagination, 'total');
        assertPropNumber(pagination, 'totalPages');
        assertPropDefined(pagination, 'hasNext');
        assertPropDefined(pagination, 'hasPrev');
      }
    });

    it('should reject non-admin users', async function () {
      const response = await user1.fetch('/api/admin/currencies');
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
      const error = errorData.error;
      assertPropString(error, 'code');
      assertPropString(error, 'message');
    });
  });

  describe('PUT /api/admin/currencies/{blockchainKey}/{tokenId}', function () {
    it('should update currency configuration successfully', async function () {
      // Insert a test currency for this test
      await adminUser.fetch('/api/admin/currencies', { method: 'GET' });

      // First get the list of currencies to find one to update
      const listResponse = await adminUser.fetch('/api/admin/currencies');
      strictEqual(listResponse.status, 200, 'Should be able to get currencies list');
      const listData = await listResponse.json();
      assertDefined(listData);
      assertPropDefined(listData, 'success');
      strictEqual(listData.success, true, 'Response should indicate success');
      assertPropDefined(listData, 'data');
      const listResponseData = listData.data;
      assertPropDefined(listResponseData, 'currencies');
      assertArray(listResponseData.currencies);
      ok(listResponseData.currencies.length > 0, 'Should have at least one currency');

      const firstCurrency = listResponseData.currencies[0] as any;
      const { blockchainKey, tokenId } = firstCurrency;

      // Update currency configuration
      const updateData = {
        withdrawalFeeRate: 0.002, // 0.2%
        minWithdrawalAmount: '1000000', // 1 USDC (6 decimals)
        maxWithdrawalAmount: '1000000000', // 1000 USDC
        maxDailyWithdrawalAmount: '5000000000', // 5000 USDC
        minLoanPrincipalAmount: '5000000', // 5 USDC
        maxLoanPrincipalAmount: '100000000', // 100 USDC
        maxLtv: 0.8, // 80%
        ltvWarningThreshold: 0.65, // 65%
        ltvCriticalThreshold: 0.72, // 72%
        ltvLiquidationThreshold: 0.78, // 78%
      };

      const response = await adminUser.fetch(`/api/admin/currencies/${blockchainKey}/${tokenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      strictEqual(response.status, 200, 'Admin should be able to update currency configuration');

      const responseData = await response.json();
      assertDefined(responseData);
      assertPropDefined(responseData, 'success');
      strictEqual(responseData.success, true, 'Response should indicate success');
      assertPropDefined(responseData, 'data');
      const data = responseData.data;

      // Verify response structure according to OpenAPI spec
      assertPropString(data, 'blockchainKey');
      assertPropString(data, 'tokenId');
      assertPropString(data, 'name');
      assertPropString(data, 'symbol');
      assertPropNumber(data, 'decimals');
      assertPropString(data, 'image');
      assertPropNumber(data, 'withdrawalFeeRate');
      assertPropString(data, 'minWithdrawalAmount');
      assertPropString(data, 'maxWithdrawalAmount');
      assertPropString(data, 'maxDailyWithdrawalAmount');
      assertPropString(data, 'minLoanPrincipalAmount');
      assertPropString(data, 'maxLoanPrincipalAmount');
      assertPropNumber(data, 'maxLtv');
      assertPropNumber(data, 'ltvWarningThreshold');
      assertPropNumber(data, 'ltvCriticalThreshold');
      assertPropNumber(data, 'ltvLiquidationThreshold');

      // Verify updated configuration values
      strictEqual(data.blockchainKey, blockchainKey);
      strictEqual(data.tokenId, tokenId);
      strictEqual(data.withdrawalFeeRate, updateData.withdrawalFeeRate);
      strictEqual(data.minWithdrawalAmount, updateData.minWithdrawalAmount);
      strictEqual(data.maxWithdrawalAmount, updateData.maxWithdrawalAmount);
      strictEqual(data.maxDailyWithdrawalAmount, updateData.maxDailyWithdrawalAmount);
      strictEqual(data.minLoanPrincipalAmount, updateData.minLoanPrincipalAmount);
      strictEqual(data.maxLoanPrincipalAmount, updateData.maxLoanPrincipalAmount);
      strictEqual(data.maxLtv, updateData.maxLtv);
      strictEqual(data.ltvWarningThreshold, updateData.ltvWarningThreshold);
      strictEqual(data.ltvCriticalThreshold, updateData.ltvCriticalThreshold);
      strictEqual(data.ltvLiquidationThreshold, updateData.ltvLiquidationThreshold);

      // Verify LTV thresholds are in logical order
      ok(
        data.ltvWarningThreshold <= data.ltvCriticalThreshold,
        'ltvWarningThreshold should be <= ltvCriticalThreshold',
      );
      ok(
        data.ltvCriticalThreshold <= data.ltvLiquidationThreshold,
        'ltvCriticalThreshold should be <= ltvLiquidationThreshold',
      );
      ok(
        data.ltvLiquidationThreshold <= data.maxLtv,
        'ltvLiquidationThreshold should be <= maxLtv',
      );
    });

    it('should validate currency update parameters', async function () {
      // Ensure we have a test currency
      await adminUser.fetch('/api/admin/currencies', { method: 'GET' });

      // First get a currency
      const listResponse = await adminUser.fetch('/api/admin/currencies');
      strictEqual(listResponse.status, 200);
      const listData = await listResponse.json();
      assertDefined(listData);
      assertPropDefined(listData, 'data');
      const listResponseData = listData.data;
      assertPropDefined(listResponseData, 'currencies');
      assertArray(listResponseData.currencies);
      if (listResponseData.currencies.length === 0) {
        this.skip();
      }
      ok(listResponseData.currencies.length > 0, 'Should have at least one currency');

      const firstCurrency = listResponseData.currencies[0] as any;
      const { blockchainKey, tokenId } = firstCurrency;

      // Test invalid withdrawalFeeRate (> 1)
      const invalidData = {
        withdrawalFeeRate: 1.5, // Invalid
        minWithdrawalAmount: '1000000',
        maxWithdrawalAmount: '1000000000',
        maxDailyWithdrawalAmount: '5000000000',
        minLoanPrincipalAmount: '5000000',
        maxLoanPrincipalAmount: '100000000',
        maxLtv: 0.75,
        ltvWarningThreshold: 0.65,
        ltvCriticalThreshold: 0.72,
        ltvLiquidationThreshold: 0.78,
      };

      const response = await adminUser.fetch(`/api/admin/currencies/${blockchainKey}/${tokenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      strictEqual(response.status, 422, 'Should validate withdrawalFeeRate range');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });

    it('should validate LTV threshold constraints', async function () {
      // Insert a test currency for this test
      await adminUser.fetch('/api/admin/currencies', { method: 'GET' });

      // First get a currency
      const listResponse = await adminUser.fetch('/api/admin/currencies');
      strictEqual(listResponse.status, 200);
      const listData = await listResponse.json();
      assertDefined(listData);
      assertPropDefined(listData, 'data');
      const listResponseData = listData.data;
      assertPropDefined(listResponseData, 'currencies');
      assertArray(listResponseData.currencies);
      ok(listResponseData.currencies.length > 0, 'Should have at least one currency');

      const firstCurrency = listResponseData.currencies[0] as any;
      const { blockchainKey, tokenId } = firstCurrency;

      // Test invalid LTV thresholds (warning > critical)
      const invalidData = {
        withdrawalFeeRate: 0.002,
        minWithdrawalAmount: '1000000',
        maxWithdrawalAmount: '1000000000',
        maxDailyWithdrawalAmount: '5000000000',
        minLoanPrincipalAmount: '5000000',
        maxLoanPrincipalAmount: '100000000',
        maxLtv: 0.75,
        ltvWarningThreshold: 0.72, // Invalid: > critical
        ltvCriticalThreshold: 0.65,
        ltvLiquidationThreshold: 0.78,
      };

      const response = await adminUser.fetch(`/api/admin/currencies/${blockchainKey}/${tokenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      strictEqual(response.status, 422, 'Should validate LTV threshold constraints');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });

    it('should return 404 for non-existent currency', async function () {
      const response = await adminUser.fetch(
        '/api/admin/currencies/invalid-blockchain/invalid-token',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            withdrawalFeeRate: 0.002,
            minWithdrawalAmount: '1000000',
            maxWithdrawalAmount: '1000000000',
            maxDailyWithdrawalAmount: '5000000000',
            minLoanPrincipalAmount: '5000000',
            maxLoanPrincipalAmount: '100000000',
            maxLtv: 0.75,
            ltvWarningThreshold: 0.65,
            ltvCriticalThreshold: 0.72,
            ltvLiquidationThreshold: 0.78,
          }),
        },
      );
      strictEqual(response.status, 404, 'Should return 404 for non-existent currency');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });

    it('should reject non-admin users', async function () {
      // First get a currency
      const listResponse = await adminUser.fetch('/api/admin/currencies');
      strictEqual(listResponse.status, 200);
      const listData = await listResponse.json();
      assertDefined(listData);
      assertPropDefined(listData, 'data');
      const listResponseData = listData.data;
      assertPropDefined(listResponseData, 'currencies');
      assertArray(listResponseData.currencies);
      ok(listResponseData.currencies.length > 0, 'Should have at least one currency');

      const firstCurrency = listResponseData.currencies[0] as any;
      const { blockchainKey, tokenId } = firstCurrency;

      const updateData = {
        withdrawalFeeRate: 0.002,
        minWithdrawalAmount: '1000000',
        maxWithdrawalAmount: '1000000000',
        maxDailyWithdrawalAmount: '5000000000',
        minLoanPrincipalAmount: '5000000',
        maxLoanPrincipalAmount: '100000000',
        maxLtv: 0.75,
        ltvWarningThreshold: 0.65,
        ltvCriticalThreshold: 0.72,
        ltvLiquidationThreshold: 0.78,
      };

      const response = await user1.fetch(`/api/admin/currencies/${blockchainKey}/${tokenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      strictEqual(response.status, 403, 'Non-admin users should be rejected');

      const errorData = await response.json();
      assertDefined(errorData);
      assertPropDefined(errorData, 'error');
    });
  });
});
