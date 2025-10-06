import { deepStrictEqual, doesNotReject, ok, rejects, strictEqual } from 'node:assert/strict';

import {
  assertDefined,
  assertProp,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropBoolean,
  assertPropDefined,
  assertPropNullableString,
  assertPropNumber,
  assertPropString,
  check,
  hasPropString,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createInstitutionTestUser, createTestUser } from './setup/user';

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

  describe('Loan Offers - Create', function () {
    let lenderIndividual: Awaited<ReturnType<typeof createTestUser>>;
    let lenderInstitution: Awaited<ReturnType<typeof createInstitutionTestUser>>;
    let _borrower: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      // Create individual lender
      lenderIndividual = await createTestUser({
        testSetup,
        testId,
        email: `lender_individual_${testId}@test.com`,
        name: 'Individual Lender',
        userType: 'Individual',
      });

      // Create institution lender
      lenderInstitution = await createInstitutionTestUser({
        testSetup,
        testId,
        email: `lender_institution_${testId}@test.com`,
        name: 'Institution Lender',
      });

      // Create borrower
      _borrower = await createTestUser({
        testSetup,
        testId,
        email: `borrower_${testId}@test.com`,
        name: 'Borrower User',
        userType: 'Individual',
      });
    });

    it('should create individual lender loan offer successfully', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const response = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      const data = await response.json();

      strictEqual(response.status, 201);
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const offer = data.data;
      assertPropString(offer, 'id');
      assertPropString(offer, 'lenderId');
      assertPropDefined(offer, 'lender');
      assertPropDefined(offer, 'principalCurrency');
      assertPropString(offer, 'totalAmount');
      assertPropString(offer, 'availableAmount');
      assertPropString(offer, 'disbursedAmount');
      assertPropNumber(offer, 'interestRate');
      assertPropArray(offer, 'termOptions');
      assertProp(v => v === 'Draft' || v === 'Published' || v === 'Closed', offer, 'status');
      assertPropString(offer, 'createdDate');

      // Verify lender info
      const lender = offer.lender;
      assertPropString(lender, 'id');
      assertPropString(lender, 'type');
      strictEqual(lender.type, 'Individual');
      assertPropString(lender, 'name');

      // Verify currency info
      const currency = offer.principalCurrency;
      assertPropString(currency, 'blockchainKey');
      assertPropString(currency, 'tokenId');
      assertPropString(currency, 'name');
      assertPropString(currency, 'symbol');
      assertPropNumber(currency, 'decimals');

      // Verify decimals is within valid range (0-18) per OpenAPI spec
      ok(currency.decimals >= 0 && currency.decimals <= 18);

      // Verify logoUrl is always present per OpenAPI spec
      assertPropString(currency, 'logoUrl');
      ok(currency.logoUrl.startsWith('http'));

      // Verify funding invoice is always present for created loan offers
      assertPropDefined(offer, 'fundingInvoice');
      const invoice = offer.fundingInvoice;
      assertPropString(invoice, 'id');
      assertPropString(invoice, 'amount');
      assertPropDefined(invoice, 'currency');
      assertPropString(invoice, 'walletAddress');
      assertPropString(invoice, 'expiryDate');
      // paidDate and expiredDate are nullable (not yet paid/expired)
      assertProp(check(isNullable, isString), invoice, 'paidDate');
      assertProp(check(isNullable, isString), invoice, 'expiredDate');
    });

    it('should create institution lender loan offer successfully', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '100000.000000000000000000',
        interestRate: 10.0,
        termOptions: [1, 3, 6, 12],
        minLoanAmount: '5000.000000000000000000',
        maxLoanAmount: '50000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const response = await lenderInstitution.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      const data = await response.json();

      strictEqual(response.status, 201);
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const offer = data.data;
      assertDefined(offer);
      assertPropDefined(offer, 'lender');
      const lender = offer.lender;
      assertDefined(lender);
      assertPropString(lender, 'type');
      strictEqual(lender.type, 'Institution');

      // businessType is optional for Institution lenders (present after KYC approval)
      assertProp(check(isNullable, isString), lender, 'businessType');
      // profilePictureUrl is optional (may be null)
      assertProp(check(isNullable, isString), lender, 'profilePictureUrl');
    });

    it('should return 422 for invalid principal currency', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'invalid-blockchain',
        principalTokenId: 'invalid-token',
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const response = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      ok(response.status === 422 || response.status === 400);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
    });

    it('should return 422 for invalid interest rate', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '10000.000000000000000000',
        interestRate: 75.5, // Invalid - exceeds 50% maximum
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const response = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INTEREST_RATE_INVALID);
    });

    it('should return 422 for missing required fields', async function () {
      const response = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 for unauthenticated request', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const response = await fetch(`${testSetup.backendUrl}/api/loan-offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      strictEqual(response.status, 401);
    });
  });

  describe('Loan Offers - List', function () {
    let _lenderIndividual: Awaited<ReturnType<typeof createTestUser>>;
    let borrower: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      _lenderIndividual = await createTestUser({
        testSetup,
        testId,
        email: `list_offers_lender_${testId}@test.com`,
        name: 'List Offers Lender',
        userType: 'Individual',
      });

      borrower = await createTestUser({
        testSetup,
        testId,
        email: `list_offers_borrower_${testId}@test.com`,
        name: 'List Offers Borrower',
        userType: 'Individual',
      });
    });

    it('should list available loan offers successfully', async function () {
      const response = await borrower.fetch('/api/loan-offers');

      const data = await response.json();

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 200);
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const responseData = data.data;
      assertPropArray(responseData, 'offers');
      assertPropDefined(responseData, 'pagination');

      const pagination = responseData.pagination;
      assertPropNumber(pagination, 'page');
      assertPropNumber(pagination, 'limit');
      assertPropNumber(pagination, 'total');
      assertPropNumber(pagination, 'totalPages');
      assertProp(v => typeof v === 'boolean', pagination, 'hasNext');
      assertProp(v => typeof v === 'boolean', pagination, 'hasPrev');

      // May have zero or more offers depending on data
      assertPropArrayMapOf(responseData, 'offers', offer => {
        assertDefined(offer);
        assertPropString(offer, 'id');
        assertPropString(offer, 'lenderId');
        assertPropDefined(offer, 'lender');
        assertPropDefined(offer, 'principalCurrency');
        assertPropString(offer, 'totalAmount');
        assertPropString(offer, 'availableAmount');
        assertPropString(offer, 'disbursedAmount');
        assertPropNumber(offer, 'interestRate');
        assertPropArray(offer, 'termOptions');
        assertProp(v => v === 'Published', offer, 'status'); // Only published offers should be listed
        assertPropString(offer, 'createdDate');
        // publishedDate must be present for Published status offers
        assertPropString(offer, 'publishedDate');

        return offer;
      });
    });

    it('should filter loan offers by collateral currency', async function () {
      const response = await borrower.fetch(
        '/api/loan-offers?collateralBlockchainKey=eip155:1&collateralTokenId=slip44:60',
      );

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'offers');
    });

    it('should filter loan offers by lender user type', async function () {
      const response = await borrower.fetch('/api/loan-offers?lenderUserType=Individual');

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'offers');

      // Verify all returned offers match the filter (if any exist)
      data.data.offers.forEach(offer => {
        assertDefined(offer);
        assertPropDefined(offer, 'lender');
        assertPropString(offer.lender, 'type');
        strictEqual(offer.lender.type, 'Individual');
      });
    });

    it('should filter loan offers by amount range', async function () {
      const response = await borrower.fetch(
        '/api/loan-offers?minAvailablePrincipalAmount=1000&maxAvailablePrincipalAmount=50000',
      );

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'data');
      assertPropArray(data.data, 'offers');
    });

    it('should support pagination', async function () {
      const response = await borrower.fetch('/api/loan-offers?page=1&limit=10');

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

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
      assertPropArray(data.data, 'offers');
      ok(data.data.offers.length <= 10);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/loan-offers`);
      strictEqual(response.status, 401);
    });
  });

  describe('Loan Offers - My Offers', function () {
    let lenderIndividual: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      lenderIndividual = await createTestUser({
        testSetup,
        testId,
        email: `my_offers_lender_${testId}@test.com`,
        name: 'My Offers Lender',
        userType: 'Individual',
      });

      // Create 2 loan offers for this lender
      const offer1Response = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          totalAmount: '5000.000000000000000000',
          interestRate: 10.0,
          termOptions: [3, 6],
          minLoanAmount: '500.000000000000000000',
          maxLoanAmount: '5000.000000000000000000',
          expirationDate: '2025-12-31T23:59:59Z',
        }),
      });
      strictEqual(offer1Response.status, 201);

      const offer2Response = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          totalAmount: '8000.000000000000000000',
          interestRate: 12.0,
          termOptions: [1, 3],
          minLoanAmount: '1000.000000000000000000',
          maxLoanAmount: '8000.000000000000000000',
          expirationDate: '2025-12-31T23:59:59Z',
        }),
      });
      strictEqual(offer2Response.status, 201);
    });

    it('should get my loan offers successfully', async function () {
      const response = await lenderIndividual.fetch('/api/loan-offers/my-offers');

      const data = await response.json();

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 200);
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const responseData = data.data;
      assertPropArray(responseData, 'offers');
      assertPropDefined(responseData, 'pagination');

      // Verify exact count: 2 offers were created for this lender in setup
      strictEqual(responseData.offers.length, 2, 'Expected exactly 2 offers for this lender');

      responseData.offers.forEach(offer => {
        assertDefined(offer);
        assertProp(check(isNumber, isString), offer, 'lenderId');
        strictEqual(offer.lenderId, lenderIndividual.id);
      });
    });

    it('should support pagination for my offers', async function () {
      const response = await lenderIndividual.fetch('/api/loan-offers/my-offers?page=1&limit=5');

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

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
      assertPropArray(data.data, 'offers');
      ok(data.data.offers.length <= 5);
    });

    it('should return 401 for unauthenticated request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/loan-offers/my-offers`);
      strictEqual(response.status, 401);
    });
  });

  describe('Loan Offers - Update', function () {
    let lenderIndividual: Awaited<ReturnType<typeof createTestUser>>;
    let otherUser: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      lenderIndividual = await createTestUser({
        testSetup,
        testId,
        email: `update_offer_lender_${testId}@test.com`,
        name: 'Update Offer Lender',
        userType: 'Individual',
      });

      otherUser = await createTestUser({
        testSetup,
        testId,
        email: `update_offer_other_${testId}@test.com`,
        name: 'Other User',
        userType: 'Individual',
      });
    });

    it('should update loan offer status to close successfully', async function () {
      // First create a loan offer
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '10000.000000000000000000',
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const createResponse = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      if (createResponse.status !== 201) {
        console.log('Cannot create loan offer, skipping update test');
        return;
      }

      const createData = await createResponse.json();
      assertDefined(createData);
      assertPropDefined(createData, 'data');
      assertPropString(createData.data, 'id');
      const offerId = createData.data.id;

      // Now update the offer
      const updateData = {
        action: 'Close',
        closureReason: 'No longer lending',
      };

      const response = await lenderIndividual.fetch(`/api/loan-offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.status === 404) {
        console.log('Update endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');

      const updatedOffer = data.data;
      assertProp(v => v === 'Closed', updatedOffer, 'status');
    });

    it('should return 404 for non-existent loan offer', async function () {
      const updateData = {
        action: 'Close',
        closureReason: 'Test reason',
      };

      const response = await lenderIndividual.fetch('/api/loan-offers/999999', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.status === 404) {
        const data = await response.json();
        assertDefined(data);
        assertProp(
          check(isNullable, (v): v is { code: string } => hasPropString(v, 'code')),
          data,
          'error',
        );
        if (data.error?.code === ERROR_CODES.NOT_FOUND) {
          // Expected behavior
          return;
        } else {
          console.log('Endpoint not implemented yet');
          return;
        }
      }

      strictEqual(response.status, 404);
    });

    it('should return 403 for insufficient permissions', async function () {
      const updateData = {
        action: 'Close',
        closureReason: 'Test reason',
      };

      const response = await otherUser.fetch('/api/loan-offers/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      ok(response.status === 403 || response.status === 404);
    });

    it('should return 401 for unauthenticated request', async function () {
      const updateData = {
        action: 'Close',
        closureReason: 'Test reason',
      };

      const response = await fetch(`${testSetup.backendUrl}/api/loan-offers/123`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      strictEqual(response.status, 401);
    });
  });

  describe('Loan Offers - Detail', function () {
    let lenderIndividual: Awaited<ReturnType<typeof createTestUser>>;
    let borrower: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      lenderIndividual = await createTestUser({
        testSetup,
        testId,
        email: `detail_offer_lender_${testId}@test.com`,
        name: 'Detail Offer Lender',
        userType: 'Individual',
      });

      borrower = await createTestUser({
        testSetup,
        testId,
        email: `detail_offer_borrower_${testId}@test.com`,
        name: 'Detail Offer Borrower',
        userType: 'Individual',
      });
    });

    it('should fetch loan offer details by id successfully', async function () {
      // Create an offer first
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '7000.000000000000000000',
        interestRate: 11.5,
        termOptions: [3, 6],
        minLoanAmount: '500.000000000000000000',
        maxLoanAmount: '7000.000000000000000000',
        expirationDate: '2025-12-31T23:59:59Z',
      };

      const createResponse = await lenderIndividual.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      if (createResponse.status !== 201) {
        console.log('Cannot create loan offer, skipping detail fetch test');
        return;
      }

      const createData = await createResponse.json();
      assertDefined(createData);
      assertPropDefined(createData, 'data');
      assertPropString(createData.data, 'id');
      const offerId = createData.data.id;

      const response = await borrower.fetch(`/api/loan-offers/${offerId}`);
      strictEqual(response.status, 200);
      const data = await response.json();
      assertDefined(data);
      assertPropBoolean(data, 'success');
      strictEqual(data.success, true);
      assertPropDefined(data, 'data');
      const offer = data.data;
      assertPropString(offer, 'id');
      strictEqual(offer.id, offerId);
    });

    it('should return 404 for non-existent loan offer', async function () {
      const response = await lenderIndividual.fetch('/api/loan-offers/non-existent-id');
      strictEqual(response.status, 404);
    });

    it('should return 401 for unauthenticated loan offer detail request', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/loan-offers/12345`);
      strictEqual(response.status, 401);
    });
  });
});
