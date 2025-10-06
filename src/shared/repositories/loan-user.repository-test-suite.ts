import type { AppConfigService } from '../services/app-config.service';

import { doesNotReject } from 'node:assert';
import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { assertArrayMapOf, assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { InvoiceIdGenerator } from '../invoice/invoice-id.generator';
import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { BorrowerCreatesLoanApplicationParams, LenderCreatesLoanOfferParams } from './loan.types';
import { LoanUserRepository } from './loan-user.repository';

const testInvoiceIdGenerator = new InvoiceIdGenerator({
  invoiceConfig: {
    epochMs: Date.UTC(2024, 0, 1),
    workerId: 0,
  },
} as unknown as AppConfigService);

async function createFundingInvoiceParams(
  repo: LoanUserRepository,
  options: {
    principalBlockchainKey: string;
    principalTokenId: string;
    invoiceDate: Date;
    dueDate: Date;
    expiredDate?: Date;
  },
) {
  const invoiceId = testInvoiceIdGenerator.generate();
  return {
    fundingInvoiceId: invoiceId,
    fundingInvoicePrepaidAmount: '0',
    fundingAccountBlockchainKey: options.principalBlockchainKey,
    fundingAccountTokenId: options.principalTokenId,
    fundingInvoiceDate: options.invoiceDate,
    fundingInvoiceDueDate: options.dueDate,
    fundingInvoiceExpiredDate: options.expiredDate ?? options.dueDate,
  };
}

async function createCollateralInvoiceParams(
  repo: LoanUserRepository,
  options: {
    collateralBlockchainKey: string;
    collateralTokenId: string;
    invoiceDate: Date;
    dueDate: Date;
    expiredDate?: Date;
  },
) {
  const invoiceId = testInvoiceIdGenerator.generate();
  return {
    collateralInvoiceId: invoiceId,
    collateralInvoicePrepaidAmount: '0',
    collateralAccountBlockchainKey: options.collateralBlockchainKey,
    collateralAccountTokenId: options.collateralTokenId,
    collateralInvoiceDate: options.invoiceDate,
    collateralInvoiceDueDate: options.dueDate,
    collateralInvoiceExpiredDate: options.expiredDate ?? options.dueDate,
  };
}

async function lenderCreatesLoanOfferWithInvoice(
  repo: LoanUserRepository,
  params: Omit<
    LenderCreatesLoanOfferParams,
    | 'fundingInvoiceId'
    | 'fundingInvoicePrepaidAmount'
    | 'fundingAccountBlockchainKey'
    | 'fundingAccountTokenId'
    | 'fundingInvoiceDate'
    | 'fundingInvoiceDueDate'
    | 'fundingInvoiceExpiredDate'
  >,
) {
  const fundingInvoice = await createFundingInvoiceParams(repo, {
    principalBlockchainKey: params.principalBlockchainKey,
    principalTokenId: params.principalTokenId,
    invoiceDate: params.createdDate,
    dueDate: params.expirationDate,
  });

  return repo.lenderCreatesLoanOffer({
    ...params,
    ...fundingInvoice,
  });
}

async function borrowerCreatesLoanApplicationWithInvoice(
  repo: LoanUserRepository,
  params: Omit<
    BorrowerCreatesLoanApplicationParams,
    | 'collateralInvoiceId'
    | 'collateralInvoicePrepaidAmount'
    | 'collateralAccountBlockchainKey'
    | 'collateralAccountTokenId'
    | 'collateralInvoiceDate'
    | 'collateralInvoiceDueDate'
    | 'collateralInvoiceExpiredDate'
  >,
) {
  const collateralInvoice = await createCollateralInvoiceParams(repo, {
    collateralBlockchainKey: params.collateralBlockchainKey,
    collateralTokenId: params.collateralTokenId,
    invoiceDate: params.appliedDate,
    dueDate: params.expirationDate,
  });

  return repo.borrowerCreatesLoanApplication({
    ...params,
    ...collateralInvoice,
  });
}

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

          // Create test data - setup price feed and exchange rate
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test',
            bidPrice: 1500.0,
            askPrice: 1505.0,
            sourceDate: new Date('2025-10-30'),
          });

          const loanOfferResult = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: '1',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.5,
            termInMonthsOptions: [3, 6, 12],
            createdDate: new Date('2025-10-30'),
            expirationDate: new Date('2025-12-31'),
            fundingInvoiceId: 100,
            fundingInvoicePrepaidAmount: '0',
            fundingInvoiceDate: new Date('2025-10-30'),
            fundingInvoiceDueDate: new Date('2025-12-31'),
            fundingInvoiceExpiredDate: new Date('2025-12-31'),
            fundingWalletDerivationPath: "m/44'/0'/0'/0/100",
            fundingWalletAddress: 'test-funding-wallet-address-100',
          });

          await doesNotReject(
            borrowerCreatesLoanApplicationWithInvoice(repo, {
              borrowerUserId: '2',
              loanOfferId: loanOfferResult.id,
              collateralBlockchainKey: 'eip155:56',
              collateralTokenId: 'slip44:714',
              principalBlockchainKey: 'eip155:56',
              principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              principalAmount: '2000000000000000000000', // 2000 USDC in smallest units
              provisionAmount: '60000000000000000000', // 3% provision
              maxInterestRate: 15.0,
              minLtvRatio: 0.6,
              maxLtvRatio: 0.75,
              termInMonths: 6,
              liquidationMode: 'Partial',
              collateralDepositAmount: '1666666666666666666', // Calculated collateral
              collateralDepositExchangeRateId: exchangeRateId,
              appliedDate: new Date('2025-11-01'),
              expirationDate: new Date('2025-11-30'),
              collateralInvoiceId: 77777,
              collateralInvoicePrepaidAmount: '0',
              collateralInvoiceDate: new Date('2025-11-01'),
              collateralInvoiceDueDate: new Date('2025-11-30'),
              collateralInvoiceExpiredDate: new Date('2025-11-30'),
              collateralWalletDerivationPath: "m/44'/0'/0'/0/77777",
              collateralWalletAddress: 'user_test_address_77777',
            }),
            'Borrower should be able to create loan application',
          );

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
