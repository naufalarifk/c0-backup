import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { assertArrayOf, assertDefined, assertPropStringOrNumber } from '../utils';
import { createEarlyExitNodeTestIt } from '../utils/node-test';
import {
  BorrowerCreatesLoanApplicationResult,
  LenderCreatesLoanOfferResult,
  PlatformOriginatesLoanResult,
} from './loan.types';
import { LoanPlatformRepository } from './loan-platform.repository';

let configDateCounter = 0;
function generateUniqueConfigDate(): Date {
  const month = Math.max(1, 12 - configDateCounter);
  configDateCounter++;
  return new Date(`2023-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
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
      describe('platformPublishesLoanOffer', function () {
        it('should publish loan offer successfully', async function () {
          // Setup test data
          const lender = await repo.betterAuthCreateUser({
            name: 'Lender User',
            email: 'lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          const createdDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');

          // Create loan offer
          const loanOffer = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '1000000000', // 1000 USDT
            minLoanPrincipalAmount: '100000000', // 100 USDT
            maxLoanPrincipalAmount: '500000000', // 500 USDT
            interestRate: 15.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate,
          });

          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // Publish the loan offer
          const publishResult = await repo.platformPublishesLoanOffer({
            loanOfferId: loanOffer.id,
            publishedDate,
          });

          equal(publishResult.id, loanOffer.id);
          equal(publishResult.status, 'Published');
          deepEqual(publishResult.publishedDate, publishedDate);
        });

        it('should reject publishing non-existent loan offer', async function () {
          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          await rejects(
            async () => {
              await repo.platformPublishesLoanOffer({
                loanOfferId: '999999',
                publishedDate,
              });
            },
            { message: 'Loan offer not found' },
          );
        });

        it('should reject publishing loan offer not in Funding status', async function () {
          // Setup test data with already published loan offer
          const lender = await repo.betterAuthCreateUser({
            name: 'Lender User',
            email: 'lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          const createdDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');

          const loanOffer = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '1000000000',
            minLoanPrincipalAmount: '100000000',
            maxLoanPrincipalAmount: '500000000',
            interestRate: 15.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate,
          });

          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // First publish should work
          await repo.platformPublishesLoanOffer({
            loanOfferId: loanOffer.id,
            publishedDate,
          });

          // Second publish should fail
          await rejects(
            async () => {
              await repo.platformPublishesLoanOffer({
                loanOfferId: loanOffer.id,
                publishedDate: new Date('2024-01-03T10:00:00.000Z'),
              });
            },
            { message: 'Cannot publish loan offer from status: Published' },
          );
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

          const lender2 = await repo.betterAuthCreateUser({
            name: 'Lender 2',
            email: 'lender2@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          const createdDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');
          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // Create and publish loan offers
          const loanOffer1 = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender1.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '1000000000', // 1000 USDT
            minLoanPrincipalAmount: '100000000', // 100 USDT
            maxLoanPrincipalAmount: '500000000', // 500 USDT
            interestRate: 15.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate,
          });

          const loanOffer2 = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender2.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '2000000000', // 2000 USDT
            minLoanPrincipalAmount: '200000000', // 200 USDT
            maxLoanPrincipalAmount: '1000000000', // 1000 USDT
            interestRate: 12.0, // Lower interest rate, should appear first
            termInMonthsOptions: [6, 12],
            expirationDate,
            createdDate,
          });

          // Publish both offers
          await repo.platformPublishesLoanOffer({
            loanOfferId: loanOffer1.id,
            publishedDate,
          });

          await repo.platformPublishesLoanOffer({
            loanOfferId: loanOffer2.id,
            publishedDate,
          });

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
          equal(result.loanOffers[0].interestRate, 12.0);
          equal(result.loanOffers[1].id, loanOffer1.id);
          equal(result.loanOffers[1].interestRate, 15.5);

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

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          const createdDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');
          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // Create USDC offer (only one offer since we only have one valid currency)
          const usdcOffer = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '1000000000000000000000',
            minLoanPrincipalAmount: '100000000000000000000',
            maxLoanPrincipalAmount: '500000000000000000000',
            interestRate: 15.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate,
          });

          // Publish the offer
          await repo.platformPublishesLoanOffer({
            loanOfferId: usdcOffer.id,
            publishedDate,
          });

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

    describe('Loan Application Platform Management', function () {
      describe('platformPublishesLoanApplication', function () {
        it('should publish loan application successfully', async function () {
          // Setup borrower and currencies
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          // Setup platform config and exchange rates
          await repo.testSetupPlatformConfig({
            effectiveDate: generateUniqueConfigDate(),
            adminUserId: 1,
            loanProvisionRate: 2.5,
            loanIndividualRedeliveryFeeRate: 1.0,
            loanInstitutionRedeliveryFeeRate: 0.5,
            loanMinLtvRatio: 50,
            loanMaxLtvRatio: 75,
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

          const appliedDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');

          // Create loan application
          const loanApplication = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '1000000000', // 1000 USDT
            maxInterestRate: 20.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate,
            expirationDate,
          });

          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // Publish the loan application
          const publishResult = await repo.platformPublishesLoanApplication({
            loanApplicationId: loanApplication.id,
            publishedDate,
          });

          equal(publishResult.id, loanApplication.id);
          equal(publishResult.status, 'Published');
          deepEqual(publishResult.publishedDate, publishedDate);
        });

        it('should reject publishing non-existent loan application', async function () {
          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          await rejects(
            async () => {
              await repo.platformPublishesLoanApplication({
                loanApplicationId: '999999',
                publishedDate,
              });
            },
            { message: 'Loan application not found' },
          );
        });

        it('should reject publishing application not in PendingCollateral status', async function () {
          // Setup test data with already published loan application
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          // Use currencies already defined in the database schema

          await repo.testSetupPlatformConfig({
            effectiveDate: generateUniqueConfigDate(),
            adminUserId: 1,
            loanProvisionRate: 2.5,
            loanIndividualRedeliveryFeeRate: 1.0,
            loanInstitutionRedeliveryFeeRate: 0.5,
            loanMinLtvRatio: 50,
            loanMaxLtvRatio: 75,
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

          const appliedDate = new Date('2024-01-01T10:00:00.000Z');
          const expirationDate = new Date('2024-01-31T23:59:59.999Z');

          const loanApplication = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '1000000000',
            maxInterestRate: 20.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate,
            expirationDate,
          });

          const publishedDate = new Date('2024-01-02T10:00:00.000Z');

          // First publish should work
          await repo.platformPublishesLoanApplication({
            loanApplicationId: loanApplication.id,
            publishedDate,
          });

          // Second publish should fail
          await rejects(
            async () => {
              await repo.platformPublishesLoanApplication({
                loanApplicationId: loanApplication.id,
                publishedDate: new Date('2024-01-03T10:00:00.000Z'),
              });
            },
            { message: 'Cannot publish loan application from status: Published' },
          );
        });
      });
    });

    describe('Loan Matching and Origination', function () {
      let lender: { id: string };
      let borrower: { id: string };
      let loanOffer: LenderCreatesLoanOfferResult;
      let loanApplication: BorrowerCreatesLoanApplicationResult;

      beforeEach(async function () {
        // Setup test users and currencies
        lender = await repo.betterAuthCreateUser({
          name: 'Lender User',
          email: 'lender@example.com',
          emailVerified: true,
        });

        borrower = await repo.betterAuthCreateUser({
          name: 'Borrower User',
          email: 'borrower@example.com',
          emailVerified: true,
        });

        await repo.systemCreatesTestBlockchains({
          blockchains: [{ key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' }],
        });

        // Use currencies already defined in the database schema

        await repo.testSetupPlatformConfig({
          effectiveDate: generateUniqueConfigDate(),
          adminUserId: 1,
          loanProvisionRate: 2.5,
          loanIndividualRedeliveryFeeRate: 1.0,
          loanInstitutionRedeliveryFeeRate: 0.5,
          loanMinLtvRatio: 50,
          loanMaxLtvRatio: 75,
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
        loanOffer = await repo.lenderCreatesLoanOffer({
          lenderUserId: lender.id,
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          offeredPrincipalAmount: '1000000000', // 1000 USDT
          minLoanPrincipalAmount: '100000000', // 100 USDT
          maxLoanPrincipalAmount: '500000000', // 500 USDT
          interestRate: 15.5,
          termInMonthsOptions: [3, 6, 12],
          expirationDate,
          createdDate,
        });

        await repo.platformPublishesLoanOffer({
          loanOfferId: loanOffer.id,
          publishedDate: new Date('2024-01-02T10:00:00.000Z'),
        });

        // Create and publish loan application
        loanApplication = await repo.borrowerCreatesLoanApplication({
          borrowerUserId: borrower.id,
          collateralBlockchainKey: 'eip155:56',
          collateralTokenId: 'slip44:714',
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          principalAmount: '500000000', // 500 USDT (within range)
          maxInterestRate: 20.0,
          termInMonths: 6,
          liquidationMode: 'Partial',
          appliedDate: createdDate,
          expirationDate,
        });

        await repo.platformPublishesLoanApplication({
          loanApplicationId: loanApplication.id,
          publishedDate: new Date('2024-01-02T10:00:00.000Z'),
        });
      });

      describe('platformMatchesLoanOffers', function () {
        it('should match loan offer and application successfully', async function () {
          const matchedDate = new Date('2024-01-03T10:00:00.000Z');
          const matchedLtvRatio = 0.65; // 65%
          const matchedCollateralValuationAmount = '769230769'; // 500 USDT / 65% = ~769 USDT

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
                matchedCollateralValuationAmount: '769230769',
              });
            },
            { message: 'Loan application not found or not in Published status' },
          );
        });

        it('should reject matching when same user is lender and borrower', async function () {
          // Create loan application from the same user who created the offer
          const sameLenderApplication = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: lender.id, // Same as lender
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '300000000',
            maxInterestRate: 20.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate: new Date('2024-01-01T10:00:00.000Z'),
            expirationDate: new Date('2024-01-31T23:59:59.999Z'),
          });

          await repo.platformPublishesLoanApplication({
            loanApplicationId: sameLenderApplication.id,
            publishedDate: new Date('2024-01-02T10:00:00.000Z'),
          });

          await rejects(
            async () => {
              await repo.platformMatchesLoanOffers({
                loanApplicationId: sameLenderApplication.id,
                loanOfferId: loanOffer.id,
                matchedDate: new Date('2024-01-03T10:00:00.000Z'),
                matchedLtvRatio: 0.65,
                matchedCollateralValuationAmount: '461538461',
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

          const principalAmount = '500000000'; // 500 USDT
          const interestAmount = '38750000'; // 15.5% * 500 USDT * (6/12) = 38.75 USDT
          const provisionAmount = '12500000'; // 2.5% * 500 USDT = 12.5 USDT
          const repaymentAmount = '551250000'; // principal + interest + provision
          const redeliveryFeeAmount = '387500'; // 1% * interestAmount
          const redeliveryAmount = '538362500'; // principal + interest - redelivery fee
          const premiAmount = '5000000'; // Example premi amount
          const liquidationFeeAmount = '10000000'; // Example liquidation fee
          const minCollateralValuation = '566250000'; // repayment + premi + liquidation fee
          const mcLtvRatio = 0.88; // principal / min collateral valuation
          const collateralAmount = '385000000000000000'; // ~0.385 ETH at 2000 USDT/ETH

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
          const unmatchedApplication = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '300000000',
            maxInterestRate: 20.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate: new Date('2024-01-01T10:00:00.000Z'),
            expirationDate: new Date('2024-01-31T23:59:59.999Z'),
          });

          await repo.platformPublishesLoanApplication({
            loanApplicationId: unmatchedApplication.id,
            publishedDate: new Date('2024-01-02T10:00:00.000Z'),
          });

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

        const borrower = await repo.betterAuthCreateUser({
          name: 'Borrower User',
          email: 'borrower@example.com',
          emailVerified: true,
        });

        await repo.systemCreatesTestBlockchains({
          blockchains: [{ key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' }],
        });

        // Use currencies already defined in the database schema

        await repo.testSetupPlatformConfig({
          effectiveDate: generateUniqueConfigDate(),
          adminUserId: 1,
          loanProvisionRate: 2.5,
          loanIndividualRedeliveryFeeRate: 1.0,
          loanInstitutionRedeliveryFeeRate: 0.5,
          loanMinLtvRatio: 50,
          loanMaxLtvRatio: 75,
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
        const loanOffer = await repo.lenderCreatesLoanOffer({
          lenderUserId: lender.id,
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          offeredPrincipalAmount: '1000000000',
          minLoanPrincipalAmount: '100000000',
          maxLoanPrincipalAmount: '500000000',
          interestRate: 15.5,
          termInMonthsOptions: [3, 6, 12],
          expirationDate: new Date('2024-01-31T23:59:59.999Z'),
          createdDate: new Date('2024-01-01T10:00:00.000Z'),
        });

        await repo.platformPublishesLoanOffer({
          loanOfferId: loanOffer.id,
          publishedDate: new Date('2024-01-02T10:00:00.000Z'),
        });

        // Create and publish loan application
        const loanApplication = await repo.borrowerCreatesLoanApplication({
          borrowerUserId: borrower.id,
          collateralBlockchainKey: 'eip155:56',
          collateralTokenId: 'slip44:714',
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          principalAmount: '500000000',
          maxInterestRate: 20.0,
          termInMonths: 6,
          liquidationMode: 'Partial',
          appliedDate: new Date('2024-01-01T10:00:00.000Z'),
          expirationDate: new Date('2024-01-31T23:59:59.999Z'),
        });

        await repo.platformPublishesLoanApplication({
          loanApplicationId: loanApplication.id,
          publishedDate: new Date('2024-01-02T10:00:00.000Z'),
        });

        // Match loan offer and application
        await repo.platformMatchesLoanOffers({
          loanApplicationId: loanApplication.id,
          loanOfferId: loanOffer.id,
          matchedDate: new Date('2024-01-03T10:00:00.000Z'),
          matchedLtvRatio: 0.65,
          matchedCollateralValuationAmount: '769230769',
        });

        // Originate loan
        originatedLoan = await repo.platformOriginatesLoan({
          loanOfferId: loanOffer.id,
          loanApplicationId: loanApplication.id,
          principalAmount: '500000000',
          interestAmount: '38750000',
          repaymentAmount: '551250000',
          redeliveryFeeAmount: '387500',
          redeliveryAmount: '538362500',
          premiAmount: '5000000',
          liquidationFeeAmount: '10000000',
          minCollateralValuation: '566250000',
          mcLtvRatio: 0.88,
          collateralAmount: '385000000000000000',
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
