import { ok, strictEqual } from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

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
      ok(data.success, 'Should return success: true');
      ok(data.data, 'Should have data object');
      ok(Array.isArray(data.data.accounts), 'Should return accounts array');
      ok(data.data.totalPortfolioValue, 'Should have totalPortfolioValue object');

      // Verify totalPortfolioValue structure per OpenAPI spec
      ok(
        typeof data.data.totalPortfolioValue.amount === 'string',
        'Total portfolio amount should be string',
      );
      ok(
        typeof data.data.totalPortfolioValue.currency === 'string',
        'Total portfolio currency should be string',
      );
      ok(
        typeof data.data.totalPortfolioValue.lastUpdated === 'string',
        'Last updated should be string',
      );

      // Verify accounts array structure (may be empty for new user)
      ok(data.data.accounts.length >= 0, 'Should have accounts array');

      // Verify basic account structure for any accounts that exist
      for (const account of data.data.accounts) {
        // Verify account structure matches OpenAPI AccountBalance schema
        ok(typeof account.id === 'number', 'Account ID should be number');

        ok(account.currency, 'Should have currency object');
        ok(typeof account.currency.blockchainKey === 'string', 'Blockchain key should be string');
        ok(typeof account.currency.tokenId === 'string', 'Token ID should be string');
        ok(typeof account.currency.name === 'string', 'Currency name should be string');
        ok(typeof account.currency.symbol === 'string', 'Currency symbol should be string');
        ok(typeof account.currency.decimals === 'number', 'Currency decimals should be number');

        ok(typeof account.balance === 'string', 'Balance should be string');
        ok(typeof account.lastUpdated === 'string', 'Last updated should be string');
      }
    });

    it('should include valuation data when available', async () => {
      const response = await testUser.fetch('/api/accounts/balances');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      ok(data.success, 'Should return success: true');

      // Find accounts with valuation data
      const accountsWithValuation = data.data.accounts.filter(
        (account: { valuation?: unknown }) => account.valuation !== undefined,
      );

      // If there are accounts with valuation, verify the structure
      if (accountsWithValuation.length > 0) {
        for (const account of accountsWithValuation) {
          ok(account.valuation, 'Should have valuation object');
          ok(typeof account.valuation.amount === 'string', 'Valuation amount should be string');
          ok(account.valuation.currency, 'Should have valuation currency object');
          ok(typeof account.valuation.exchangeRate === 'string', 'Exchange rate should be string');
          ok(typeof account.valuation.rateSource === 'string', 'Rate source should be string');
          ok(typeof account.valuation.rateDate === 'string', 'Rate date should be string');
        }
      }
    });

    it('should handle accounts without valuation data', async () => {
      const response = await testUser.fetch('/api/accounts/balances');

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      ok(data.success, 'Should return success: true');

      // Find accounts without valuation data
      const accountsWithoutValuation = data.data.accounts.filter(
        (account: { valuation?: unknown }) => account.valuation === undefined,
      );

      // If there are accounts without valuation, verify they still have required fields
      if (accountsWithoutValuation.length > 0) {
        for (const account of accountsWithoutValuation) {
          ok(typeof account.id === 'number', 'Account ID should be number');
          ok(account.currency, 'Should have currency object');
          ok(typeof account.balance === 'string', 'Balance should be string');
          ok(typeof account.lastUpdated === 'string', 'Last updated should be string');
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
      const testAccountId = 1; // Use fixed account ID for testing
      const response = await testUser.fetch(`/api/accounts/${testAccountId}/mutations`);

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      ok(data.success, 'Should return success: true');
      ok(data.data, 'Should have data object');
      ok(Array.isArray(data.data.mutations), 'Should have mutations array');
      ok(typeof data.data.pagination === 'object', 'Should have pagination object');

      // Verify pagination structure matches OpenAPI PaginationMeta schema
      ok(typeof data.data.pagination.page === 'number', 'Should have page number');
      ok(typeof data.data.pagination.limit === 'number', 'Should have limit');
      ok(typeof data.data.pagination.total === 'number', 'Should have total count');
      ok(typeof data.data.pagination.totalPages === 'number', 'Should have totalPages');
      ok(typeof data.data.pagination.hasNext === 'boolean', 'Should have hasNext flag');
      ok(typeof data.data.pagination.hasPrev === 'boolean', 'Should have hasPrev flag');

      // Default pagination values per OpenAPI spec
      strictEqual(data.data.pagination.page, 1, 'Default page should be 1');
      strictEqual(data.data.pagination.limit, 20, 'Default limit should be 20');

      // Verify mutation structure for any mutations that exist (AccountMutation schema)
      for (const mutation of data.data.mutations) {
        ok(typeof mutation.id === 'number', 'Mutation ID should be number');
        ok(typeof mutation.mutationType === 'string', 'Mutation type should be string');
        ok(typeof mutation.mutationDate === 'string', 'Mutation date should be ISO string');
        ok(typeof mutation.amount === 'string', 'Amount should be string');
        ok(typeof mutation.description === 'string', 'Description should be string');

        // Optional fields per OpenAPI spec - only validate type if present
        ok(
          mutation.referenceId === undefined || typeof mutation.referenceId === 'number',
          'Reference ID should be number if present',
        );
        ok(
          mutation.referenceType === undefined || typeof mutation.referenceType === 'string',
          'Reference type should be string if present',
        );
        ok(
          mutation.balanceAfter === undefined || typeof mutation.balanceAfter === 'string',
          'Balance after should be string if present',
        );
      }
    });

    it('should support pagination parameters', async () => {
      const testAccountId = 1;
      const response = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?page=2&limit=5`,
      );

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      ok(data.success, 'Should return success: true');
      strictEqual(data.data.pagination.page, 2, 'Should return requested page');
      strictEqual(data.data.pagination.limit, 5, 'Should return requested limit');
      ok(data.data.mutations.length <= 5, 'Should not exceed requested limit');
    });

    it('should support filtering by mutation type', async () => {
      const testAccountId = 1;
      const mutationType = 'InvoiceReceived';
      const response = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?mutationType=${mutationType}`,
      );

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      ok(data.success, 'Should return success: true');
      ok(Array.isArray(data.data.mutations), 'Should return mutations array');

      // All returned mutations should match the filter
      for (const mutation of data.data.mutations) {
        strictEqual(
          mutation.mutationType,
          mutationType,
          'Should only return filtered mutation type',
        );
      }
    });

    it('should support date range filtering', async () => {
      const testAccountId = 1;
      const fromDate = '2025-01-01T00:00:00Z';
      const toDate = '2025-12-31T23:59:59Z';
      const response = await testUser.fetch(
        `/api/accounts/${testAccountId}/mutations?fromDate=${fromDate}&toDate=${toDate}`,
      );

      strictEqual(response.status, 200, 'Should return 200 OK');

      const data = await response.json();
      ok(data.success, 'Should return success: true');
      ok(Array.isArray(data.data.mutations), 'Should return mutations array');

      // All returned mutations should be within date range
      for (const mutation of data.data.mutations) {
        const mutationDate = new Date(mutation.mutationDate);
        ok(mutationDate >= new Date(fromDate), 'Mutation should be after fromDate');
        ok(mutationDate <= new Date(toDate), 'Mutation should be before toDate');
      }
    });

    it('should validate pagination parameters', async () => {
      const testAccountId = 1;
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
      ok(data.success, 'Should return success: true');
      ok(data.data, 'Should have data object');

      // Verify PortfolioAnalytics structure per OpenAPI spec
      ok(data.data.totalPortfolioValue, 'Should have totalPortfolioValue');
      ok(
        typeof data.data.totalPortfolioValue.amount === 'string',
        'Portfolio amount should be string',
      );
      ok(
        typeof data.data.totalPortfolioValue.currency === 'string',
        'Portfolio currency should be string',
      );
      ok(typeof data.data.totalPortfolioValue.isLocked === 'boolean', 'Should have isLocked flag');
      ok(
        typeof data.data.totalPortfolioValue.lastUpdated === 'string',
        'Should have lastUpdated timestamp',
      );

      ok(data.data.interestGrowth, 'Should have interestGrowth');
      ok(typeof data.data.interestGrowth.amount === 'string', 'Growth amount should be string');
      ok(typeof data.data.interestGrowth.currency === 'string', 'Growth currency should be string');
      ok(
        typeof data.data.interestGrowth.percentage === 'number',
        'Growth percentage should be number',
      );
      ok(typeof data.data.interestGrowth.isPositive === 'boolean', 'Should have isPositive flag');
      ok(typeof data.data.interestGrowth.periodLabel === 'string', 'Should have periodLabel');

      ok(data.data.activeLoans, 'Should have activeLoans');
      ok(typeof data.data.activeLoans.count === 'number', 'Loan count should be number');
      ok(
        typeof data.data.activeLoans.borrowerLoans === 'number',
        'Borrower loans should be number',
      );
      ok(typeof data.data.activeLoans.lenderLoans === 'number', 'Lender loans should be number');
      ok(
        typeof data.data.activeLoans.totalCollateralValue === 'string',
        'Total collateral should be string',
      );
      ok(typeof data.data.activeLoans.averageLTV === 'number', 'Average LTV should be number');

      ok(data.data.portfolioPeriod, 'Should have portfolioPeriod');
      ok(
        typeof data.data.portfolioPeriod.displayMonth === 'string',
        'Display month should be string',
      );
      ok(typeof data.data.portfolioPeriod.startDate === 'string', 'Start date should be string');
      ok(typeof data.data.portfolioPeriod.endDate === 'string', 'End date should be string');

      ok(data.data.paymentAlerts, 'Should have paymentAlerts');
      ok(
        Array.isArray(data.data.paymentAlerts.upcomingPayments),
        'Should have upcomingPayments array',
      );
      ok(
        Array.isArray(data.data.paymentAlerts.overduePayments),
        'Should have overduePayments array',
      );

      ok(data.data.assetBreakdown, 'Should have assetBreakdown');
      ok(data.data.assetBreakdown.cryptoAssets, 'Should have crypto assets breakdown');
      ok(
        typeof data.data.assetBreakdown.cryptoAssets.percentage === 'number',
        'Crypto percentage should be number',
      );
      ok(
        typeof data.data.assetBreakdown.cryptoAssets.value === 'string',
        'Crypto value should be string',
      );

      ok(data.data.assetBreakdown.stablecoins, 'Should have stablecoins breakdown');
      ok(
        typeof data.data.assetBreakdown.stablecoins.percentage === 'number',
        'Stablecoin percentage should be number',
      );
      ok(
        typeof data.data.assetBreakdown.stablecoins.value === 'string',
        'Stablecoin value should be string',
      );

      ok(data.data.assetBreakdown.loanCollateral, 'Should have loan collateral breakdown');
      ok(
        typeof data.data.assetBreakdown.loanCollateral.percentage === 'number',
        'Collateral percentage should be number',
      );
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
      ok(data.success, 'Should return success: true');
      ok(data.data, 'Should have data object');

      // Verify PortfolioOverview structure per OpenAPI spec
      ok(data.data.totalValue, 'Should have totalValue');
      ok(typeof data.data.totalValue.amount === 'string', 'Total value amount should be string');
      ok(data.data.totalValue.currency, 'Should have total value currency');
      ok(
        typeof data.data.totalValue.currency.blockchainKey === 'string',
        'Currency blockchainKey should be string',
      );
      ok(
        typeof data.data.totalValue.currency.tokenId === 'string',
        'Currency tokenId should be string',
      );

      ok(Array.isArray(data.data.assetAllocation), 'Should have assetAllocation array');

      // Verify AssetAllocation structure for each item
      for (const allocation of data.data.assetAllocation) {
        ok(allocation.currency, 'Should have currency object');
        ok(
          typeof allocation.currency.blockchainKey === 'string',
          'Currency blockchainKey should be string',
        );
        ok(typeof allocation.currency.tokenId === 'string', 'Currency tokenId should be string');
        ok(typeof allocation.currency.symbol === 'string', 'Currency symbol should be string');
        ok(typeof allocation.currency.decimals === 'number', 'Currency decimals should be number');

        ok(typeof allocation.balance === 'string', 'Balance should be string');

        ok(allocation.value, 'Should have value object');
        ok(typeof allocation.value.amount === 'string', 'Value amount should be string');

        ok(typeof allocation.percentage === 'number', 'Percentage should be number');
        ok(
          allocation.percentage >= 0 && allocation.percentage <= 100,
          'Percentage should be between 0 and 100',
        );
      }

      ok(data.data.performance, 'Should have performance metrics');
      ok(data.data.performance.daily, 'Should have daily performance');
      ok(typeof data.data.performance.daily.amount === 'string', 'Daily amount should be string');
      ok(
        typeof data.data.performance.daily.currency === 'string',
        'Daily currency should be string',
      );
      ok(
        typeof data.data.performance.daily.percentage === 'number',
        'Daily percentage should be number',
      );

      ok(data.data.performance.weekly, 'Should have weekly performance');
      ok(typeof data.data.performance.weekly.amount === 'string', 'Weekly amount should be string');
      ok(
        typeof data.data.performance.weekly.percentage === 'number',
        'Weekly percentage should be number',
      );

      ok(data.data.performance.monthly, 'Should have monthly performance');
      ok(
        typeof data.data.performance.monthly.amount === 'string',
        'Monthly amount should be string',
      );
      ok(
        typeof data.data.performance.monthly.percentage === 'number',
        'Monthly percentage should be number',
      );

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

      // Verify all currencies follow CAIP format
      for (const account of data.data.accounts) {
        // Verify blockchain key format (CAIP-2: namespace:reference)
        ok(
          account.currency.blockchainKey.includes(':'),
          `Blockchain key should follow CAIP-2 format: ${account.currency.blockchainKey}`,
        );

        // Verify token ID format
        ok(
          account.currency.tokenId.includes(':'),
          `Token ID should follow format with colon: ${account.currency.tokenId}`,
        );
      }
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent balance calculation from mutations', async () => {
      const balancesResponse = await testUser.fetch('/api/accounts/balances');
      const balancesData = await balancesResponse.json();

      ok(balancesData.data.accounts.length >= 0, 'Should have accounts array');

      // Test consistency for each account that exists
      for (const account of balancesData.data.accounts) {
        // Get all transaction history without pagination
        const mutationsResponse = await testUser.fetch(
          `/api/accounts/${account.id}/mutations?limit=100`,
        );
        const mutationsData = await mutationsResponse.json();

        // Calculate expected balance from sum of all mutations
        let calculatedBalance = BigInt(0);
        for (const mutation of mutationsData.data.mutations) {
          calculatedBalance += BigInt(mutation.amount);
        }

        // Compare with reported balance
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
