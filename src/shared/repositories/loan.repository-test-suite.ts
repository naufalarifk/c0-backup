import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { assertArrayOf, assertDefined, assertPropStringOrNumber } from '../utils';
import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { LoanRepository } from './loan.repository';
import { BorrowerCreatesLoanApplicationResult, LenderCreatesLoanOfferResult } from './loan.types';

export async function runLoanRepositoryTestSuite(
  createRepo: () => Promise<LoanRepository>,
  teardownRepo: (repo: LoanRepository) => Promise<void>,
): Promise<void> {
  await suite('LoanRepository', function () {
    const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();
    let repo: LoanRepository;

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

          const result = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000', // 10 USDC (18 decimals)
            minLoanPrincipalAmount: '1000000000', // 1 USDC
            maxLoanPrincipalAmount: '5000000000', // 5 USDC
            interestRate: 12.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate,
            createdDate: createDate,
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
            repo.lenderCreatesLoanOffer({
              lenderUserId: lender.id,
              principalBlockchainKey: 'invalid',
              principalTokenId: 'INVALID',
              offeredPrincipalAmount: '10000000000',
              minLoanPrincipalAmount: '1000000000',
              maxLoanPrincipalAmount: '5000000000',
              interestRate: 12.5,
              termInMonthsOptions: [3, 6, 12],
              expirationDate,
              createdDate: createDate,
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
          const offer1 = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '5000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '2500000000',
            interestRate: 10.0,
            termInMonthsOptions: [3, 6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: createDate,
          });

          // Create second offer
          const offer2 = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '15000000000',
            minLoanPrincipalAmount: '2000000000',
            maxLoanPrincipalAmount: '7500000000',
            interestRate: 15.0,
            termInMonthsOptions: [6, 12],
            expirationDate: new Date('2024-03-01T00:00:00Z'),
            createdDate: createDate,
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
          const offer = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
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
            lenderUserId: lender.id,
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

          const offer = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
          });

          const updateDate = new Date('2024-01-01T02:00:00Z');
          const result = await repo.lenderClosesLoanOffer({
            loanOfferId: offer.id,
            lenderUserId: lender.id,
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

          await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
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
              lenderUserId: lender.id,
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
            const offer = await repo.lenderCreatesLoanOffer({
              lenderUserId: lender.id,
              principalBlockchainKey: 'eip155:56',
              principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              offeredPrincipalAmount: `${(i + 1) * 5000}000000`, // 5k, 10k, 15k USDT
              minLoanPrincipalAmount: '1000000000',
              maxLoanPrincipalAmount: `${(i + 1) * 2500}000000`, // 2.5k, 5k, 7.5k USDT
              interestRate: 10 + i * 2.5, // 10%, 12.5%, 15%
              termInMonthsOptions: [3, 6, 12],
              expirationDate: new Date('2024-02-01T00:00:00Z'),
              createdDate: offerDate,
            });
            offers.push(offer);
          }

          // Test getting all offers
          const result = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
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
            lenderUserId: lender.id,
            page: 1,
            limit: 2,
          });

          equal(page1.loanOffers.length, 2);
          equal(page1.pagination.total, 3);
          equal(page1.pagination.totalPages, 2);
          equal(page1.pagination.hasNext, true);
          equal(page1.pagination.hasPrev, false);

          const page2 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
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
          const offer1 = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.0,
            termInMonthsOptions: [6],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
          });

          const offer2 = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '15000000000',
            minLoanPrincipalAmount: '2000000000',
            maxLoanPrincipalAmount: '7500000000',
            interestRate: 15.0,
            termInMonthsOptions: [3, 6],
            expirationDate: new Date('2024-03-01T00:00:00Z'),
            createdDate: new Date('2024-01-02T00:00:00Z'),
          });

          // Update one offer to Published status
          await repo.sql`
            UPDATE loan_offers 
            SET status = 'Published', published_date = ${new Date().toISOString()}
            WHERE id = ${offer2.id}
          `;

          // Test filtering by Funding status
          const fundingOffers = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
            status: 'Funding',
          });

          equal(fundingOffers.loanOffers.length, 1);
          equal(fundingOffers.loanOffers[0].id, offer1.id);
          equal(fundingOffers.loanOffers[0].status, 'Funding');

          // Test filtering by Published status
          const publishedOffers = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
            status: 'Published',
          });

          equal(publishedOffers.loanOffers.length, 1);
          equal(publishedOffers.loanOffers[0].id, offer2.id);
          equal(publishedOffers.loanOffers[0].status, 'Published');

          // Test filtering by non-existent status
          const closedOffers = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
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
            lenderUserId: lender.id,
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
            lenderUserId: lender.id,
            page: -1,
            limit: 10,
          });

          equal(result1.pagination.page, 1);

          // Test with invalid limit (should cap at 100)
          const result2 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
            page: 1,
            limit: 150,
          });

          equal(result2.pagination.limit, 100);

          // Test with zero limit (should default to 1)
          const result3 = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
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

          const offer = await repo.lenderCreatesLoanOffer({
            lenderUserId: lender.id,
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            offeredPrincipalAmount: '10000000000',
            minLoanPrincipalAmount: '1000000000',
            maxLoanPrincipalAmount: '5000000000',
            interestRate: 12.5,
            termInMonthsOptions: [3, 6, 12],
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            createdDate: new Date('2024-01-01T00:00:00Z'),
          });

          const result = await repo.lenderViewsMyLoanOffers({
            lenderUserId: lender.id,
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

    describe('Loan Application Management', function () {
      describe('borrowerCalculatesLoanRequirements', function () {
        it('should calculate loan requirements successfully', async function () {
          // Setup test data
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
              {
                blockchainKey: 'eip155:56',
                tokenId: 'slip44:714',
                name: 'Binance Coin',
                symbol: 'BNB',
                decimals: 18,
                image: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
              },
            ],
          });

          // Setup price feed and exchange rate
          const calculationDate = new Date('2024-01-01T00:00:00Z');

          await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'TestSource',
            bidPrice: 2000.0,
            askPrice: 2001.0,
            sourceDate: calculationDate,
          });

          // Setup platform config
          await repo.testSetupPlatformConfig({
            effectiveDate: new Date('2023-12-01T00:00:00Z'),
            adminUserId: 1,
            loanProvisionRate: 3.0,
            loanIndividualRedeliveryFeeRate: 10.0,
            loanInstitutionRedeliveryFeeRate: 2.5,
            loanMinLtvRatio: 60.0,
            loanMaxLtvRatio: 75.0,
            loanRepaymentDurationInDays: 3,
          });

          const result = await repo.borrowerCalculatesLoanRequirements({
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '10000000000', // 10 USDC (18 decimals)
            termInMonths: 6,
            calculationDate,
          });

          equal(result.success, true);
          equal(result.data.principalAmount, '10000000000');
          equal(result.data.principalCurrency.symbol, 'USDC');
          equal(result.data.collateralCurrency.symbol, 'BNB');
          equal(result.data.minLtvRatio, 60.0);
          equal(result.data.maxLtvRatio, 75.0);
          equal(result.data.provisionRate, 3.0);
          equal(result.data.termInMonths, 6);
          ok(Number(result.data.requiredCollateralAmount) > 0);
          ok(Number(result.data.provisionAmount) > 0);
        });

        it('should fail when currency pair does not exist', async function () {
          const calculationDate = new Date('2024-01-01T00:00:00Z');

          const result = await repo.borrowerCalculatesLoanRequirements({
            collateralBlockchainKey: 'invalid',
            collateralTokenId: 'INVALID',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '10000000000',
            termInMonths: 6,
            calculationDate,
          });

          equal(result.success, false);
        });
      });

      describe('borrowerCreatesLoanApplication', function () {
        it('should create loan application successfully', async function () {
          // Setup test data
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
              {
                blockchainKey: 'eip155:56',
                tokenId: 'slip44:714',
                name: 'Binance Coin',
                symbol: 'BNB',
                decimals: 18,
                image: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
              },
            ],
          });

          // Setup price feed and exchange rate
          await repo.sql`
            INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
            VALUES ('eip155:56', 'slip44:714', 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'TestSource')
          `;

          const priceFeedRows = await repo.sql`
            SELECT id FROM price_feeds WHERE blockchain_key = 'eip155:56'
            AND base_currency_token_id = 'slip44:714' AND quote_currency_token_id = 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
          `;
          assertArrayOf(priceFeedRows, function (row) {
            assertDefined(row);
            assertPropStringOrNumber(row, 'id');
            return row;
          });
          const priceFeedId = priceFeedRows[0].id;

          const appliedDate = new Date('2024-01-01T00:00:00Z');
          const expirationDate = new Date('2024-02-01T00:00:00Z');

          await repo.sql`
            INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
            VALUES (${priceFeedId}, 2000.0, 2001.0, ${appliedDate.toISOString()}, ${appliedDate.toISOString()})
          `;

          // Setup platform config
          await repo.sql`
            INSERT INTO platform_configs (
              effective_date, admin_user_id, loan_provision_rate,
              loan_individual_redelivery_fee_rate, loan_institution_redelivery_fee_rate,
              loan_min_ltv_ratio, loan_max_ltv_ratio, loan_repayment_duration_in_days
            ) VALUES (
              '2023-12-01T00:00:00Z', 1, 3.0, 10.0, 2.5, 60.0, 75.0, 3
            )
          `;

          const result = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '5000000000', // 5 USDC (18 decimals)
            maxInterestRate: 15.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate,
            expirationDate,
          });

          // Verify loan application details
          equal(typeof result.id, 'string');
          equal(result.borrowerUserId, String(borrower.id));
          equal(result.principalCurrency.symbol, 'USDC');
          equal(result.collateralCurrency.symbol, 'BNB');
          equal(result.principalAmount, '5000000000');
          equal(result.maxInterestRate, 15.0);
          equal(result.termInMonths, 6);
          equal(result.liquidationMode, 'Partial');
          equal(result.status, 'PendingCollateral');
          equal(result.appliedDate.toISOString(), appliedDate.toISOString());
          equal(result.expirationDate.toISOString(), expirationDate.toISOString());

          // Verify collateral deposit invoice
          equal(typeof result.collateralDepositInvoice.id, 'string');
          ok(Number(result.collateralDepositInvoice.amount) > 0);
          equal(result.collateralDepositInvoice.status, 'Pending');
          equal(result.collateralDepositInvoice.currency.symbol, 'BNB');
        });

        it('should fail when currencies do not exist', async function () {
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower2@example.com',
            emailVerified: true,
          });

          const appliedDate = new Date('2024-01-01T00:00:00Z');
          const expirationDate = new Date('2024-02-01T00:00:00Z');

          await rejects(
            repo.borrowerCreatesLoanApplication({
              borrowerUserId: borrower.id,
              collateralBlockchainKey: 'invalid',
              collateralTokenId: 'INVALID',
              principalBlockchainKey: 'eip155:56',
              principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              principalAmount: '5000000000',
              maxInterestRate: 15.0,
              termInMonths: 6,
              liquidationMode: 'Partial',
              appliedDate,
              expirationDate,
            }),
            (error: Error) => error.message.includes('Currency pair'),
          );
        });
      });

      describe('borrowerUpdatesLoanApplication', function () {
        it('should cancel loan application successfully', async function () {
          // Setup test data and create loan application
          const borrower = await repo.betterAuthCreateUser({
            name: 'Update Borrower',
            email: 'update-borrower@example.com',
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
              {
                blockchainKey: 'eip155:56',
                tokenId: 'slip44:714',
                name: 'Binance Coin',
                symbol: 'BNB',
                decimals: 18,
                image: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
              },
            ],
          });

          // Setup exchange rate and platform config
          await repo.sql`
            INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
            VALUES ('eip155:56', 'slip44:714', 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'TestSource')
          `;

          const priceFeedRows = await repo.sql`
            SELECT id FROM price_feeds WHERE blockchain_key = 'eip155:56'
          `;
          assertArrayOf(priceFeedRows, function (row) {
            assertDefined(row);
            assertPropStringOrNumber(row, 'id');
            return row;
          });
          const priceFeedId = priceFeedRows[0].id;

          const appliedDate = new Date('2024-01-01T00:00:00Z');
          await repo.sql`
            INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
            VALUES (${priceFeedId}, 2000.0, 2001.0, ${appliedDate.toISOString()}, ${appliedDate.toISOString()})
          `;

          await repo.sql`
            INSERT INTO platform_configs (
              effective_date, admin_user_id, loan_provision_rate,
              loan_individual_redelivery_fee_rate, loan_institution_redelivery_fee_rate,
              loan_min_ltv_ratio, loan_max_ltv_ratio, loan_repayment_duration_in_days
            ) VALUES (
              '2023-12-01T00:00:00Z', 1, 3.0, 10.0, 2.5, 60.0, 75.0, 3
            )
          `;

          // Create loan application
          const application = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '5000000000',
            maxInterestRate: 15.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate,
            expirationDate: new Date('2024-02-01T00:00:00Z'),
          });

          // Cancel the application
          const updateDate = new Date('2024-01-01T02:00:00Z');
          const result = await repo.borrowerUpdatesLoanApplication({
            loanApplicationId: application.id,
            borrowerUserId: borrower.id,
            action: 'cancel',
            updateDate,
            closureReason: 'Changed mind',
          });

          equal(result.id, application.id);
          equal(result.status, 'Closed');
          equal(result.updatedDate.toISOString(), updateDate.toISOString());
          equal(result.closureReason, 'Changed mind');
        });
      });

      describe('borrowerViewsMyLoanApplications', function () {
        it('should return paginated loan applications for borrower', async function () {
          const borrower = await repo.betterAuthCreateUser({
            name: 'View Applications Borrower',
            email: 'view-applications@example.com',
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
              {
                blockchainKey: 'eip155:56',
                tokenId: 'slip44:714',
                name: 'Binance Coin',
                symbol: 'BNB',
                decimals: 18,
                image: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
              },
            ],
          });

          // Setup exchange rate and platform config
          const appliedDate = new Date('2024-01-01T00:00:00Z');

          await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'TestSource',
            bidPrice: 2000.0,
            askPrice: 2001.0,
            sourceDate: appliedDate,
          });

          await repo.testSetupPlatformConfig({
            effectiveDate: new Date('2023-12-01T00:00:00Z'),
            adminUserId: 1,
            loanProvisionRate: 3.0,
            loanIndividualRedeliveryFeeRate: 10.0,
            loanInstitutionRedeliveryFeeRate: 2.5,
            loanMinLtvRatio: 60.0,
            loanMaxLtvRatio: 75.0,
            loanRepaymentDurationInDays: 3,
          });

          // Create multiple loan applications
          const applications: Array<BorrowerCreatesLoanApplicationResult> = [];
          for (let i = 0; i < 3; i++) {
            const applicationDate = new Date(appliedDate.getTime() + i * 24 * 60 * 60 * 1000);
            const application = await repo.borrowerCreatesLoanApplication({
              borrowerUserId: borrower.id,
              collateralBlockchainKey: 'eip155:56',
              collateralTokenId: 'slip44:714',
              principalBlockchainKey: 'eip155:56',
              principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              principalAmount: `${(i + 1) * 2000}000000`, // 0.002, 0.004, 0.006 USDC (18 decimals)
              maxInterestRate: 10 + i * 2.5, // 10%, 12.5%, 15%
              termInMonths: 6,
              liquidationMode: 'Partial',
              appliedDate: applicationDate,
              expirationDate: new Date('2024-02-01T00:00:00Z'),
            });
            applications.push(application);
          }

          // Test getting all applications
          const result = await repo.borrowerViewsMyLoanApplications({
            borrowerUserId: borrower.id,
            page: 1,
            limit: 10,
          });

          equal(result.loanApplications.length, 3);
          equal(result.pagination.total, 3);
          equal(result.pagination.totalPages, 1);
          equal(result.pagination.hasNext, false);
          equal(result.pagination.hasPrev, false);

          // Verify applications are sorted by applied_date DESC (newest first)
          equal(result.loanApplications[0].maxInterestRate, 15); // Last created (highest rate)
          equal(result.loanApplications[2].maxInterestRate, 10); // First created (lowest rate)
        });

        it('should filter loan applications by status', async function () {
          const borrower = await repo.betterAuthCreateUser({
            name: 'Filter Applications Borrower',
            email: 'filter-applications@example.com',
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
              {
                blockchainKey: 'eip155:56',
                tokenId: 'slip44:714',
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
                image: 'eth.png',
              },
            ],
          });

          // Setup exchange rate and platform config
          const appliedDate = new Date('2024-01-01T00:00:00Z');

          await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'TestSource',
            bidPrice: 2000.0,
            askPrice: 2001.0,
            sourceDate: appliedDate,
          });

          await repo.testSetupPlatformConfig({
            effectiveDate: new Date('2023-12-01T00:00:00Z'),
            adminUserId: 1,
            loanProvisionRate: 3.0,
            loanIndividualRedeliveryFeeRate: 10.0,
            loanInstitutionRedeliveryFeeRate: 2.5,
            loanMinLtvRatio: 60.0,
            loanMaxLtvRatio: 75.0,
            loanRepaymentDurationInDays: 3,
          });

          // Create applications with different statuses
          const application1 = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '5000000000',
            maxInterestRate: 12.0,
            termInMonths: 6,
            liquidationMode: 'Partial',
            appliedDate,
            expirationDate: new Date('2024-02-01T00:00:00Z'),
          });

          const application2 = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '7500000000',
            maxInterestRate: 15.0,
            termInMonths: 3,
            liquidationMode: 'Partial',
            appliedDate: new Date('2024-01-02T00:00:00Z'),
            expirationDate: new Date('2024-02-01T00:00:00Z'),
          });

          // Cancel one application
          await repo.borrowerUpdatesLoanApplication({
            loanApplicationId: application2.id,
            borrowerUserId: borrower.id,
            action: 'cancel',
            updateDate: new Date('2024-01-02T02:00:00Z'),
            closureReason: 'Test closure',
          });

          // Test filtering by PendingCollateral status
          const pendingApplications = await repo.borrowerViewsMyLoanApplications({
            borrowerUserId: borrower.id,
            status: 'PendingCollateral',
          });

          equal(pendingApplications.loanApplications.length, 1);
          equal(pendingApplications.loanApplications[0].id, application1.id);
          equal(pendingApplications.loanApplications[0].status, 'PendingCollateral');

          // Test filtering by Closed status
          const closedApplications = await repo.borrowerViewsMyLoanApplications({
            borrowerUserId: borrower.id,
            status: 'Closed',
          });

          equal(closedApplications.loanApplications.length, 1);
          equal(closedApplications.loanApplications[0].id, application2.id);
          equal(closedApplications.loanApplications[0].status, 'Closed');
        });
      });
    });
  });
}
