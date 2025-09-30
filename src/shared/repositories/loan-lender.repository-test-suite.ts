import type { AppConfigService } from '../services/app-config.service';
import type { LenderCreatesLoanOfferParams } from './loan.types';

import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { assertArrayMapOf, assertDefined } from 'typeshaper';

import { InvoiceIdGenerator } from '../invoice/invoice-id.generator';
import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { BorrowerCreatesLoanApplicationResult, LenderCreatesLoanOfferResult } from './loan.types';
import { LoanLenderRepository } from './loan-lender.repository';

const testInvoiceIdGenerator = new InvoiceIdGenerator({
  invoiceConfig: {
    epochMs: Date.UTC(2024, 0, 1),
    workerId: 0,
  },
} as unknown as AppConfigService);

async function createFundingInvoiceParams(
  repo: LoanLenderRepository,
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

async function lenderCreatesLoanOfferWithInvoice(
  repo: LoanLenderRepository,
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

export async function runLoanLenderRepositoryTestSuite(
  createRepo: () => Promise<LoanLenderRepository>,
  teardownRepo: (repo: LoanLenderRepository) => Promise<void>,
): Promise<void> {
  await suite('LoanLenderRepository', function () {
    const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();
    let repo: LoanLenderRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('Loan Offer Management', function () {
      describe('lenderCreatesLoanOffer', function () {
        it('should create loan offer with funding invoice successfully', async function () {
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

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Binance-Peg USD Coin',
                symbol: 'USDC',
                decimals: 18,
                image: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
              },
            ],
          });

          const createDate = new Date('2024-01-01T00:00:00Z');
          const expirationDate = new Date('2024-02-01T00:00:00Z');

          const result = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000', // 10 USDC (18 decimals)
            minLoanPrincipalAmount: '1000000000', // 1 USDC
            maxLoanPrincipalAmount: '5000000000', // 5 USDC
            interestRate: 12.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate: createDate,
            fundingWalletDerivationPath: "m/44'/0'/0'/0/1",
            fundingWalletAddress: 'test-funding-wallet-address-1',
          });

          // Verify loan offer details
          equal(typeof result.id, 'string');
          equal(result.lenderUserId, String(lender.id));
          equal(result.principalCurrency.blockchainKey, 'eip155:56');
          equal(
            result.principalCurrency.tokenId,
            'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          );
          equal(result.principalCurrency.symbol, 'USDC');
          equal(result.principalCurrency.decimals, 18);
          equal(result.offeredPrincipalAmount, '10000000000');
          equal(result.availablePrincipalAmount, '10000000000');
          equal(result.minLoanPrincipalAmount, '1000000000');
          equal(result.maxLoanPrincipalAmount, '5000000000');
          equal(result.interestRate, 12.5);
          deepEqual(result.termInMonthsOptions, [3, 6, 12]);
          equal(result.status, 'Funding');
          equal(result.createdDate.toISOString(), createDate.toISOString());
          equal(result.expirationDate.toISOString(), expirationDate.toISOString());

          // Verify funding invoice details
          equal(typeof result.fundingInvoice.id, 'string');
          equal(result.fundingInvoice.amount, '10000000000');
          equal(result.fundingInvoice.currency.blockchainKey, 'eip155:56');
          equal(
            result.fundingInvoice.currency.tokenId,
            'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          );
          equal(result.fundingInvoice.status, 'Pending');
          equal(result.fundingInvoice.createdDate.toISOString(), createDate.toISOString());
          equal(result.fundingInvoice.paidDate, undefined);
        });

        it('should fail when currency does not exist', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Lender User',
            email: 'lender@example.com',
            emailVerified: true,
          });

          const createDate = new Date('2024-01-01T00:00:00Z');
          const expirationDate = new Date('2024-02-01T00:00:00Z');

          await rejects(
            lenderCreatesLoanOfferWithInvoice(repo, {
              lenderUserId: String(lender.id),
              principalBlockchainKey: 'invalid',
              principalTokenId: 'INVALID',
              offeredPrincipalAmount: '10000000000',
              minLoanPrincipalAmount: '1000000000',
              maxLoanPrincipalAmount: '5000000000',
              interestRate: 12.5,
              termInMonthsOptions: [3, 6, 12],
              expirationDate,
              createdDate: createDate,
              fundingWalletDerivationPath: "m/44'/0'/0'/0/2",
              fundingWalletAddress: 'test-funding-wallet-address-2',
            }),
            (error: Error) => error.message.includes('Currency invalid:INVALID does not exist'),
          );
        });

        it('should create multiple loan offers for same lender', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Multiple Offers Lender',
            email: 'multiple-lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Tether USD',
                symbol: 'USDT',
                decimals: 6,
                image: 'usdt.png',
              },
            ],
          });

          const createDate = new Date('2024-01-01T00:00:00Z');

          // Create first offer
          const offer1 = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '5000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '2500000000',
            interestRate: 10.0,
            termInMonthsOptions: [3, 6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: createDate,
            fundingWalletDerivationPath: "m/44'/0'/0'/0/3",
            fundingWalletAddress: 'test-funding-wallet-address-3',
          });

          // Create second offer
          const offer2 = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '15000000000',
            minLoanPrincipalAmount: '2000000000',
            maxLoanPrincipalAmount: '7500000000',
            interestRate: 15.0,
            termInMonthsOptions: [6, 12],
            expirationDate: new Date('2024-03-01T00:00:00Z'),
            createdDate: createDate,
            fundingWalletDerivationPath: "m/44'/0'/0'/0/4",
            fundingWalletAddress: 'test-funding-wallet-address-4',
          });

          notEqual(offer1.id, offer2.id);
          notEqual(offer1.fundingInvoice.id, offer2.fundingInvoice.id);
          equal(offer1.interestRate, 10.0);
          equal(offer2.interestRate, 15.0);
        });
      });

      describe('lenderClosesLoanOffer', function () {
        it('should close published loan offer successfully', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Update Lender',
            email: 'update-lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Tether USD',
                symbol: 'USDT',
                decimals: 6,
                image: 'usdt.png',
              },
            ],
          });

          // Create loan offer
          const offer = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
            fundingWalletDerivationPath: "m/44'/0'/0'/0/5",
            fundingWalletAddress: 'test-funding-wallet-address-5',
          });

          // Simulate offer being published (would happen via invoice payment trigger)
          await repo.sql`
            UPDATE loan_offers 
            SET status = 'Published', published_date = ${new Date('2024-01-01T01:00:00Z').toISOString()}
            WHERE id = ${offer.id}
          `;

          // Test close action
          const closedDate = new Date('2024-01-01T02:00:00Z');
          const result = await repo.lenderClosesLoanOffer({
            loanOfferId: offer.id,
            lenderUserId: String(lender.id),
            closedDate: closedDate,
            closureReason: 'Colse for some reason',
          });

          equal(result.id, offer.id);
          equal(result.status, 'Closed');
          equal(result.closedDate.toISOString(), closedDate.toISOString());
          equal(result.closureReason, 'Colse for some reason');
        });

        it('should close funding loan offer successfully', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Close Lender',
            email: 'close-lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Tether USD',
                symbol: 'USDT',
                decimals: 6,
                image: 'usdt.png',
              },
            ],
          });

          const offer = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
            fundingWalletDerivationPath: "m/44'/0'/0'/0/6",
            fundingWalletAddress: 'test-funding-wallet-address-6',
          });

          const updateDate = new Date('2024-01-01T02:00:00Z');
          const result = await repo.lenderClosesLoanOffer({
            loanOfferId: offer.id,
            lenderUserId: String(lender.id),
            closedDate: updateDate,
            closureReason: 'Changed investment strategy',
          });

          equal(result.id, offer.id);
          equal(result.status, 'Closed');
          equal(result.closedDate.toISOString(), updateDate.toISOString());
          equal(result.closureReason, 'Changed investment strategy');
        });

        it('should fail for invalid status transitions', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Invalid Transition Lender',
            email: 'invalid-lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Tether USD',
                symbol: 'USDT',
                decimals: 6,
                image: 'usdt.png',
              },
            ],
          });

          await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
            fundingWalletDerivationPath: "m/44'/0'/0'/0/7",
            fundingWalletAddress: 'test-funding-wallet-address-7',
          });
        });

        it('should fail for non-existent or unauthorized offer', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Unauthorized Lender',
            email: 'unauthorized-lender@example.com',
            emailVerified: true,
          });

          // Test with non-existent offer ID
          await rejects(
            repo.lenderClosesLoanOffer({
              loanOfferId: '999999',
              lenderUserId: String(lender.id),
              closedDate: new Date('2024-01-01T02:00:00Z'),
            }),
            (error: Error) => error.message.includes('Loan offer not found or access denied'),
          );
        });
      });

      describe('lenderViewsMyLoanOffers', function () {
        it('should return paginated loan offers for lender', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'View Offers Lender',
            email: 'view-lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Tether USD',
                symbol: 'USDT',
                decimals: 6,
                image: 'usdt.png',
              },
            ],
          });

          // Create multiple loan offers
          const baseDate = new Date('2024-01-01T00:00:00Z');
          const offers: Array<LenderCreatesLoanOfferResult> = [];

          for (let i = 0; i < 3; i++) {
            const offerDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
            const offer = await lenderCreatesLoanOfferWithInvoice(repo, {
              lenderUserId: String(lender.id),
              principalBlockchainKey: 'eip155:56',
              principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              offeredPrincipalAmount: `${(i + 1) * 5000}000000`, // 5k, 10k, 15k USDT
              minLoanPrincipalAmount: '1000000000',
              maxLoanPrincipalAmount: `${(i + 1) * 2500}000000`, // 2.5k, 5k, 7.5k USDT
              interestRate: 10 + i * 2.5, // 10%, 12.5%, 15%
              termInMonthsOptions: [3, 6, 12],
              expirationDate: new Date('2024-02-01T00:00:00Z'),
              createdDate: offerDate,
              fundingWalletDerivationPath: `m/44'/0'/0'/0/${8 + i}`,
              fundingWalletAddress: `test-funding-wallet-address-${8 + i}`,
            });
            offers.push(offer);
          }

          // Test getting all offers
          const result = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            page: 1,
            limit: 10,
          });

          equal(result.loanOffers.length, 3);
          equal(result.pagination.total, 3);
          equal(result.pagination.totalPages, 1);
          equal(result.pagination.hasNext, false);
          equal(result.pagination.hasPrev, false);

          // Verify offers are sorted by created_date DESC (newest first)
          equal(result.loanOffers[0].interestRate, 15); // Last created (highest rate)
          equal(result.loanOffers[2].interestRate, 10); // First created (lowest rate)

          // Test pagination
          const page1 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            page: 1,
            limit: 2,
          });

          equal(page1.loanOffers.length, 2);
          equal(page1.pagination.total, 3);
          equal(page1.pagination.totalPages, 2);
          equal(page1.pagination.hasNext, true);
          equal(page1.pagination.hasPrev, false);

          const page2 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            page: 2,
            limit: 2,
          });

          equal(page2.loanOffers.length, 1);
          equal(page2.pagination.total, 3);
          equal(page2.pagination.totalPages, 2);
          equal(page2.pagination.hasNext, false);
          equal(page2.pagination.hasPrev, true);
        });

        it('should filter loan offers by status', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Filter Lender',
            email: 'filter-lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Tether USD',
                symbol: 'USDT',
                decimals: 6,
                image: 'usdt.png',
              },
            ],
          });

          // Create offers with different statuses
          const offer1 = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
            fundingWalletDerivationPath: "m/44'/0'/0'/0/11",
            fundingWalletAddress: 'test-funding-wallet-address-11',
          });

          const offer2 = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '15000000000',
            minLoanPrincipalAmount: '2000000000',
            maxLoanPrincipalAmount: '7500000000',
            interestRate: 15.0,
            termInMonthsOptions: [3, 6],
            expirationDate: new Date('2024-03-01T00:00:00Z'),
            createdDate: new Date('2024-01-02T00:00:00Z'),
            fundingWalletDerivationPath: "m/44'/0'/0'/0/12",
            fundingWalletAddress: 'test-funding-wallet-address-12',
          });

          // Update one offer to Published status
          await repo.sql`
            UPDATE loan_offers 
            SET status = 'Published', published_date = ${new Date().toISOString()}
            WHERE id = ${offer2.id}
          `;

          // Test filtering by Funding status
          const fundingOffers = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            status: 'Funding',
          });

          equal(fundingOffers.loanOffers.length, 1);
          equal(fundingOffers.loanOffers[0].id, offer1.id);
          equal(fundingOffers.loanOffers[0].status, 'Funding');

          // Test filtering by Published status
          const publishedOffers = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            status: 'Published',
          });

          equal(publishedOffers.loanOffers.length, 1);
          equal(publishedOffers.loanOffers[0].id, offer2.id);
          equal(publishedOffers.loanOffers[0].status, 'Published');

          // Test filtering by non-existent status
          const closedOffers = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            status: 'Closed',
          });

          equal(closedOffers.loanOffers.length, 0);
        });

        it('should return empty result for lender with no offers', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Empty Lender',
            email: 'empty-lender@example.com',
            emailVerified: true,
          });

          const result = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
          });

          equal(result.loanOffers.length, 0);
          equal(result.pagination.total, 0);
          equal(result.pagination.totalPages, 0);
          equal(result.pagination.hasNext, false);
          equal(result.pagination.hasPrev, false);
        });

        it('should handle pagination parameters correctly', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Pagination Lender',
            email: 'pagination-lender@example.com',
            emailVerified: true,
          });

          // Test with invalid page (should default to 1)
          const result1 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            page: -1,
            limit: 10,
          });

          equal(result1.pagination.page, 1);

          // Test with invalid limit (should cap at 100)
          const result2 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            page: 1,
            limit: 150,
          });

          equal(result2.pagination.limit, 100);

          // Test with zero limit (should default to 1)
          const result3 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
            page: 1,
            limit: 0,
          });

          equal(result3.pagination.limit, 1);
        });

        it('should include all calculated fields in loan offer results', async function () {
          const lender = await repo.betterAuthCreateUser({
            name: 'Fields Test Lender',
            email: 'fields-lender@example.com',
            emailVerified: true,
          });

          await repo.systemCreatesTestBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.systemCreatesTestCurrencies({
            currencies: [
              {
                blockchainKey: 'eip155:56',
                tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                name: 'Binance-Peg USD Coin',
                symbol: 'USDC',
                decimals: 18,
                image: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
              },
            ],
          });

          const offer = await lenderCreatesLoanOfferWithInvoice(repo, {
            lenderUserId: String(lender.id),
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
            fundingWalletDerivationPath: "m/44'/0'/0'/0/13",
            fundingWalletAddress: 'test-funding-wallet-address-13',
          });

          const result = await repo.lenderViewsMyLoanOffers({
            lenderUserId: String(lender.id),
          });

          equal(result.loanOffers.length, 1);
          const offerResult = result.loanOffers[0];

          // Verify all fields are present and correct
          equal(offerResult.id, offer.id);
          equal(offerResult.principalCurrency.blockchainKey, 'eip155:56');
          equal(
            offerResult.principalCurrency.tokenId,
            'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          );
          equal(offerResult.principalCurrency.symbol, 'USDC');
          equal(offerResult.principalCurrency.decimals, 18);
          equal(offerResult.offeredPrincipalAmount, '10000000000');
          equal(offerResult.availablePrincipalAmount, '10000000000'); // calculated field
          equal(offerResult.disbursedPrincipalAmount, '0'); // calculated field
          equal(offerResult.reservedPrincipalAmount, '0'); // calculated field
          equal(offerResult.minLoanPrincipalAmount, '1000000000');
          equal(offerResult.maxLoanPrincipalAmount, '5000000000');
          equal(offerResult.interestRate, 12.5);
          deepEqual(offerResult.termInMonthsOptions, [3, 6, 12]);
          equal(offerResult.status, 'Funding');
          ok(offerResult.createdDate instanceof Date);
          ok(offerResult.expirationDate instanceof Date);
          equal(offerResult.publishedDate, undefined);
          equal(offerResult.closedDate, undefined);
          equal(offerResult.closureReason, undefined);
        });
      });
    });
  });
}
