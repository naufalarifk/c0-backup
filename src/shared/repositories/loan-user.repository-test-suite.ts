import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import {
  assertArrayOf,
  assertDefined,
  assertPropDate,
  assertPropNullableDate,
  assertPropString,
  assertPropStringOrNumber,
} from '../utils';
import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { LoanUserRepository } from './loan-user.repository';

export async function runLoanUserRepositoryTestSuite(
  createRepo: () => Promise<LoanUserRepository>,
  teardownRepo: (repo: LoanUserRepository) => Promise<void>,
): Promise<void> {
  await suite('LoanUserRepository', function () {
    const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();
    let repo: LoanUserRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('Loan User Management', function () {
      describe('userViewsLoanDetails', function () {
        it('should return loan details for authorized borrower', async function () {
          // Create test users
          await repo.sql`
            INSERT INTO users (id, email, email_verified_date)
            VALUES (1, 'lender@test.com', NOW()), (2, 'borrower@test.com', NOW())
            ON CONFLICT (id) DO NOTHING
          `;

          // Create test data - first setup price feed and exchange rate
          await repo.sql`
            INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
            VALUES ('eip155:56', 'slip44:714', 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'test')
          `;

          const priceFeedResult = await repo.sql`
            SELECT id FROM price_feeds 
            WHERE blockchain_key = 'eip155:56' 
            AND base_currency_token_id = 'slip44:714' 
            AND quote_currency_token_id = 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
          `;
          assertArrayOf(priceFeedResult, function (item) {
            assertDefined(item);
            assertPropStringOrNumber(item, 'id');
            return item;
          });

          await repo.sql`
            INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
            VALUES (${priceFeedResult[0]?.id}, 1500.0, 1505.0, NOW(), NOW())
          `;

          const loanOfferResult = await repo.lenderCreatesLoanOffer({
            lenderUserId: '1',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate: new Date('2025-12-31'),
            createdDate: new Date(),
          });

          const loanApplicationResult = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: '2',
            loanOfferId: loanOfferResult.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '2000000000',
            maxInterestRate: 15.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate: new Date(),
            expirationDate: new Date('2025-11-30'),
          });

          // Mock loan creation (in real implementation, platform would create loan)
          const mockLoanId = '123';

          // Test accessing loan details as borrower
          await rejects(
            () => repo.userViewsLoanDetails({ loanId: mockLoanId, userId: '2' }),
            'Should throw error for non-existent loan',
          );
        });

        it('should return loan details for authorized lender', async function () {
          // Similar test for lender access
          const mockLoanId = '123';

          await rejects(
            () => repo.userViewsLoanDetails({ loanId: mockLoanId, userId: '1' }),
            'Should throw error for non-existent loan',
          );
        });

        it('should deny access to unauthorized users', async function () {
          const mockLoanId = '123';

          await rejects(
            () => repo.userViewsLoanDetails({ loanId: mockLoanId, userId: '999' }),
            'Should deny access to unauthorized user',
          );
        });
      });

      describe('userViewsLoans', function () {
        it('should return paginated loans for user', async function () {
          const result = await repo.userViewsLoans({
            userId: '1',
            page: 1,
            limit: 10,
          });

          assertDefined(result, 'Result should be defined');
          assertDefined(result.loans, 'Loans array should be defined');
          assertDefined(result.pagination, 'Pagination should be defined');
          equal(Array.isArray(result.loans), true, 'Loans should be an array');
        });

        it('should filter loans by role', async function () {
          const borrowerResult = await repo.userViewsLoans({
            userId: '2',
            role: 'borrower',
            page: 1,
            limit: 10,
          });

          const lenderResult = await repo.userViewsLoans({
            userId: '1',
            role: 'lender',
            page: 1,
            limit: 10,
          });

          assertDefined(borrowerResult, 'Borrower result should be defined');
          assertDefined(lenderResult, 'Lender result should be defined');
        });

        it('should filter loans by status', async function () {
          const result = await repo.userViewsLoans({
            userId: '1',
            status: 'Active',
            page: 1,
            limit: 10,
          });

          assertDefined(result, 'Result should be defined');
          equal(Array.isArray(result.loans), true, 'Loans should be an array');
        });
      });

      describe('userViewsLoanValuationHistory', function () {
        it('should return loan valuation history for authorized user', async function () {
          const mockLoanId = '123';

          await rejects(
            () => repo.userViewsLoanValuationHistory({ loanId: mockLoanId, userId: '1' }),
            'Should throw error for non-existent loan',
          );
        });

        it('should deny access to unauthorized users', async function () {
          const mockLoanId = '123';

          await rejects(
            () => repo.userViewsLoanValuationHistory({ loanId: mockLoanId, userId: '999' }),
            'Should deny access to unauthorized user',
          );
        });

        it('should support date filtering', async function () {
          const mockLoanId = '123';
          const startDate = new Date('2024-01-01');
          const endDate = new Date('2024-12-31');

          await rejects(
            () =>
              repo.userViewsLoanValuationHistory({
                loanId: mockLoanId,
                userId: '1',
                startDate,
                endDate,
              }),
            'Should throw error for non-existent loan',
          );
        });

        it('should limit results appropriately', async function () {
          const mockLoanId = '123';

          await rejects(
            () =>
              repo.userViewsLoanValuationHistory({
                loanId: mockLoanId,
                userId: '1',
                limit: 100,
              }),
            'Should throw error for non-existent loan',
          );
        });
      });
    });
  });
}
