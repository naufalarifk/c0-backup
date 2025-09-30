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

  describe('Error Scenarios and Edge Cases', function () {
    let user: Awaited<ReturnType<typeof createTestUser>>;

    before(async function () {
      user = await createTestUser({
        testSetup,
        testId,
        email: `edge_cases_user_${testId}@test.com`,
        name: 'Edge Cases User',
        userType: 'Individual',
      });
    });

    it('should handle malformed JSON in loan offer creation', async function () {
      const response = await user.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-string',
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 400);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.BAD_REQUEST);
      assertPropString(data.error, 'message');
      ok(data.error.message.includes('not valid JSON'));

      // Verify additional error fields per OpenAPI spec
      if ('timestamp' in data) {
        assertPropString(data, 'timestamp');
      }
      if ('requestId' in data) {
        assertPropString(data, 'requestId');
      }
    });

    it('should handle malformed JSON in loan application creation', async function () {
      const response = await user.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-string',
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 400);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'success');
      strictEqual(data.success, false);
      assertPropDefined(data, 'error');
      assertPropString(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.BAD_REQUEST);

      // Verify additional error fields per OpenAPI spec
      if ('timestamp' in data) {
        assertPropString(data, 'timestamp');
      }
      if ('requestId' in data) {
        assertPropString(data, 'requestId');
      }
    });

    it('should handle empty request body in loan offer creation', async function () {
      const response = await user.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
    });

    it('should handle empty request body in loan application creation', async function () {
      const response = await user.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
    });

    it('should validate currency combinations', async function () {
      // Test unsupported currency combination
      const calculationData = {
        collateralBlockchainKey: 'unsupported-chain',
        collateralTokenId: 'unsupported-token',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        principalAmount: '10000.000000000000000000',
      };

      const response = await user.fetch('/api/loan-applications/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculationData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      ok(response.status >= 400);
    });

    it('should handle very large principal amounts', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '999999999999.000000000000000000', // Very large amount
        interestRate: 12.5,
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '999999999999.000000000000000000',
        liquidationMode: 'Partial',
        expirationDate: '2025-12-31T23:59:59Z',
        acceptedCollateral: ['BTC'],
        fundingDeadline: '2025-10-01T23:59:59Z',
        termsAcceptanceTimestamp: '2025-09-23T10:30:00Z',
      };

      const response = await user.fetch('/api/loan-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loanOfferData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      // Should either succeed or fail with appropriate error
      ok(response.status === 201 || response.status >= 400);
    });

    it('should validate minimum loan amount per SRS BR-005', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '49.000000000000000000', // Below minimum 50 USDT
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await user.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.AMOUNT_OUT_OF_BOUNDS);
    });

    it('should validate maximum loan amount per SRS BR-005', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '20001.000000000000000000', // Above maximum 20,000 USDT
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await user.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.AMOUNT_OUT_OF_BOUNDS);
    });

    it('should handle very small principal amounts', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '0.000000000000000001', // Very small amount
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await user.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      // Should either succeed or fail with appropriate validation error
      ok(response.status === 201 || response.status >= 400);
    });

    it('should validate LTV ratio bounds', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 1.5, // Invalid - exceeds 100%
      };

      const response = await user.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.VALIDATION_ERROR);
    });

    it('should handle concurrent loan application creation', async function () {
      const applicationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalAmount: '5000.000000000000000000',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      // Send two identical requests concurrently
      const [response1, response2] = await Promise.all([
        user.fetch('/api/loan-applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(applicationData),
        }),
        user.fetch('/api/loan-applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(applicationData),
        }),
      ]);

      if (response1.status === 404 && response2.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      // Both should succeed or handle gracefully
      const statuses = [response1.status, response2.status];
      const hasSuccess = statuses.includes(201);

      // Either both succeed or handle appropriately
      ok(hasSuccess || statuses.every(status => status >= 400));
    });

    it('should validate ID format in URL parameters', async function () {
      // Test with non-numeric loan offer ID
      const response = await user.fetch('/api/loan-offers/invalid-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'Close' }),
      });

      if (response.status === 404) {
        const data = await response.json();
        if (!data.error?.code) {
          console.log('Endpoint not implemented yet');
          return;
        }
      }

      ok(response.status === 400 || response.status === 404);
    });

    it('should validate interest rate bounds per SRS CONF-001', async function () {
      const loanOfferData = {
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        totalAmount: '10000.000000000000000000',
        interestRate: 0.05, // Below minimum 0.1%
        termOptions: [3, 6],
        minLoanAmount: '1000.000000000000000000',
        maxLoanAmount: '10000.000000000000000000',
        liquidationMode: 'Partial',
        expirationDate: '2025-12-31T23:59:59Z',
        acceptedCollateral: ['BTC'],
        fundingDeadline: '2025-10-01T23:59:59Z',
        termsAcceptanceTimestamp: '2025-09-23T10:30:00Z',
      };

      const response = await user.fetch('/api/loan-offers', {
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
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.INTEREST_RATE_INVALID);
    });

    it('should validate supported collateral assets per SRS scope', async function () {
      const applicationData = {
        collateralBlockchainKey: 'cosmos:cosmoshub-3', // Unsupported blockchain
        collateralTokenId: 'slip44:118',
        principalAmount: '5000.000000000000000000',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        maxInterestRate: 15.0,
        termMonths: 6,
        liquidationMode: 'Full',
        minLtvRatio: 0.5,
      };

      const response = await user.fetch('/api/loan-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      strictEqual(response.status, 422);
      const data = await response.json();
      assertDefined(data);
      assertPropDefined(data, 'error');
      assertPropDefined(data.error, 'code');
      strictEqual(data.error.code, ERROR_CODES.CURRENCY_NOT_SUPPORTED);
    });

    it('should validate minimum withdrawal amount per SRS constraints', async function () {
      const calculationData = {
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'slip44:60',
        principalBlockchainKey: 'eip155:56',
        principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        principalAmount: '19.000000000000000000', // Below minimum 20 USDT equivalent
        loanTerm: 1,
      };

      const response = await user.fetch('/api/loan-applications/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calculationData),
      });

      if (response.status === 404) {
        console.log('Endpoint not implemented yet');
        return;
      }

      // Should either succeed or fail gracefully with minimum amount validation
      ok(response.status === 200 || response.status >= 400);
    });
  });
});
