import type { AppConfigService } from '../services/app-config.service';

import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isNumber,
  isString,
} from 'typeshaper';

import { InvoiceIdGenerator } from '../invoice/invoice-id.generator';
import { createEarlyExitNodeTestIt } from '../utils/node-test';
import {
  BorrowerCreatesLoanApplicationParams,
  BorrowerCreatesLoanApplicationResult,
  LenderCreatesLoanOfferParams,
  LenderCreatesLoanOfferResult,
  PlatformOriginatesLoanResult,
} from './loan.types';
import { LoanPlatformRepository } from './loan-platform.repository';

const testInvoiceIdGenerator = new InvoiceIdGenerator({
  invoiceConfig: {
    epochMs: Date.UTC(2024, 0, 1),
    workerId: 0,
  },
} as unknown as AppConfigService);

async function createFundingInvoiceParams(
  repo: LoanPlatformRepository,
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
  repo: LoanPlatformRepository,
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
  repo: LoanPlatformRepository,
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
  repo: LoanPlatformRepository,
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

let configDateCounter = 0;
function generateUniqueConfigDate(): Date {
  const month = Math.max(1, 12 - configDateCounter);
  configDateCounter++;
  return new Date(`2023-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
}

// Helper function to simulate paying a loan offer's principal invoice
async function simulateLoanOfferInvoicePayment(
  repo: LoanPlatformRepository,
  loanOfferId: string,
  paymentDate: Date,
): Promise<void> {
  // Get the loan offer and invoice details
  const loanOfferRows = await repo.sql`
    SELECT lo.lender_user_id, lo.offered_principal_amount, lo.principal_currency_blockchain_key, lo.principal_currency_token_id,
           i.id as invoice_id
    FROM loan_offers lo
    JOIN invoices i ON i.loan_offer_id = lo.id AND i.invoice_type = 'LoanPrincipal'
    WHERE lo.id = ${loanOfferId}
  `;

  if (loanOfferRows.length === 0) {
    throw new Error(`No principal invoice found for loan offer ${loanOfferId}`);
  }

  const loanOffer = loanOfferRows[0];
  assertDefined(loanOffer, 'Loan offer validation failed');
  assertProp(check(isString, isNumber), loanOffer, 'lender_user_id');
  assertProp(check(isString, isNumber), loanOffer, 'offered_principal_amount');
  assertPropString(loanOffer, 'principal_currency_blockchain_key');
  assertPropString(loanOffer, 'principal_currency_token_id');
  assertProp(check(isString, isNumber), loanOffer, 'invoice_id');

  // First, ensure the lender has sufficient balance by adding funds
  await repo.sql`
    INSERT INTO account_mutation_entries (
      user_id,
      currency_blockchain_key,
      currency_token_id,
      account_type,
      mutation_type,
      mutation_date,
      amount
    ) VALUES (
      ${loanOffer.lender_user_id},
      ${loanOffer.principal_currency_blockchain_key},
      ${loanOffer.principal_currency_token_id},
      'User',
      'AdminManualAdjustment',
      ${paymentDate.toISOString()},
      ${loanOffer.offered_principal_amount}
    )
  `;

  // Now simulate blockchain payment by inserting into invoice_payments
  // This will trigger the process_invoice_payment trigger which updates the invoice
  await repo.sql`
    INSERT INTO invoice_payments (
      invoice_id,
      payment_date,
      payment_hash,
      amount
    ) VALUES (
      ${loanOffer.invoice_id},
      ${paymentDate.toISOString()},
      ${'test_payment_hash_' + loanOffer.invoice_id + '_' + Date.now()},
      ${loanOffer.offered_principal_amount}
    )
  `;
}

// Helper function to simulate paying a loan application's collateral invoice
async function simulateLoanApplicationInvoicePayment(
  repo: LoanPlatformRepository,
  loanApplicationId: string,
  paymentDate: Date,
): Promise<void> {
  // Get the loan application and invoice details
  const loanApplicationRows = await repo.sql`
    SELECT la.borrower_user_id, la.collateral_deposit_amount, la.collateral_currency_blockchain_key, la.collateral_currency_token_id,
           i.id as invoice_id
    FROM loan_applications la
    JOIN invoices i ON i.loan_application_id = la.id AND i.invoice_type = 'LoanCollateral'
    WHERE la.id = ${loanApplicationId}
  `;

  if (loanApplicationRows.length === 0) {
    throw new Error(`No collateral invoice found for loan application ${loanApplicationId}`);
  }

  const loanApplication = loanApplicationRows[0];
  assertDefined(loanApplication, 'Loan application validation failed');
  assertProp(check(isString, isNumber), loanApplication, 'borrower_user_id');
  assertProp(check(isString, isNumber), loanApplication, 'collateral_deposit_amount');
  assertPropString(loanApplication, 'collateral_currency_blockchain_key');
  assertPropString(loanApplication, 'collateral_currency_token_id');
  assertProp(check(isString, isNumber), loanApplication, 'invoice_id');

  // First, ensure the borrower has sufficient balance by adding funds
  await repo.sql`
    INSERT INTO account_mutation_entries (
      user_id,
      currency_blockchain_key,
      currency_token_id,
      account_type,
      mutation_type,
      mutation_date,
      amount
    ) VALUES (
      ${loanApplication.borrower_user_id},
      ${loanApplication.collateral_currency_blockchain_key},
      ${loanApplication.collateral_currency_token_id},
      'User',
      'AdminManualAdjustment',
      ${paymentDate.toISOString()},
      ${loanApplication.collateral_deposit_amount}
    )
  `;

  // Now simulate blockchain payment by inserting into invoice_payments
  // This will trigger the process_invoice_payment trigger which updates the invoice
  await repo.sql`
    INSERT INTO invoice_payments (
      invoice_id,
      payment_date,
      payment_hash,
      amount
    ) VALUES (
      ${loanApplication.invoice_id},
      ${paymentDate.toISOString()},
      ${'test_payment_hash_' + loanApplication.invoice_id + '_' + Date.now()},
      ${loanApplication.collateral_deposit_amount}
    )
  `;
}

export async function runLoanPlatformRepositoryTestSuite(
  createRepo: () => Promise<LoanPlatformRepository>,
  teardownRepo: (repo: LoanPlatformRepository) => Promise<void>,
): Promise<void> {
  const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();

  await suite('LoanPlatformRepository', function () {
    let repo: LoanPlatformRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('Loan Offer Platform Management', function () {
      describe('Database Trigger Tests', function () {
        describe('Loan Offer Publishing Trigger', function () {
          it('should automatically publish loan offer when principal invoice is paid', async function () {
            // Setup test data
            const lender = await repo.betterAuthCreateUser({
              name: 'Lender User',
              email: 'lender@example.com',
              emailVerified: true,
            });
            assertPropString(lender, 'id');

            await repo.testCreatesBlockchains({
              blockchains: [
                { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
              ],
            });

            const createdDate = new Date('2024-01-01T10:00:00.000Z');
            const expirationDate = new Date('2024-01-31T23:59:59.999Z');

            // Create loan offer (should be in 'Funding' status)
            const loanOffer = await lenderCreatesLoanOfferWithInvoice(repo, {
              lenderUserId: lender.id,
              principalBlockchainKey: 'eip155:56',
              principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              offeredPrincipalAmount: '1000', // 1000 USDT (human-readable format)
              minLoanPrincipalAmount: '100', // 100 USDT (human-readable format)
              maxLoanPrincipalAmount: '500', // 500 USDT (human-readable format)
              interestRate: 0.155, // 15.5% in decimal format
              termInMonthsOptions: [3, 6, 12],
              expirationDate,
              createdDate,
              fundingInvoiceId: 500,
              fundingInvoicePrepaidAmount: '0',
              fundingInvoiceDate: createdDate,
              fundingInvoiceDueDate: expirationDate,
              fundingInvoiceExpiredDate: expirationDate,
              fundingWalletDerivationPath: "m/44'/0'/0'/0/500",
              fundingWalletAddress: 'test-funding-wallet-address-500',
            });

            // Verify loan offer is initially in 'Funding' status
            equal(loanOffer.status, 'Funding');

            const paymentDate = new Date('2024-01-02T10:00:00.000Z');

            // Simulate paying the principal invoice (this should trigger automatic publishing)
            await simulateLoanOfferInvoicePayment(repo, loanOffer.id, paymentDate);

            // Verify loan offer was automatically published
            const publishedOfferRows = await repo.sql`
              SELECT id, status, published_date 
              FROM loan_offers 
              WHERE id = ${loanOffer.id}
            `;

            equal(publishedOfferRows.length, 1);
            const publishedOffer = publishedOfferRows[0];
            assertDefined(publishedOffer, 'Published offer validation failed');
            assertProp(check(isString, isNumber), publishedOffer, 'id');
            assertPropString(publishedOffer, 'status');
            assertProp(isInstanceOf(Date), publishedOffer, 'published_date');

            equal(publishedOffer.status, 'Published');
            deepEqual(new Date(publishedOffer.published_date), paymentDate);
          });
        });

        describe('Loan Application Publishing Trigger', function () {
          it('should automatically publish loan application when collateral invoice is paid', async function () {
            // Setup borrower and currencies
            const borrower = await repo.betterAuthCreateUser({
              name: 'Borrower User',
              email: 'borrower@example.com',
              emailVerified: true,
            });
            assertPropString(borrower, 'id');

            await repo.testCreatesBlockchains({
              blockchains: [
                { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
                { key: 'bitcoin', name: 'Bitcoin', shortName: 'BTC', image: 'btc.png' },
              ],
            });

            // Setup platform config and exchange rates
            // All rates and ratios are in 0-1 decimal format (e.g., 0.025 = 2.5%)
            await repo.testSetupPlatformConfig({
              effectiveDate: generateUniqueConfigDate(),
              adminUserId: 1,
              loanProvisionRate: 0.025,
              loanIndividualRedeliveryFeeRate: 0.01,
              loanInstitutionRedeliveryFeeRate: 0.005,
              loanMinLtvRatio: 0.5,
              loanMaxLtvRatio: 0.75,
              loanRepaymentDurationInDays: 30,
            });

            await repo.testSetupPriceFeeds({
              blockchainKey: 'eip155:56',
              baseCurrencyTokenId: 'slip44:714',
              quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              source: 'test',
              bidPrice: 100000,
              askPrice: 100000,
              sourceDate: new Date('2024-01-01T10:00:00.000Z'),
            });

            const appliedDate = new Date('2024-01-01T10:00:00.000Z');
            const expirationDate = new Date('2024-01-31T23:59:59.999Z');

            // Create loan application (should be in 'PendingCollateral' status)
            const loanApplication = await borrowerCreatesLoanApplicationWithInvoice(repo, {
              borrowerUserId: borrower.id,
              collateralBlockchainKey: 'eip155:56',
              collateralTokenId: 'slip44:714',
              principalBlockchainKey: 'eip155:56',
              principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              principalAmount: '10000000000000000000', // 10 USDT in smallest units (18 decimals)
              provisionAmount: '250000000000000000', // 2.5% provision
              maxInterestRate: 0.2, // 20% in decimal format
              minLtvRatio: 0.5,
              maxLtvRatio: 0.75,
              termInMonths: 6,
              liquidationMode: 'Partial',
              collateralDepositAmount: '500000000000000', // 0.0005 BNB (18 decimals)
              collateralDepositExchangeRateId: '1',
              appliedDate,
              expirationDate,
              collateralInvoiceId: 88800,
              collateralInvoicePrepaidAmount: '0',
              collateralInvoiceDate: appliedDate,
              collateralInvoiceDueDate: expirationDate,
              collateralInvoiceExpiredDate: expirationDate,
              collateralWalletDerivationPath: "m/44'/0'/0'/0/88800",
              collateralWalletAddress: 'platform_test_address_88800',
            });

            // Verify loan application is initially in 'PendingCollateral' status
            equal(loanApplication.status, 'PendingCollateral');

            const paymentDate = new Date('2024-01-02T10:00:00.000Z');

            // Simulate paying the collateral invoice (this should trigger automatic publishing)
            await simulateLoanApplicationInvoicePayment(repo, loanApplication.id, paymentDate);

            // Verify loan application was automatically published
            const publishedApplicationRows = await repo.sql`
              SELECT id, status, published_date, collateral_prepaid_amount
              FROM loan_applications 
              WHERE id = ${loanApplication.id}
            `;

            equal(publishedApplicationRows.length, 1);
            const publishedApplication = publishedApplicationRows[0];
            assertDefined(publishedApplication, 'Published application validation failed');
            assertProp(check(isString, isNumber), publishedApplication, 'id');
            assertPropString(publishedApplication, 'status');
            assertProp(
              check(isString, isNumber),
              publishedApplication,
              'collateral_prepaid_amount',
            );
            assertProp(isInstanceOf(Date), publishedApplication, 'published_date');

            equal(publishedApplication.status, 'Published');
            deepEqual(new Date(publishedApplication.published_date), paymentDate);
            // Verify collateral_prepaid_amount was set
            ok(Number(publishedApplication.collateral_prepaid_amount) > 0);
          });
        });
      });

      describe('platformListsAvailableLoanOffers', function () {
        it('should list available loan offers successfully', async function () {
          // Setup test data with multiple loan offers
          const lender1 = await repo.betterAuthCreateUser({
            name: 'Lender 1',
            email: 'lender1@example.com',
            emailVerified: true,
          });
          assertPropString(lender1, 'id');

          const lender2 = await repo.betterAuthCreateUser({
            name: 'Lender 2',
            email: 'lender2@example.com',
            emailVerified: true,
          });
          assertPropString(lender2, 'id');

          await repo.testCreatesBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          const createdDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');
          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // Create and publish loan offers
          const loanOffer1 = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: lender1.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '1000000000', // 1000 USDT
            minLoanPrincipalAmount: '100000000', // 100 USDT
            maxLoanPrincipalAmount: '500000000', // 500 USDT
            interestRate: 0.155, // 15.5% in decimal format
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate,
            fundingInvoiceId: 52,
            fundingInvoicePrepaidAmount: '0',
            fundingInvoiceDate: createdDate,
            fundingInvoiceDueDate: expirationDate,
            fundingInvoiceExpiredDate: expirationDate,
            fundingWalletDerivationPath: "m/44'/0'/0'/0/52",
            fundingWalletAddress: 'test-funding-wallet-address-52',
          });

          const loanOffer2 = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: lender2.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '2000000000', // 2000 USDT
            minLoanPrincipalAmount: '200000000', // 200 USDT
            maxLoanPrincipalAmount: '1000000000', // 1000 USDT
            interestRate: 0.12, // 12% in decimal format, lower interest rate, should appear first
            termInMonthsOptions: [6, 12],
            expirationDate,
            createdDate,
            fundingInvoiceId: 53,
            fundingInvoicePrepaidAmount: '0',
            fundingInvoiceDate: createdDate,
            fundingInvoiceDueDate: expirationDate,
            fundingInvoiceExpiredDate: expirationDate,
            fundingWalletDerivationPath: "m/44'/0'/0'/0/53",
            fundingWalletAddress: 'test-funding-wallet-address-53',
          });

          // Publish both offers by simulating invoice payments
          await simulateLoanOfferInvoicePayment(repo, loanOffer1.id, publishedDate);
          await simulateLoanOfferInvoicePayment(repo, loanOffer2.id, publishedDate);

          // List available loan offers
          const result = await repo.platformListsAvailableLoanOffers({
            page: 1,
            limit: 10,
          });

          equal(result.loanOffers.length, 2);
          equal(result.pagination.total, 2);
          equal(result.pagination.page, 1);
          equal(result.pagination.limit, 10);
          equal(result.pagination.totalPages, 1);
          equal(result.pagination.hasNext, false);
          equal(result.pagination.hasPrev, false);

          // Should be ordered by interest rate (lower first)
          equal(result.loanOffers[0].id, loanOffer2.id);
          equal(result.loanOffers[0].interestRate, 0.12);
          equal(result.loanOffers[1].id, loanOffer1.id);
          equal(result.loanOffers[1].interestRate, 0.155);

          // Verify currency information
          equal(result.loanOffers[0].principalCurrency.symbol, 'USDC');
          equal(result.loanOffers[0].principalCurrency.decimals, 18);
        });

        it('should filter loan offers by principal currency', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Lender User',
            email: 'lender@example.com',
            emailVerified: true,
          });
          assertPropString(lender, 'id');

          await repo.testCreatesBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          const createdDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');
          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // Create USDC offer (only one offer since we only have one valid currency)
          const usdcOffer = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '1000000000', // 1000 USDT
            minLoanPrincipalAmount: '100000000', // 100 USDT
            maxLoanPrincipalAmount: '500000000', // 500 USDT
            interestRate: 0.155, // 15.5% in decimal format
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate,
            fundingInvoiceId: 54,
            fundingInvoicePrepaidAmount: '0',
            fundingInvoiceDate: createdDate,
            fundingInvoiceDueDate: expirationDate,
            fundingInvoiceExpiredDate: expirationDate,
            fundingWalletDerivationPath: "m/44'/0'/0'/0/54",
            fundingWalletAddress: 'test-funding-wallet-address-54',
          });

          // Publish the offer by simulating invoice payment
          await simulateLoanOfferInvoicePayment(repo, usdcOffer.id, publishedDate);

          // Filter by USDC
          const usdcResult = await repo.platformListsAvailableLoanOffers({
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          });

          equal(usdcResult.loanOffers.length, 1);
          equal(usdcResult.loanOffers[0].id, usdcOffer.id);
          equal(usdcResult.loanOffers[0].principalCurrency.symbol, 'USDC');

          // Test filtering with non-existent currency returns empty results
          const emptyResult = await repo.platformListsAvailableLoanOffers({
            principalBlockchainKey: 'eip155:1',
            principalTokenId: 'slip44:60', // ETH on mainnet (exists but no offers)
          });

          equal(emptyResult.loanOffers.length, 0);
        });
      });
    });

    describe('Loan Matching and Origination', function () {
      let lender: { id: string } & Record<string, unknown>;
      let borrower: { id: string } & Record<string, unknown>;
      let loanOffer: LenderCreatesLoanOfferResult;
      let loanApplication: BorrowerCreatesLoanApplicationResult;

      beforeEach(async function () {
        // Setup test users and currencies
        const lenderUser = await repo.betterAuthCreateUser({
          name: 'Lender User',
          email: 'lender@example.com',
          emailVerified: true,
        });
        assertPropString(lenderUser, 'id');
        lender = lenderUser;

        const borrowerUser = await repo.betterAuthCreateUser({
          name: 'Borrower User',
          email: 'borrower@example.com',
          emailVerified: true,
        });
        assertPropString(borrowerUser, 'id');
        borrower = borrowerUser;

        await repo.testCreatesBlockchains({
          blockchains: [{ key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' }],
        });

        // Use currencies already defined in the database schema

        // All rates and ratios are in 0-1 decimal format (e.g., 0.025 = 2.5%)
        await repo.testSetupPlatformConfig({
          effectiveDate: generateUniqueConfigDate(),
          adminUserId: 1,
          loanProvisionRate: 0.025,
          loanIndividualRedeliveryFeeRate: 0.01,
          loanInstitutionRedeliveryFeeRate: 0.005,
          loanMinLtvRatio: 0.5,
          loanMaxLtvRatio: 0.75,
          loanRepaymentDurationInDays: 30,
        });

        await repo.testSetupPriceFeeds({
          blockchainKey: 'eip155:56',
          baseCurrencyTokenId: 'slip44:714',
          quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          source: 'test',
          bidPrice: 2000,
          askPrice: 2010,
          sourceDate: new Date('2024-01-01T10:00:00.000Z'),
        });

        const createdDate = new Date('2024-01-01T10:00:00.000Z');
        const expirationDate = new Date('2024-01-31T23:59:59.999Z');

        // Create and publish loan offer
        loanOffer = await lenderCreatesLoanOfferWithInvoice(repo, {
          lenderUserId: lender.id,
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          offeredPrincipalAmount: '2000000000000000000', // 2 USDT in smallest units (18 decimals)
          minLoanPrincipalAmount: '100000000000000000', // 0.1 USDT in smallest units
          maxLoanPrincipalAmount: '1500000000000000000', // 1.5 USDT in smallest units (enough for 1 USDT loan application)
          interestRate: 0.155, // 15.5% in decimal format
          termInMonthsOptions: [3, 6, 12],
          expirationDate,
          createdDate,
          fundingInvoiceId: 55,
          fundingInvoicePrepaidAmount: '0',
          fundingInvoiceDate: createdDate,
          fundingInvoiceDueDate: expirationDate,
          fundingInvoiceExpiredDate: expirationDate,
          fundingWalletDerivationPath: "m/44'/0'/0'/0/55",
          fundingWalletAddress: 'test-funding-wallet-address-55',
        });

        await simulateLoanOfferInvoicePayment(
          repo,
          loanOffer.id,
          new Date('2024-01-02T10:00:00.000Z'),
        );

        // Create and publish loan application
        loanApplication = await borrowerCreatesLoanApplicationWithInvoice(repo, {
          borrowerUserId: borrower.id,
          collateralBlockchainKey: 'eip155:56',
          collateralTokenId: 'slip44:714',
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          principalAmount: '1000000000000000000', // 1 USDT in smallest units
          provisionAmount: '25000000000000000', // 2.5% provision
          maxInterestRate: 0.2, // 20% in decimal format
          minLtvRatio: 0.5,
          maxLtvRatio: 0.75,
          termInMonths: 6,
          liquidationMode: 'Partial',
          collateralDepositAmount: '250000000000000', // 0.00025 BNB in smallest units
          collateralDepositExchangeRateId: '1',
          appliedDate: createdDate,
          expirationDate,
          collateralInvoiceId: 88890,
          collateralInvoicePrepaidAmount: '0',
          collateralInvoiceDate: createdDate,
          collateralInvoiceDueDate: expirationDate,
          collateralInvoiceExpiredDate: expirationDate,
          collateralWalletDerivationPath: "m/44'/0'/0'/0/88890",
          collateralWalletAddress: 'platform_test_address3_88890',
        });

        await simulateLoanApplicationInvoicePayment(
          repo,
          loanApplication.id,
          new Date('2024-01-02T10:00:00.000Z'),
        );
      });

      describe('platformMatchesLoanOffers', function () {
        it('should match loan offer and application successfully', async function () {
          const matchedDate = new Date('2024-01-03T10:00:00.000Z');
          const matchedLtvRatio = 0.65; // 65%
          const matchedCollateralValuationAmount = '1538462'; // 1 USDT / 65% = ~1.54 USDT

          const matchResult = await repo.platformMatchesLoanOffers({
            loanApplicationId: loanApplication.id,
            loanOfferId: loanOffer.id,
            matchedDate,
            matchedLtvRatio,
            matchedCollateralValuationAmount,
          });

          equal(matchResult.loanApplicationId, loanApplication.id);
          equal(matchResult.loanOfferId, loanOffer.id);
          deepEqual(matchResult.matchedDate, matchedDate);
          equal(matchResult.matchedLtvRatio, matchedLtvRatio);
          equal(matchResult.matchedCollateralValuationAmount, matchedCollateralValuationAmount);
        });

        it('should reject matching non-existent loan application', async function () {
          await rejects(
            async () => {
              await repo.platformMatchesLoanOffers({
                loanApplicationId: '999999',
                loanOfferId: loanOffer.id,
                matchedDate: new Date('2024-01-03T10:00:00.000Z'),
                matchedLtvRatio: 0.65,
                matchedCollateralValuationAmount: '1538462',
              });
            },
            { message: 'Loan application not found or not in Published status' },
          );
        });

        it('should reject matching when same user is lender and borrower', async function () {
          // Create loan application from the same user who created the offer
          const sameLenderApplication = await borrowerCreatesLoanApplicationWithInvoice(repo, {
            borrowerUserId: lender.id, // Same as lender
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '1000000000000000000', // 1 USDT in smallest units
            provisionAmount: '25000000000000000', // 2.5% provision
            maxInterestRate: 0.2, // 20% in decimal format
            minLtvRatio: 0.5,
            maxLtvRatio: 0.75,
            termInMonths: 6,
            liquidationMode: 'Partial',
            collateralDepositAmount: '75000000000000000', // 0.075 BNB in smallest units
            collateralDepositExchangeRateId: '1',
            appliedDate: new Date('2024-01-01T10:00:00.000Z'),
            expirationDate: new Date('2024-01-31T23:59:59.999Z'),
            collateralInvoiceId: 88891,
            collateralInvoicePrepaidAmount: '0',
            collateralInvoiceDate: new Date('2024-01-01T10:00:00.000Z'),
            collateralInvoiceDueDate: new Date('2024-01-31T23:59:59.999Z'),
            collateralInvoiceExpiredDate: new Date('2024-01-31T23:59:59.999Z'),
            collateralWalletDerivationPath: "m/44'/0'/0'/0/88891",
            collateralWalletAddress: 'platform_test_address4_88891',
          });

          await simulateLoanApplicationInvoicePayment(
            repo,
            sameLenderApplication.id,
            new Date('2024-01-02T10:00:00.000Z'),
          );

          await rejects(
            async () => {
              await repo.platformMatchesLoanOffers({
                loanApplicationId: sameLenderApplication.id,
                loanOfferId: loanOffer.id,
                matchedDate: new Date('2024-01-03T10:00:00.000Z'),
                matchedLtvRatio: 0.65,
                matchedCollateralValuationAmount: '1538461',
              });
            },
            { message: 'Borrower and lender cannot be the same user' },
          );
        });
      });

      describe('platformOriginatesLoan', function () {
        let matchedLoanApplication: string;
        let matchedLoanOffer: string;

        beforeEach(async function () {
          // Match the loan offer and application first
          const matchedDate = new Date('2024-01-03T10:00:00.000Z');
          const matchedLtvRatio = 0.65;
          const matchedCollateralValuationAmount = '769230769';

          await repo.platformMatchesLoanOffers({
            loanApplicationId: loanApplication.id,
            loanOfferId: loanOffer.id,
            matchedDate,
            matchedLtvRatio,
            matchedCollateralValuationAmount,
          });

          matchedLoanApplication = loanApplication.id;
          matchedLoanOffer = loanOffer.id;
        });

        it('should originate loan successfully', async function () {
          const originationDate = new Date('2024-01-04T10:00:00.000Z');
          const maturityDate = new Date('2024-07-04T10:00:00.000Z'); // 6 months later

          const principalAmount = '1000000'; // 1 USDT
          const interestAmount = '77500'; // 15.5% * 1 USDT * (6/12) = 0.0775 USDT
          const _provisionAmount = '25000'; // 2.5% * 1 USDT = 0.025 USDT
          const repaymentAmount = '1102500'; // principal + interest + provision
          const redeliveryFeeAmount = '775'; // 1% * interestAmount
          const redeliveryAmount = '1076725'; // principal + interest - redelivery fee
          const premiAmount = '10000'; // Example premi amount
          const liquidationFeeAmount = '20000'; // Example liquidation fee
          const minCollateralValuation = '1132500'; // repayment + premi + liquidation fee
          const mcLtvRatio = 0.88; // principal / min collateral valuation
          const collateralAmount = '770000000000000'; // ~0.00077 ETH at 2000 USDT/ETH

          const originationResult = await repo.platformOriginatesLoan({
            loanOfferId: matchedLoanOffer,
            loanApplicationId: matchedLoanApplication,
            principalAmount,
            interestAmount,
            repaymentAmount,
            redeliveryFeeAmount,
            redeliveryAmount,
            premiAmount,
            liquidationFeeAmount,
            minCollateralValuation,
            mcLtvRatio,
            collateralAmount,
            legalDocumentPath: '/legal/loan_123.pdf',
            legalDocumentHash: 'abc123def456',
            originationDate,
            maturityDate,
          });

          ok(originationResult.id);
          equal(originationResult.loanOfferId, matchedLoanOffer);
          equal(originationResult.loanApplicationId, matchedLoanApplication);
          equal(originationResult.principalAmount, principalAmount);
          equal(originationResult.interestAmount, interestAmount);
          equal(originationResult.repaymentAmount, repaymentAmount);
          equal(originationResult.collateralAmount, collateralAmount);
          equal(originationResult.status, 'Originated');
          deepEqual(originationResult.originationDate, originationDate);
          deepEqual(originationResult.maturityDate, maturityDate);
          equal(originationResult.mcLtvRatio, mcLtvRatio);
          equal(originationResult.legalDocumentPath, '/legal/loan_123.pdf');
        });

        it('should reject originating loan with invalid application status', async function () {
          // Create unmatched loan application
          const unmatchedApplication = await borrowerCreatesLoanApplicationWithInvoice(repo, {
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '300000000000000000000', // 300 USDT in smallest units
            provisionAmount: '7500000000000000000', // 2.5% provision
            maxInterestRate: 0.2, // 20% in decimal format
            minLtvRatio: 0.5,
            maxLtvRatio: 0.75,
            termInMonths: 6,
            liquidationMode: 'Partial',
            collateralDepositAmount: '75000000000000000', // 0.075 BNB in smallest units
            collateralDepositExchangeRateId: '1',
            appliedDate: new Date('2024-01-01T10:00:00.000Z'),
            expirationDate: new Date('2024-01-31T23:59:59.999Z'),
            collateralInvoiceId: 88892,
            collateralInvoicePrepaidAmount: '0',
            collateralInvoiceDate: new Date('2024-01-01T10:00:00.000Z'),
            collateralInvoiceDueDate: new Date('2024-01-31T23:59:59.999Z'),
            collateralInvoiceExpiredDate: new Date('2024-01-31T23:59:59.999Z'),
            collateralWalletDerivationPath: "m/44'/0'/0'/0/88892",
            collateralWalletAddress: 'platform_test_address5_88892',
          });

          await simulateLoanApplicationInvoicePayment(
            repo,
            unmatchedApplication.id,
            new Date('2024-01-02T10:00:00.000Z'),
          );

          await rejects(
            async () => {
              await repo.platformOriginatesLoan({
                loanOfferId: matchedLoanOffer,
                loanApplicationId: unmatchedApplication.id,
                principalAmount: '300000000',
                interestAmount: '23250000',
                repaymentAmount: '330750000',
                redeliveryFeeAmount: '232500',
                redeliveryAmount: '322517500',
                premiAmount: '3000000',
                liquidationFeeAmount: '6000000',
                minCollateralValuation: '339750000',
                mcLtvRatio: 0.88,
                collateralAmount: '231000000000000000',
                originationDate: new Date('2024-01-04T10:00:00.000Z'),
                maturityDate: new Date('2024-07-04T10:00:00.000Z'),
              });
            },
            {
              message:
                'Loan application and offer not found or not in correct status for origination',
            },
          );
        });
      });
    });

    describe('Loan Operations', function () {
      let originatedLoan: PlatformOriginatesLoanResult;

      beforeEach(async function () {
        // Setup complete loan workflow up to origination
        const lender = await repo.betterAuthCreateUser({
          name: 'Lender User',
          email: 'lender@example.com',
          emailVerified: true,
        });
        assertPropString(lender, 'id');

        const borrower = await repo.betterAuthCreateUser({
          name: 'Borrower User',
          email: 'borrower@example.com',
          emailVerified: true,
        });
        assertPropString(borrower, 'id');

        await repo.testCreatesBlockchains({
          blockchains: [{ key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' }],
        });

        // Use currencies already defined in the database schema

        // All rates and ratios are in 0-1 decimal format (e.g., 0.025 = 2.5%)
        await repo.testSetupPlatformConfig({
          effectiveDate: generateUniqueConfigDate(),
          adminUserId: 1,
          loanProvisionRate: 0.025,
          loanIndividualRedeliveryFeeRate: 0.01,
          loanInstitutionRedeliveryFeeRate: 0.005,
          loanMinLtvRatio: 0.5,
          loanMaxLtvRatio: 0.75,
          loanRepaymentDurationInDays: 30,
        });

        await repo.testSetupPriceFeeds({
          blockchainKey: 'eip155:56',
          baseCurrencyTokenId: 'slip44:714',
          quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          source: 'test',
          bidPrice: 2000,
          askPrice: 2010,
          sourceDate: new Date('2024-01-01T10:00:00.000Z'),
        });

        // Create and publish loan offer
        const loanOffer = await lenderCreatesLoanOfferWithInvoice(repo, {
          lenderUserId: lender.id,
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          offeredPrincipalAmount: '10000000000000000',
          minLoanPrincipalAmount: '1000000000000000',
          maxLoanPrincipalAmount: '5000000000000000',
          interestRate: 0.155, // 15.5% in decimal format
          termInMonthsOptions: [3, 6, 12],
          expirationDate: new Date('2024-01-31T23:59:59.999Z'),
          createdDate: new Date('2024-01-01T10:00:00.000Z'),
          fundingInvoiceId: 56,
          fundingInvoicePrepaidAmount: '0',
          fundingInvoiceDate: new Date('2024-01-01T10:00:00.000Z'),
          fundingInvoiceDueDate: new Date('2024-01-31T23:59:59.999Z'),
          fundingInvoiceExpiredDate: new Date('2024-01-31T23:59:59.999Z'),
          fundingWalletDerivationPath: "m/44'/0'/0'/0/56",
          fundingWalletAddress: 'test-funding-wallet-address-56',
        });

        await simulateLoanOfferInvoicePayment(
          repo,
          loanOffer.id,
          new Date('2024-01-02T10:00:00.000Z'),
        );

        // Create and publish loan application
        const loanApplication = await borrowerCreatesLoanApplicationWithInvoice(repo, {
          borrowerUserId: borrower.id,
          collateralBlockchainKey: 'eip155:56',
          collateralTokenId: 'slip44:714',
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          principalAmount: '1000000000000000', // 1 USDT in smallest units
          provisionAmount: '25000000000000', // 2.5% provision
          maxInterestRate: 0.2, // 20% in decimal format
          minLtvRatio: 0.5,
          maxLtvRatio: 0.75,
          termInMonths: 6,
          liquidationMode: 'Partial',
          collateralDepositAmount: '250000000000000', // 0.00025 BNB in smallest units
          collateralDepositExchangeRateId: '1',
          appliedDate: new Date('2024-01-01T10:00:00.000Z'),
          expirationDate: new Date('2024-01-31T23:59:59.999Z'),
          collateralInvoiceId: 88893,
          collateralInvoicePrepaidAmount: '0',
          collateralInvoiceDate: new Date('2024-01-01T10:00:00.000Z'),
          collateralInvoiceDueDate: new Date('2024-01-31T23:59:59.999Z'),
          collateralInvoiceExpiredDate: new Date('2024-01-31T23:59:59.999Z'),
          collateralWalletDerivationPath: "m/44'/0'/0'/0/88893",
          collateralWalletAddress: 'platform_test_address6_88893',
        });

        await simulateLoanApplicationInvoicePayment(
          repo,
          loanApplication.id,
          new Date('2024-01-02T10:00:00.000Z'),
        );

        // Match loan offer and application
        await repo.platformMatchesLoanOffers({
          loanApplicationId: loanApplication.id,
          loanOfferId: loanOffer.id,
          matchedDate: new Date('2024-01-03T10:00:00.000Z'),
          matchedLtvRatio: 0.65,
          matchedCollateralValuationAmount: '1538462',
        });

        // Originate loan
        originatedLoan = await repo.platformOriginatesLoan({
          loanOfferId: loanOffer.id,
          loanApplicationId: loanApplication.id,
          principalAmount: '1000000000000000',
          interestAmount: '77500000000000',
          repaymentAmount: '1102500000000000',
          redeliveryFeeAmount: '775000000000',
          redeliveryAmount: '1076725000000000',
          premiAmount: '10000000000000',
          liquidationFeeAmount: '20000000000000',
          minCollateralValuation: '1132500000000000',
          mcLtvRatio: 0.88,
          collateralAmount: '770000000000000',
          originationDate: new Date('2024-01-04T10:00:00.000Z'),
          maturityDate: new Date('2024-07-04T10:00:00.000Z'),
        });
      });

      describe('platformDisbursesPrincipal', function () {
        it('should disburse principal and activate loan successfully', async function () {
          const disbursementDate = new Date('2024-01-05T10:00:00.000Z');

          const disbursementResult = await repo.platformDisbursesPrincipal({
            loanId: originatedLoan.id,
            disbursementDate,
          });

          equal(disbursementResult.id, originatedLoan.id);
          equal(disbursementResult.status, 'Active');
          deepEqual(disbursementResult.disbursementDate, disbursementDate);
        });

        it('should reject disbursing principal for non-existent loan', async function () {
          await rejects(
            async () => {
              await repo.platformDisbursesPrincipal({
                loanId: '999999',
                disbursementDate: new Date('2024-01-05T10:00:00.000Z'),
              });
            },
            { message: 'Loan not found' },
          );
        });

        it('should reject disbursing principal for non-Originated loan', async function () {
          // First disburse the loan to make it Active
          await repo.platformDisbursesPrincipal({
            loanId: originatedLoan.id,
            disbursementDate: new Date('2024-01-05T10:00:00.000Z'),
          });

          // Try to disburse again
          await rejects(
            async () => {
              await repo.platformDisbursesPrincipal({
                loanId: originatedLoan.id,
                disbursementDate: new Date('2024-01-06T10:00:00.000Z'),
              });
            },
            { message: 'Cannot disburse principal for loan with status: Active' },
          );
        });
      });

      describe('platformUpdatesLoanValuations', function () {
        beforeEach(async function () {
          // Disburse principal to make loan active
          await repo.platformDisbursesPrincipal({
            loanId: originatedLoan.id,
            disbursementDate: new Date('2024-01-05T10:00:00.000Z'),
          });
        });

        it('should update loan valuation successfully', async function () {
          // Setup new exchange rate for valuation
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test_updated',
            bidPrice: 1800, // ETH price dropped
            askPrice: 1810,
            sourceDate: new Date('2024-01-10T10:00:00.000Z'),
          });

          const valuationDate = new Date('2024-01-10T10:00:00.000Z');
          const ltvRatio = 0.72; // Higher LTV due to price drop
          const collateralValuationAmount = '693000000'; // 0.385 ETH * 1800 USDT/ETH

          const valuationResult = await repo.platformUpdatesLoanValuations({
            loanId: originatedLoan.id,
            exchangeRateId,
            valuationDate,
            ltvRatio,
            collateralValuationAmount,
          });

          equal(valuationResult.loanId, originatedLoan.id);
          equal(valuationResult.exchangeRateId, exchangeRateId);
          deepEqual(valuationResult.valuationDate, valuationDate);
          equal(valuationResult.ltvRatio, ltvRatio);
          equal(valuationResult.collateralValuationAmount, collateralValuationAmount);
        });

        it('should reject updating valuation for non-existent loan', async function () {
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test_updated',
            bidPrice: 1800,
            askPrice: 1810,
            sourceDate: new Date('2024-01-10T10:00:00.000Z'),
          });

          await rejects(
            async () => {
              await repo.platformUpdatesLoanValuations({
                loanId: '999999',
                exchangeRateId,
                valuationDate: new Date('2024-01-10T10:00:00.000Z'),
                ltvRatio: 0.72,
                collateralValuationAmount: '693000000',
              });
            },
            { message: 'Loan not found' },
          );
        });
      });

      describe('platformMonitorsLtvRatios', function () {
        beforeEach(async function () {
          // Disburse principal and update valuation to create LTV breach scenario
          await repo.platformDisbursesPrincipal({
            loanId: originatedLoan.id,
            disbursementDate: new Date('2024-01-05T10:00:00.000Z'),
          });

          // Update valuation with high LTV ratio (breaching threshold)
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test_breach',
            bidPrice: 1500, // Significant price drop
            askPrice: 1510,
            sourceDate: new Date('2024-01-10T10:00:00.000Z'),
          });

          await repo.platformUpdatesLoanValuations({
            loanId: originatedLoan.id,
            exchangeRateId,
            valuationDate: new Date('2024-01-10T10:00:00.000Z'),
            ltvRatio: 0.87, // High LTV ratio (above 75% platform threshold)
            collateralValuationAmount: '577500000', // 0.385 ETH * 1500 USDT/ETH
          });
        });

        it('should monitor LTV ratios and identify breached loans', async function () {
          const monitoringDate = new Date('2024-01-10T12:00:00.000Z');

          const monitoringResult = await repo.platformMonitorsLtvRatios({
            monitoringDate,
            ltvThreshold: 0.75, // 75% threshold
          });

          equal(monitoringResult.processedLoans, 1);
          equal(monitoringResult.breachedLoans.length, 1);

          const breachedLoan = monitoringResult.breachedLoans[0];
          equal(breachedLoan.loanId, originatedLoan.id);
          equal(breachedLoan.currentLtvRatio, 0.87);
          equal(breachedLoan.mcLtvRatio, originatedLoan.mcLtvRatio);
          deepEqual(breachedLoan.breachDate, monitoringDate);
        });

        it('should use platform config for default LTV threshold', async function () {
          const monitoringDate = new Date('2024-01-10T12:00:00.000Z');

          const monitoringResult = await repo.platformMonitorsLtvRatios({
            monitoringDate,
          });

          equal(monitoringResult.processedLoans, 1);
          equal(monitoringResult.breachedLoans.length, 1); // Should detect breach with platform config threshold (75%)
        });
      });

      describe('platformLiquidatesCollateral', function () {
        beforeEach(async function () {
          // Activate loan first
          await repo.platformDisbursesPrincipal({
            loanId: originatedLoan.id,
            disbursementDate: new Date('2024-01-05T10:00:00.000Z'),
          });
        });

        it('should create liquidation order successfully', async function () {
          const orderDate = new Date('2024-01-15T10:00:00.000Z');
          const orderRef = `liquidation_${originatedLoan.id}_${Date.now()}`;

          const liquidationResult = await repo.platformLiquidatesCollateral({
            loanId: originatedLoan.id,
            liquidationTargetAmount: '566250000', // min collateral valuation
            marketProvider: 'UniswapV3',
            marketSymbol: 'ETH/USDT',
            orderRef,
            orderQuantity: '385000000000000000', // 0.385 ETH
            orderPrice: '1500000000', // 1500 USDT/ETH
            orderDate,
            liquidationInitiator: 'Platform',
          });

          equal(liquidationResult.loanId, originatedLoan.id);
          equal(liquidationResult.liquidationStatus, 'Pending');
          equal(liquidationResult.orderRef, orderRef);
          deepEqual(liquidationResult.orderDate, orderDate);
          equal(liquidationResult.liquidationTargetAmount, '566250000');
        });

        it('should reject liquidating non-existent loan', async function () {
          await rejects(
            async () => {
              await repo.platformLiquidatesCollateral({
                loanId: '999999',
                liquidationTargetAmount: '566250000',
                marketProvider: 'UniswapV3',
                marketSymbol: 'ETH/USDT',
                orderRef: 'test_order_999',
                orderQuantity: '385000000000000000',
                orderPrice: '1500000000',
                orderDate: new Date('2024-01-15T10:00:00.000Z'),
                liquidationInitiator: 'Platform',
              });
            },
            { message: 'Loan not found' },
          );
        });

        it('should reject creating duplicate liquidation', async function () {
          const orderDate = new Date('2024-01-15T10:00:00.000Z');
          const liquidationParams = {
            loanId: originatedLoan.id,
            liquidationTargetAmount: '566250000',
            marketProvider: 'UniswapV3',
            marketSymbol: 'ETH/USDT',
            orderRef: 'test_order_1',
            orderQuantity: '385000000000000000',
            orderPrice: '1500000000',
            orderDate,
            liquidationInitiator: 'Platform' as const,
          };

          // First liquidation should work
          await repo.platformLiquidatesCollateral(liquidationParams);

          // Second liquidation should fail
          await rejects(
            async () => {
              await repo.platformLiquidatesCollateral({
                ...liquidationParams,
                orderRef: 'test_order_2',
              });
            },
            { message: 'Liquidation already exists for this loan' },
          );
        });
      });
    });
  });
}
