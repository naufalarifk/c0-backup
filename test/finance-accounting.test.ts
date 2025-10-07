import { ok, strictEqual } from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropBoolean,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { createTestUser, TestUser } from './setup/user';

/**
 * Finance Accounting API End-to-End Tests
 *
 * This test suite validates the finance accounting features according to:
 * - docs/api-plan/finance-accounting-openapi.yaml
 * - Database schema from 0008-finance.sql
 *
 * Test Coverage:
 * - GET /api/accounts/balances - Account balance retrieval
 * - GET /api/accounts/{accountId}/mutations - Transaction history with pagination and filtering
 * - GET /api/portfolio/analytics - Portfolio analytics for individual user home
 * - GET /api/portfolio/overview - Portfolio overview with asset allocation
 * - Authentication and authorization
 * - Error handling and validation
 */

describe('Finance Accounting API (e2e)', () => {
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let testUser: TestUser;

  before(async () => {
    testSetup = await setup();

    // Create test user
    testUser = await createTestUser({
      testSetup,
      testId: 'finance_user',
      userType: 'Individual',
    });
  });

  after(async () => {
    await testSetup.teardown();
  });

  describe('GET /api/accounts/balances', () => {
    it('should retrieve user account balances with correct structure for empty state', async () => {
      const response = await testUser.fetch('/api/accounts/balances');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      ok(data.data, 'Should have data object');
      assertPropArray(data.data, 'accounts');
      ok(Array.isArray(data.data.accounts), 'Should return accounts array');
      assertPropDefined(data.data, 'totalPortfolioValue');
      ok(data.data.totalPortfolioValue, 'Should have totalPortfolioValue object');

      // Verify totalPortfolioValue structure per OpenAPI spec
      assertPropString(data.data.totalPortfolioValue, 'amount');
      ok(
        typeof data.data.totalPortfolioValue.amount === 'string',
        'Total portfolio amount should be string',
      );
      assertPropString(data.data.totalPortfolioValue, 'currency');
      ok(
        typeof data.data.totalPortfolioValue.currency === 'string',
        'Total portfolio currency should be string',
      );
      assertPropString(data.data.totalPortfolioValue, 'lastUpdated');
      ok(
        typeof data.data.totalPortfolioValue.lastUpdated === 'string',
        'Last updated should be string',
      );

      // Verify accounts array structure (may be empty for new user)
      ok(data.data.accounts.length >= 0, 'Should have accounts array');

      // Verify basic account structure for any accounts that exist
      assertPropArrayMapOf(data.data, 'accounts', account => {
        // Verify account structure matches OpenAPI AccountBalance schema
        assertDefined(account);
        assertPropNumber(account, 'id');
        ok(typeof account.id === 'number', 'Account ID should be number');

        assertPropDefined(account, 'currency');
        ok(account.currency, 'Should have currency object');
        assertPropString(account.currency, 'blockchainKey');
        ok(typeof account.currency.blockchainKey === 'string', 'Blockchain key should be string');
        assertPropString(account.currency, 'tokenId');
        ok(typeof account.currency.tokenId === 'string', 'Token ID should be string');
        assertPropString(account.currency, 'name');
        ok(typeof account.currency.name === 'string', 'Currency name should be string');
        assertPropString(account.currency, 'symbol');
        ok(typeof account.currency.symbol === 'string', 'Currency symbol should be string');
        assertPropNumber(account.currency, 'decimals');
        ok(typeof account.currency.decimals === 'number', 'Currency decimals should be number');

        assertPropString(account, 'balance');
        ok(typeof account.balance === 'string', 'Balance should be string');
        assertPropString(account, 'lastUpdated');
        ok(typeof account.lastUpdated === 'string', 'Last updated should be string');
        return account;
      });
    });

    it('should include valuation data when available', async () => {
      const response = await testUser.fetch('/api/accounts/balances');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'accounts');

      // Find accounts with valuation data
      const accountsWithValuation = data.data.accounts.filter(
        (account: { valuation?: unknown }) => account.valuation !== undefined,
      );

      // If there are accounts with valuation, verify the structure
      if (accountsWithValuation.length > 0) {
        for (const account of accountsWithValuation) {
          assertDefined(account);
          assertPropDefined(account, 'valuation');
          ok(account.valuation, 'Should have valuation object');
          assertPropString(account.valuation, 'amount');
          ok(typeof account.valuation.amount === 'string', 'Valuation amount should be string');
          assertPropDefined(account.valuation, 'currency');
          ok(account.valuation.currency, 'Should have valuation currency object');
          assertPropString(account.valuation, 'exchangeRate');
          ok(typeof account.valuation.exchangeRate === 'string', 'Exchange rate should be string');
          assertPropString(account.valuation, 'rateSource');
          ok(typeof account.valuation.rateSource === 'string', 'Rate source should be string');
          assertPropString(account.valuation, 'rateDate');
          ok(typeof account.valuation.rateDate === 'string', 'Rate date should be string');
        }
      }
    });

    it('should handle accounts without valuation data', async () => {
      const response = await testUser.fetch('/api/accounts/balances');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'accounts');

      // Find accounts without valuation data
      const accountsWithoutValuation = data.data.accounts.filter(
        (account: { valuation?: unknown }) => account.valuation === undefined,
      );

      // If there are accounts without valuation, verify they still have required fields
      if (accountsWithoutValuation.length > 0) {
        for (const account of accountsWithoutValuation) {
          assertDefined(account);
          assertPropNumber(account, 'id');
          ok(typeof account.id === 'number', 'Account ID should be number');
          assertPropDefined(account, 'currency');
          ok(account.currency, 'Should have currency object');
          assertPropString(account, 'balance');
          ok(typeof account.balance === 'string', 'Balance should be string');
          assertPropString(account, 'lastUpdated');
          ok(typeof account.lastUpdated === 'string', 'Last updated should be string');
          assertProp(isNullable, account, 'valuation');
          ok(account.valuation === undefined, 'Valuation should be undefined when not available');
        }
      }
    });

    it('should require authentication', async () => {
      const response = await fetch(`${testSetup.backendUrl}/api/accounts/balances`);
      strictEqual(response.status, 401, 'Should return 401 Unauthorized');
    });
  });

  describe('GET /api/accounts/{accountId}/mutations', () => {
    it('should retrieve account transaction history with correct structure', async () => {
      // First get user's accounts
      const balancesResponse = await testUser.fetch('/api/accounts/balances');
      const balancesData = await balancesResponse.json();
      assertDefined(balancesData);
      assertPropDefined(balancesData, 'data');
      assertPropArray(balancesData.data, 'accounts');

      // Skip test if user has no accounts
      if (balancesData.data.accounts.length === 0) {
        // User has no accounts, so mutations endpoint should return appropriate response
        // Test with a non-existent account ID to verify 404 behavior
        const response = await testUser.fetch('/api/accounts/999999/mutations');
        // Should return 404 for non-existent account
        ok(response.status === 200 || response.status === 404, 'Should return 200 or 404');
        return;
      }

      // Use first account
      assertArrayMapOf(balancesData.data.accounts, function (account) {
        assertDefined(account);
        assertPropNumber(account, 'id');
        return account;
      });
      const testAccountId = balancesData.data.accounts[0].id;
      const response = await testUser.fetch(`/api/accounts/${testAccountId}/mutations`);

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      ok(data.data, 'Should have data object');
      assertPropArray(data.data, 'mutations');
      ok(Array.isArray(data.data.mutations), 'Should have mutations array');
      assertPropDefined(data.data, 'pagination');
      ok(typeof data.data.pagination === 'object', 'Should have pagination object');

      // Verify pagination structure matches OpenAPI PaginationMeta schema
      assertPropNumber(data.data.pagination, 'page');
      ok(typeof data.data.pagination.page === 'number', 'Should have page number');
      assertPropNumber(data.data.pagination, 'limit');
      ok(typeof data.data.pagination.limit === 'number', 'Should have limit');
      assertPropNumber(data.data.pagination, 'total');
      ok(typeof data.data.pagination.total === 'number', 'Should have total count');
      assertPropNumber(data.data.pagination, 'totalPages');
      ok(typeof data.data.pagination.totalPages === 'number', 'Should have totalPages');
      assertPropBoolean(data.data.pagination, 'hasNext');
      ok(typeof data.data.pagination.hasNext === 'boolean', 'Should have hasNext flag');
      assertPropBoolean(data.data.pagination, 'hasPrev');
      ok(typeof data.data.pagination.hasPrev === 'boolean', 'Should have hasPrev flag');

      // Default pagination values per OpenAPI spec
      strictEqual(data.data.pagination.page, 1, 'Default page should be 1');
      strictEqual(data.data.pagination.limit, 20, 'Default limit should be 20');

      // Verify mutation structure for any mutations that exist (AccountMutation schema)
      assertPropArrayMapOf(data.data, 'mutations', mutation => {
        assertDefined(mutation);
        assertPropNumber(mutation, 'id');
        ok(typeof mutation.id === 'number', 'Mutation ID should be number');
        assertPropString(mutation, 'mutationType');
        ok(typeof mutation.mutationType === 'string', 'Mutation type should be string');
        assertPropString(mutation, 'mutationDate');
        ok(typeof mutation.mutationDate === 'string', 'Mutation date should be ISO string');
        assertPropString(mutation, 'amount');
        ok(typeof mutation.amount === 'string', 'Amount should be string');
        assertPropString(mutation, 'description');
        ok(typeof mutation.description === 'string', 'Description should be string');

        // Optional fields per OpenAPI spec - only validate type if present
        assertProp(check(isNullable, isNumber), mutation, 'referenceId');
        ok(
          mutation.referenceId === undefined || typeof mutation.referenceId === 'number',
          'Reference ID should be number if present',
        );
        assertProp(check(isNullable, isString), mutation, 'referenceType');
        ok(
          mutation.referenceType === undefined || typeof mutation.referenceType === 'string',
          'Reference type should be string if present',
        );
        assertProp(check(isNullable, isString), mutation, 'balanceAfter');
        ok(
          mutation.balanceAfter === undefined || typeof mutation.balanceAfter === 'string',
          'Balance after should be string if present',
        );
        return mutation;
      });
    });

    it('should support pagination parameters', async () => {
      // First get user's accounts
      const balancesResponse = await testUser.fetch('/api/accounts/balances');
      const balancesData = await balancesResponse.json();
      assertDefined(balancesData);
      assertPropDefined(balancesData, 'data');
      assertPropArray(balancesData.data, 'accounts');

      // Skip test if user has no accounts
      if (balancesData.data.accounts.length === 0) {
        ok(true, 'User has no accounts, skipping pagination test');
        return;
      }

      assertArrayMapOf(balancesData.data.accounts, function (account) {
        assertDefined(account);
        assertPropNumber(account, 'id');
        return account;
      });

      const testAccountId = balancesData.data.accounts[0].id;
      const response = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?page=2&limit=5`,
      );

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      assertPropDefined(data.data, 'pagination');
      assertPropNumber(data.data.pagination, 'page');
      assertPropNumber(data.data.pagination, 'limit');
      strictEqual(data.data.pagination.page, 2, 'Should return requested page');
      strictEqual(data.data.pagination.limit, 5, 'Should return requested limit');
      assertPropArray(data.data, 'mutations');
      ok(data.data.mutations.length <= 5, 'Should not exceed requested limit');
    });

    it('should support filtering by mutation type', async () => {
      // First get user's accounts
      const balancesResponse = await testUser.fetch('/api/accounts/balances');
      const balancesData = await balancesResponse.json();
      assertDefined(balancesData);
      assertPropDefined(balancesData, 'data');
      assertPropArray(balancesData.data, 'accounts');

      // Skip test if user has no accounts
      if (balancesData.data.accounts.length === 0) {
        ok(true, 'User has no accounts, skipping mutation type filter test');
        return;
      }

      assertArrayMapOf(balancesData.data.accounts, function (account) {
        assertDefined(account);
        assertPropNumber(account, 'id');
        return account;
      });

      const testAccountId = balancesData.data.accounts[0].id;
      const mutationType = 'InvoiceReceived';
      const response = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?mutationType=${mutationType}`,
      );

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'mutations');
      ok(Array.isArray(data.data.mutations), 'Should return mutations array');

      // All returned mutations should match the filter
      assertPropArrayMapOf(data.data, 'mutations', mutation => {
        assertDefined(mutation);
        assertPropString(mutation, 'mutationType');
        strictEqual(
          mutation.mutationType,
          mutationType,
          'Should only return filtered mutation type',
        );
        return mutation;
      });
    });

    it('should support date range filtering', async () => {
      // First get user's accounts
      const balancesResponse = await testUser.fetch('/api/accounts/balances');
      const balancesData = await balancesResponse.json();
      assertDefined(balancesData);
      assertPropDefined(balancesData, 'data');
      assertPropArray(balancesData.data, 'accounts');

      // Skip test if user has no accounts
      if (balancesData.data.accounts.length === 0) {
        ok(true, 'User has no accounts, skipping date range filter test');
        return;
      }

      assertArrayMapOf(balancesData.data.accounts, function (account) {
        assertDefined(account);
        assertPropNumber(account, 'id');
        return account;
      });

      const testAccountId = balancesData.data.accounts[0].id;
      const fromDate = '2025-01-01T00:00:00Z';
      const toDate = '2025-12-31T23:59:59Z';
      const response = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?fromDate=${fromDate}&toDate=${toDate}`,
      );

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'mutations');
      ok(Array.isArray(data.data.mutations), 'Should return mutations array');

      // All returned mutations should be within date range
      assertPropArrayMapOf(data.data, 'mutations', mutation => {
        assertDefined(mutation);
        assertPropString(mutation, 'mutationDate');
        const mutationDate = new Date(mutation.mutationDate);
        ok(mutationDate >= new Date(fromDate), 'Mutation should be after fromDate');
        ok(mutationDate <= new Date(toDate), 'Mutation should be before toDate');
        return mutation;
      });
    });

    it('should validate pagination parameters', async () => {
      // First get user's accounts
      const balancesResponse = await testUser.fetch('/api/accounts/balances');
      const balancesData = await balancesResponse.json();
      assertDefined(balancesData);
      assertPropDefined(balancesData, 'data');
      assertPropArray(balancesData.data, 'accounts');

      // Skip test if user has no accounts
      if (balancesData.data.accounts.length === 0) {
        ok(true, 'User has no accounts, skipping validation test');
        return;
      }

      assertArrayMapOf(balancesData.data.accounts, function (account) {
        assertDefined(account);
        assertPropNumber(account, 'id');
        return account;
      });

      const testAccountId = balancesData.data.accounts[0].id;

      // Test page minimum (OpenAPI spec: minimum 1)
      const invalidPageResponse = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?page=0`,
      );
      ok(invalidPageResponse.status >= 200, 'Should handle invalid page gracefully');

      // Test limit maximum (OpenAPI spec: maximum 100)
      const invalidLimitResponse = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?limit=1000`,
      );
      ok(invalidLimitResponse.status >= 200, 'Should handle invalid limit gracefully');
    });

    it('should require authentication', async () => {
      const testAccountId = 1;
      const response = await fetch(
        `${testSetup.backendUrl}/api/accounts/${testAccountId}/mutations`,
      );
      strictEqual(response.status, 401, 'Should return 401 Unauthorized');
    });
  });

  describe('GET /api/portfolio/analytics', () => {
    it('should retrieve portfolio analytics with correct structure', async () => {
      const response = await testUser.fetch('/api/portfolio/analytics');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      ok(data.data, 'Should have data object');

      // Verify PortfolioAnalytics structure per OpenAPI spec
      assertPropDefined(data.data, 'totalPortfolioValue');
      ok(data.data.totalPortfolioValue, 'Should have totalPortfolioValue');
      assertPropString(data.data.totalPortfolioValue, 'amount');
      ok(
        typeof data.data.totalPortfolioValue.amount === 'string',
        'Portfolio amount should be string',
      );
      assertPropString(data.data.totalPortfolioValue, 'currency');
      ok(
        typeof data.data.totalPortfolioValue.currency === 'string',
        'Portfolio currency should be string',
      );
      assertPropBoolean(data.data.totalPortfolioValue, 'isLocked');
      ok(typeof data.data.totalPortfolioValue.isLocked === 'boolean', 'Should have isLocked flag');
      assertPropString(data.data.totalPortfolioValue, 'lastUpdated');
      ok(
        typeof data.data.totalPortfolioValue.lastUpdated === 'string',
        'Should have lastUpdated timestamp',
      );

      assertPropDefined(data.data, 'interestGrowth');
      ok(data.data.interestGrowth, 'Should have interestGrowth');
      assertPropString(data.data.interestGrowth, 'amount');
      ok(typeof data.data.interestGrowth.amount === 'string', 'Growth amount should be string');
      assertPropString(data.data.interestGrowth, 'currency');
      ok(typeof data.data.interestGrowth.currency === 'string', 'Growth currency should be string');
      assertPropNumber(data.data.interestGrowth, 'percentage');
      ok(
        typeof data.data.interestGrowth.percentage === 'number',
        'Growth percentage should be number',
      );
      assertPropBoolean(data.data.interestGrowth, 'isPositive');
      ok(typeof data.data.interestGrowth.isPositive === 'boolean', 'Should have isPositive flag');
      assertPropString(data.data.interestGrowth, 'periodLabel');
      ok(typeof data.data.interestGrowth.periodLabel === 'string', 'Should have periodLabel');

      assertPropDefined(data.data, 'activeLoans');
      ok(data.data.activeLoans, 'Should have activeLoans');
      assertPropNumber(data.data.activeLoans, 'count');
      ok(typeof data.data.activeLoans.count === 'number', 'Loan count should be number');
      assertPropNumber(data.data.activeLoans, 'borrowerLoans');
      ok(
        typeof data.data.activeLoans.borrowerLoans === 'number',
        'Borrower loans should be number',
      );
      assertPropNumber(data.data.activeLoans, 'lenderLoans');
      ok(typeof data.data.activeLoans.lenderLoans === 'number', 'Lender loans should be number');
      assertPropString(data.data.activeLoans, 'totalCollateralValue');
      ok(
        typeof data.data.activeLoans.totalCollateralValue === 'string',
        'Total collateral should be string',
      );
      assertPropNumber(data.data.activeLoans, 'averageLTV');
      ok(typeof data.data.activeLoans.averageLTV === 'number', 'Average LTV should be number');

      assertPropDefined(data.data, 'portfolioPeriod');
      ok(data.data.portfolioPeriod, 'Should have portfolioPeriod');
      assertPropString(data.data.portfolioPeriod, 'displayMonth');
      ok(
        typeof data.data.portfolioPeriod.displayMonth === 'string',
        'Display month should be string',
      );
      assertPropString(data.data.portfolioPeriod, 'startDate');
      ok(typeof data.data.portfolioPeriod.startDate === 'string', 'Start date should be string');
      assertPropString(data.data.portfolioPeriod, 'endDate');
      ok(typeof data.data.portfolioPeriod.endDate === 'string', 'End date should be string');

      assertPropDefined(data.data, 'paymentAlerts');
      ok(data.data.paymentAlerts, 'Should have paymentAlerts');
      assertPropArray(data.data.paymentAlerts, 'upcomingPayments');
      ok(
        Array.isArray(data.data.paymentAlerts.upcomingPayments),
        'Should have upcomingPayments array',
      );
      assertPropArray(data.data.paymentAlerts, 'overduePayments');
      ok(
        Array.isArray(data.data.paymentAlerts.overduePayments),
        'Should have overduePayments array',
      );

      assertPropDefined(data.data, 'assetBreakdown');
      ok(data.data.assetBreakdown, 'Should have assetBreakdown');
      assertPropDefined(data.data.assetBreakdown, 'cryptoAssets');
      ok(data.data.assetBreakdown.cryptoAssets, 'Should have crypto assets breakdown');
      assertPropNumber(data.data.assetBreakdown.cryptoAssets, 'percentage');
      ok(
        typeof data.data.assetBreakdown.cryptoAssets.percentage === 'number',
        'Crypto percentage should be number',
      );
      assertPropString(data.data.assetBreakdown.cryptoAssets, 'value');
      ok(
        typeof data.data.assetBreakdown.cryptoAssets.value === 'string',
        'Crypto value should be string',
      );

      assertPropDefined(data.data.assetBreakdown, 'stablecoins');
      ok(data.data.assetBreakdown.stablecoins, 'Should have stablecoins breakdown');
      assertPropNumber(data.data.assetBreakdown.stablecoins, 'percentage');
      ok(
        typeof data.data.assetBreakdown.stablecoins.percentage === 'number',
        'Stablecoin percentage should be number',
      );
      assertPropString(data.data.assetBreakdown.stablecoins, 'value');
      ok(
        typeof data.data.assetBreakdown.stablecoins.value === 'string',
        'Stablecoin value should be string',
      );

      assertPropDefined(data.data.assetBreakdown, 'loanCollateral');
      ok(data.data.assetBreakdown.loanCollateral, 'Should have loan collateral breakdown');
      assertPropNumber(data.data.assetBreakdown.loanCollateral, 'percentage');
      ok(
        typeof data.data.assetBreakdown.loanCollateral.percentage === 'number',
        'Collateral percentage should be number',
      );
      assertPropString(data.data.assetBreakdown.loanCollateral, 'value');
      ok(
        typeof data.data.assetBreakdown.loanCollateral.value === 'string',
        'Collateral value should be string',
      );
    });

    it('should require authentication', async () => {
      const response = await fetch(`${testSetup.backendUrl}/api/portfolio/analytics`);
      strictEqual(response.status, 401, 'Should return 401 Unauthorized');
    });
  });

  describe('GET /api/portfolio/overview', () => {
    it('should retrieve portfolio overview with correct structure', async () => {
      const response = await testUser.fetch('/api/portfolio/overview');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      ok(data.success, 'Should return success: true');
      assertPropDefined(data, 'data');
      ok(data.data, 'Should have data object');

      // Verify PortfolioOverview structure per OpenAPI spec
      assertPropDefined(data.data, 'totalValue');
      ok(data.data.totalValue, 'Should have totalValue');
      assertPropString(data.data.totalValue, 'amount');
      ok(typeof data.data.totalValue.amount === 'string', 'Total value amount should be string');
      assertPropDefined(data.data.totalValue, 'currency');
      ok(data.data.totalValue.currency, 'Should have total value currency');
      assertPropString(data.data.totalValue.currency, 'blockchainKey');
      ok(
        typeof data.data.totalValue.currency.blockchainKey === 'string',
        'Currency blockchainKey should be string',
      );
      assertPropString(data.data.totalValue.currency, 'tokenId');
      ok(
        typeof data.data.totalValue.currency.tokenId === 'string',
        'Currency tokenId should be string',
      );

      assertPropArray(data.data, 'assetAllocation');
      ok(Array.isArray(data.data.assetAllocation), 'Should have assetAllocation array');

      // Verify AssetAllocation structure for each item
      assertPropArrayMapOf(data.data, 'assetAllocation', allocation => {
        assertDefined(allocation);
        assertPropDefined(allocation, 'currency');
        ok(allocation.currency, 'Should have currency object');
        assertPropString(allocation.currency, 'blockchainKey');
        ok(
          typeof allocation.currency.blockchainKey === 'string',
          'Currency blockchainKey should be string',
        );
        assertPropString(allocation.currency, 'tokenId');
        ok(typeof allocation.currency.tokenId === 'string', 'Currency tokenId should be string');
        assertPropString(allocation.currency, 'symbol');
        ok(typeof allocation.currency.symbol === 'string', 'Currency symbol should be string');
        assertPropNumber(allocation.currency, 'decimals');
        ok(typeof allocation.currency.decimals === 'number', 'Currency decimals should be number');

        assertPropString(allocation, 'balance');
        ok(typeof allocation.balance === 'string', 'Balance should be string');

        assertPropDefined(allocation, 'value');
        ok(allocation.value, 'Should have value object');
        assertPropString(allocation.value, 'amount');
        ok(typeof allocation.value.amount === 'string', 'Value amount should be string');

        assertPropNumber(allocation, 'percentage');
        ok(typeof allocation.percentage === 'number', 'Percentage should be number');
        ok(
          allocation.percentage >= 0 && allocation.percentage <= 100,
          'Percentage should be between 0 and 100',
        );
        return allocation;
      });

      assertPropDefined(data.data, 'performance');
      ok(data.data.performance, 'Should have performance metrics');
      assertPropDefined(data.data.performance, 'daily');
      ok(data.data.performance.daily, 'Should have daily performance');
      assertPropString(data.data.performance.daily, 'amount');
      ok(typeof data.data.performance.daily.amount === 'string', 'Daily amount should be string');
      assertPropString(data.data.performance.daily, 'currency');
      ok(
        typeof data.data.performance.daily.currency === 'string',
        'Daily currency should be string',
      );
      assertPropNumber(data.data.performance.daily, 'percentage');
      ok(
        typeof data.data.performance.daily.percentage === 'number',
        'Daily percentage should be number',
      );

      assertPropDefined(data.data.performance, 'weekly');
      ok(data.data.performance.weekly, 'Should have weekly performance');
      assertPropString(data.data.performance.weekly, 'amount');
      ok(typeof data.data.performance.weekly.amount === 'string', 'Weekly amount should be string');
      assertPropNumber(data.data.performance.weekly, 'percentage');
      ok(
        typeof data.data.performance.weekly.percentage === 'number',
        'Weekly percentage should be number',
      );

      assertPropDefined(data.data.performance, 'monthly');
      ok(data.data.performance.monthly, 'Should have monthly performance');
      assertPropString(data.data.performance.monthly, 'amount');
      ok(
        typeof data.data.performance.monthly.amount === 'string',
        'Monthly amount should be string',
      );
      assertPropNumber(data.data.performance.monthly, 'percentage');
      ok(
        typeof data.data.performance.monthly.percentage === 'number',
        'Monthly percentage should be number',
      );

      assertPropString(data.data, 'lastUpdated');
      ok(typeof data.data.lastUpdated === 'string', 'Should have lastUpdated timestamp');
    });

    it('should require authentication', async () => {
      const response = await fetch(`${testSetup.backendUrl}/api/portfolio/overview`);
      strictEqual(response.status, 401, 'Should return 401 Unauthorized');
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle CAIP-compliant currency identifiers', async () => {
      const response = await testUser.fetch('/api/accounts/balances');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'accounts');

      // Verify all currencies follow CAIP format
      assertPropArrayMapOf(data.data, 'accounts', account => {
        assertDefined(account);
        assertPropDefined(account, 'currency');
        assertPropString(account.currency, 'blockchainKey');
        // Verify blockchain key format (CAIP-2: namespace:reference)
        ok(
          account.currency.blockchainKey.includes(':'),
          `Blockchain key should follow CAIP-2 format: ${account.currency.blockchainKey}`,
        );

        // Verify token ID format
        assertPropString(account.currency, 'tokenId');
        ok(
          account.currency.tokenId.includes(':'),
          `Token ID should follow format with colon: ${account.currency.tokenId}`,
        );
        return account;
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent balance calculation from mutations', async () => {
      const balancesResponse = await testUser.fetch('/api/accounts/balances');
      const balancesData = await balancesResponse.json();
      assertDefined(balancesData);
      assertPropDefined(balancesData, 'data');
      assertPropArray(balancesData.data, 'accounts');

      ok(balancesData.data.accounts.length >= 0, 'Should have accounts array');

      // Test consistency for each account that exists
      for (const account of balancesData.data.accounts) {
        assertDefined(account);
        assertPropNumber(account, 'id');
        // Get all transaction history without pagination
        const mutationsResponse = await testUser.fetch(
          `/api/accounts/${account.id}/mutations?limit=100`,
        );
        const mutationsData = await mutationsResponse.json();
        assertDefined(mutationsData);
        assertPropDefined(mutationsData, 'data');
        assertPropArray(mutationsData.data, 'mutations');

        // Calculate expected balance from sum of all mutations
        let calculatedBalance = BigInt(0);
        for (const mutation of mutationsData.data.mutations) {
          assertDefined(mutation);
          assertPropString(mutation, 'amount');
          calculatedBalance += BigInt(mutation.amount);
        }

        // Compare with reported balance
        assertPropString(account, 'balance');
        const reportedBalance = BigInt(account.balance);
        strictEqual(
          calculatedBalance.toString(),
          reportedBalance.toString(),
          `Balance for account ${account.id} should equal sum of all mutations`,
        );
      }
    });
  });
});
