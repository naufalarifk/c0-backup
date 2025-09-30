import { deepStrictEqual, doesNotReject, ok, rejects, strictEqual } from 'node:assert/strict';

import {
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

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createInstitutionTestUser, createTestUser } from './setup/user';

// Helper function to seed exchange rate data for tests
async function seedExchangeRateData(testSetup: Awaited<ReturnType<typeof setup>>) {
  // Set up exchange rates for test currencies via direct API calls
  const exchangeRates = [
    {
      baseCurrency: 'slip44:60', // ETH
      quoteCurrency: 'iso4217:usd',
      bidPrice: 2100,
      askPrice: 2110,
    },
    {
      baseCurrency: 'slip44:0', // BTC
      quoteCurrency: 'iso4217:usd',
      bidPrice: 60000,
      askPrice: 60100,
    },
    {
      baseCurrency: 'slip44:501', // SOL
      quoteCurrency: 'iso4217:usd',
      bidPrice: 150,
      askPrice: 151,
    },
  ];

  // Use direct fetch calls to the test seeding endpoint
  for (const rate of exchangeRates) {
    const response = await fetch(`${testSetup.backendUrl}/api/admin/seed-exchange-rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockchainKey: 'crosschain',
        baseCurrencyTokenId: rate.baseCurrency,
        quoteCurrencyTokenId: rate.quoteCurrency,
        source: 'test',
        bidPrice: rate.bidPrice,
        askPrice: rate.askPrice,
        sourceDate: new Date().toISOString(),
      }),
    });

    strictEqual(response.status, 201, `Failed to seed exchange rate for ${rate.baseCurrency}`);
  }
}

const ERROR_CODES = {
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  CURRENCY_NOT_SUPPORTED: 'CURRENCY_NOT_SUPPORTED',
  AMOUNT_OUT_OF_BOUNDS: 'AMOUNT_OUT_OF_BOUNDS',
  INTEREST_RATE_INVALID: 'INTEREST_RATE_INVALID',
  TERM_NOT_SUPPORTED: 'TERM_NOT_SUPPORTED',
  KYC_VERIFICATION_REQUIRED: 'KYC_VERIFICATION_REQUIRED',
  COLLATERAL_INSUFFICIENT: 'COLLATERAL_INSUFFICIENT',
};

suite('Loan Market API', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('Loan Applications - Calculate', function () {
    let borrower: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      // Seed exchange rate data first
      await seedExchangeRateData(testSetup);

      borrower = await createTestUser({
        testSetup,
        testId,
        email: `calculate_borrower_${testId}@test.com`,
        name: 'Calculate Borrower',
        userType: 'Individual',
      });
    });

    it('should calculate loan requirements with ETH collateral successfully', async function () {
      const calculationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '10000.000000000000000000',
        loanTerm: 6,
      };

      const response = await borrower.fetch('/api/loan-applications/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculationData),
      });

      const data = await response.json();

      strictEqual(response.status, 200);
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const calculationResult = data.data;
      assertPropString(calculationResult, 'requiredCollateralAmount');
      assertPropString(calculationResult, 'exchangeRate');
      assertPropDefined(calculationResult, 'collateralCurrency');
      assertPropDefined(calculationResult, 'principalCurrency');
      assertPropNumber(calculationResult, 'maxLtvRatio');

      // Verify maxLtvRatio is within valid range (0-1) per SRS BR-005 (70% LTV)
      ok(calculationResult.maxLtvRatio > 0 && calculationResult.maxLtvRatio <= 1);

      // Verify safetyBuffer if present
      assertPropNumber(calculationResult, 'safetyBuffer');
      ok(calculationResult.safetyBuffer >= 0);

      assertPropDefined(calculationResult, 'calculationDetails');

      const details = calculationResult.calculationDetails;
      assertPropString(details, 'baseLoanAmount');
      assertPropString(details, 'baseCollateralValue');
      assertPropString(details, 'withSafetyBuffer');
      assertPropString(details, 'currentExchangeRate');
      assertPropString(details, 'rateSource');
      assertPropString(details, 'rateTimestamp');

      // Verify currency objects
      const collateralCurrency = calculationResult.collateralCurrency;
      assertPropString(collateralCurrency, 'blockchainKey');
      assertPropString(collateralCurrency, 'tokenId');
      assertPropString(collateralCurrency, 'name');
      assertPropString(collateralCurrency, 'symbol');
      assertPropNumber(collateralCurrency, 'decimals');
      strictEqual(collateralCurrency.symbol, 'ETH');

      const principalCurrency = calculationResult.principalCurrency;
      assertPropString(principalCurrency, 'symbol');
      strictEqual(principalCurrency.symbol, 'USDC');

      // Verify logoUrl if present (per OpenAPI spec)
      assertPropString(principalCurrency, 'logoUrl');
      ok(principalCurrency.logoUrl.startsWith('http'));
    });

    it('should calculate loan requirements with BTC collateral successfully', async function () {
      const calculationData = {
        collateralBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
        collateralTokenId: 'slip44:0',
        principalAmount: '15000.000000000000000000',
        loanTerm: 12,
      };

      const response = await borrower.fetch('/api/loan-applications/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculationData),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');

      const calculationResult = data.data;
      assertPropDefined(calculationResult, 'collateralCurrency');
      const collateralCurrency = calculationResult.collateralCurrency;
      assertDefined(collateralCurrency);
      assertPropString(collateralCurrency, 'symbol');
      assertPropNumber(collateralCurrency, 'decimals');
      strictEqual(collateralCurrency.symbol, 'BTC');
      strictEqual(collateralCurrency.decimals, 8);
    });

    it('should return 422 for missing required fields', async function () {
      const response = await borrower.fetch('/api/loan-applications/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 for unauthenticated request', async function () {
      const calculationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '10000.000000000000000000',
      };

      const response = await fetch(`${testSetup.backendUrl}/api/loan-applications/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculationData),
      });

      strictEqual(response.status, 401);
    });
  });

  describe('Loan Applications - Create', function () {
    let borrower: Awaited<ReturnType<typeof createTestUser>>;
    let otherBorrower: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      borrower = await createTestUser({
        testSetup,
        testId,
        email: `create_app_borrower_${testId}@test.com`,
        name: 'Create App Borrower',
        userType: 'Individual',
      });

      otherBorrower = await createTestUser({
        testSetup,
        testId,
        email: `create_app_other_${testId}@test.com`,
        name: 'Other Borrower',
        userType: 'Individual',
      });
    });

    it('should create loan application with ETH collateral successfully', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      const data = await response.json();

      ok(response.ok, `Response not OK: ${response.status} - ${JSON.stringify(data)}`);

      strictEqual(response.status, 201);
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const application = data.data;
      assertPropString(application, 'id');
      assertPropString(application, 'borrowerId');
      assertPropDefined(application, 'collateralCurrency');
      assertPropString(application, 'principalAmount');
      assertProp(v => v === 'PendingCollateral' || v === 'Draft', application, 'status');
      assertPropString(application, 'createdDate');
      assertPropString(application, 'expiryDate');

      // Verify collateral currency
      const collateralCurrency = application.collateralCurrency;
      assertPropString(collateralCurrency, 'symbol');
      strictEqual(collateralCurrency.symbol, 'ETH');

      // Verify collateral invoice if present
      ok('collateralInvoice' in application, 'collateralInvoice should be present');

      const invoice = application.collateralInvoice;
      assertPropString(invoice, 'id');
      assertPropString(invoice, 'amount');
      assertPropDefined(invoice, 'currency');
      assertPropString(invoice, 'walletAddress');
      assertPropString(invoice, 'expiryDate');
    });

    it('should create loan application with BTC collateral successfully', async function () {
      const applicationData = {
        collateralBlockchainKey: 'bip122:000000000019d6689c085ae165831e93',
        collateralTokenId: 'slip44:0',
        principalAmount: '18000.000000000000000000',
        maxInterestRate: 12.0,
        termMonths: 12,
        liquidationMode: 'Partial',
        minLtvRatio: 0.4,
      };

      const response = await otherBorrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      strictEqual(response.status, 201);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');

      const application = data.data;
      assertPropDefined(application, 'collateralCurrency');
      const collateralCurrency = application.collateralCurrency;
      assertDefined(collateralCurrency);
      assertPropString(collateralCurrency, 'symbol');
      strictEqual(collateralCurrency.symbol, 'BTC');
    });

    it('should create loan application with SOL collateral successfully', async function () {
      const applicationData = {
        collateralBlockchainKey: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        collateralTokenId: 'slip44:501',
        principalAmount: '2000.000000000000000000',
        maxInterestRate: 18.0,
        termMonths: 1,
        liquidationMode: 'Full',
        minLtvRatio: 0.3,
      };

      const response = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      strictEqual(response.status, 201);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');

      const application = data.data;
      assertPropDefined(application, 'collateralCurrency');
      const collateralCurrency = application.collateralCurrency;
      assertDefined(collateralCurrency);
      assertPropString(collateralCurrency, 'symbol');
      strictEqual(collateralCurrency.symbol, 'SOL');
    });

    it('should return 422 for invalid principal amount format', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: 'invalid-amount', // Invalid format
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 for invalid term months', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        maxInterestRate: 15.0,
        termMonths: 24, // Invalid - not in enum [1, 3, 6, 12]
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 for missing required fields', async function () {
      const response = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 for unauthenticated request', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await fetch(`${testSetup.backendUrl}/api/loan-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      strictEqual(response.status, 401);
    });
  });

  describe('Loan Applications - List', function () {
    let _borrower: Awaited<ReturnType<typeof createTestUser>>;
    let lender: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      _borrower = await createTestUser({
        testSetup,
        testId,
        email: `list_apps_borrower_${testId}@test.com`,
        name: 'List Apps Borrower',
        userType: 'Individual',
      });

      lender = await createTestUser({
        testSetup,
        testId,
        email: `list_apps_lender_${testId}@test.com`,
        name: 'List Apps Lender',
        userType: 'Individual',
      });
    });

    it('should list published loan applications successfully', async function () {
      const response = await lender.fetch('/api/loan-applications');

      const data = await response.json();

      strictEqual(response.status, 200);
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const responseData = data.data;
      assertPropArray(responseData, 'applications');
      assertPropDefined(responseData, 'pagination');

      const pagination = responseData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      assertPropNumber(pagination, 'total');
      assertPropNumber(pagination, 'totalPages');
      assertProp(v => typeof v === 'boolean', pagination, 'hasNext');
      assertProp(v => typeof v === 'boolean', pagination, 'hasPrev');

      ok(responseData.applications.length <= pagination.limit);

      assertPropArrayMapOf(responseData, 'applications', application => {
        assertDefined(application);
        assertPropString(application, 'id');
        assertPropString(application, 'borrowerId');
        assertPropDefined(application, 'borrower');
        assertPropDefined(application, 'collateralCurrency');
        assertPropDefined(application, 'principalCurrency');
        assertPropString(application, 'principalAmount');
        assertPropNumber(application, 'maxInterestRate');
        assertPropNumber(application, 'termMonths');
        assertProp(v => v === 'Partial' || v === 'Full', application, 'liquidationMode');
        assertProp(v => v === 'Published', application, 'status'); // Only published should be listed
        assertPropString(application, 'createdDate');
        assertPropString(application, 'expiryDate');

        assertPropString(application, 'publishedDate');

        // Verify borrower info
        const borrower = application.borrower;
        assertPropString(borrower, 'id');
        assertPropString(borrower, 'type');
        assertPropString(borrower, 'name');

        return application;
      });
    });

    it('should filter applications by collateral currency', async function () {
      const response = await lender.fetch(
        '/api/loan-applications?collateralBlockchainKey=eip155:1&collateralTokenId=slip44:60',
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'applications');

      ok(data.data.applications.length > 0, 'Expected zero or more applications');

      data.data.applications.forEach(app => {
        assertDefined(app);
        assertPropDefined(app, 'collateralCurrency');
        assertPropString(app.collateralCurrency, 'symbol');
        strictEqual(app.collateralCurrency.symbol, 'ETH');
      });
    });

    it('should filter applications by principal amount range', async function () {
      const response = await lender.fetch(
        '/api/loan-applications?minPrincipalAmount=1000&maxPrincipalAmount=10000',
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'applications');
    });

    it('should filter applications by liquidation mode', async function () {
      const response = await lender.fetch('/api/loan-applications?liquidationMode=Full');

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'applications');

      ok(data.data.applications.length > 0, 'Expected applications');

      data.data.applications.forEach(app => {
        assertDefined(app);
        assertPropString(app, 'liquidationMode');
        strictEqual(app.liquidationMode, 'Full');
      });
    });

    it('should support pagination', async function () {
      const response = await lender.fetch('/api/loan-applications?page=1&limit=10');

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropDefined(data.data, 'pagination');

      const pagination = data.data.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      strictEqual(pagination.page, 1);
      strictEqual(pagination.limit, 10);
      assertPropArray(data.data, 'applications');
      ok(data.data.applications.length <= 10);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/loan-applications`);
      strictEqual(response.status, 401);
    });
  });

  describe('Loan Applications - My Applications', function () {
    let borrower: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      borrower = await createTestUser({
        testSetup,
        testId,
        email: `my_apps_borrower_${testId}@test.com`,
        name: 'My Apps Borrower',
        userType: 'Individual',
      });
    });

    it('should get my loan applications successfully', async function () {
      const response = await borrower.fetch('/api/loan-applications/my-applications');

      const data = await response.json();

      strictEqual(response.status, 200);
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const responseData = data.data;
      assertPropArray(responseData, 'applications');
      assertPropDefined(responseData, 'pagination');

      ok(responseData.applications.length, 'Expected applications');

      responseData.applications.forEach(application => {
        assertDefined(application);
        assertProp(check(isNumber, isString), application, 'borrowerId');
        strictEqual(application.borrowerId, borrower.id);
      });
    });

    it('should support pagination for my applications', async function () {
      const response = await borrower.fetch(
        '/api/loan-applications/my-applications?page=1&limit=5',
      );

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropDefined(data.data, 'pagination');

      const pagination = data.data.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      strictEqual(pagination.page, 1);
      strictEqual(pagination.limit, 5);
      assertPropArray(data.data, 'applications');
      ok(data.data.applications.length <= 5);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/loan-applications/my-applications`);
      strictEqual(response.status, 401);
    });
  });

  describe('Loan Applications - Update', function () {
    let borrower: Awaited<ReturnType<typeof createTestUser>>;
    let otherUser: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      borrower = await createTestUser({
        testSetup,
        testId,
        email: `update_app_borrower_${testId}@test.com`,
        name: 'Update App Borrower',
        userType: 'Individual',
      });

      otherUser = await createTestUser({
        testSetup,
        testId,
        email: `update_app_other_${testId}@test.com`,
        name: 'Other User',
        userType: 'Individual',
      });
    });

    it('should cancel loan application successfully', async function () {
      // First create a loan application
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const createResponse = await borrower.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      ok(createResponse.ok, `Failed to create application: ${createResponse.status}`);

      const createData = await createResponse.json();
      const applicationId = createData.data.id;

      // Now update the application
      const updateData = {
        action: 'Cancel',
      };

      const response = await borrower.fetch(`/api/loan-applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const updatedApplication = data.data;
      assertProp(v => v === 'Cancelled', updatedApplication, 'status');
    });

    it('should return 404 for non-existent loan application', async function () {
      const updateData = {
        action: 'Cancel',
      };

      const response = await borrower.fetch('/api/loan-applications/999999', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 404);
    });

    it('should return 403 for insufficient permissions', async function () {
      const updateData = {
        action: 'Cancel',
      };

      const response = await otherUser.fetch('/api/loan-applications/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      ok(response.status === 403 || response.status === 404);
    });

    it('should return 401 for unauthenticated request', async function () {
      const updateData = {
        action: 'Cancel',
      };

      const response = await fetch(`${testSetup.backendUrl}/api/loan-applications/123`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 401);
    });
  });
});
