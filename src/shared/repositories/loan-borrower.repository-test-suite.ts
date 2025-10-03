import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { assertArrayMapOf, assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { BorrowerCreatesLoanApplicationResult, LenderCreatesLoanOfferResult } from './loan.types';
import { LoanBorrowerRepository } from './loan-borrower.repository';

export async function runLoanBorrowerRepositoryTestSuite(
  createRepo: () => Promise<LoanBorrowerRepository>,
  teardownRepo: (repo: LoanBorrowerRepository) => Promise<void>,
): Promise<void> {
  await suite('LoanBorrowerRepository', function () {
    const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();
    let repo: LoanBorrowerRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('Loan Application Management', function () {
      describe('Data-only Methods', function () {
        it('should get currency pair successfully', async function () {
          // Setup test data
          await repo.testCreatesBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.testCreatesCurrencies({
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

          const result = await repo.borrowerGetsCurrencyPair({
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          });

          equal(result.principalCurrency.symbol, 'USDC');
          equal(result.collateralCurrency.symbol, 'BNB');
          equal(result.principalCurrency.decimals, 18);
          equal(result.collateralCurrency.decimals, 18);
        });

        it('should fail when currency pair does not exist', async function () {
          await rejects(
            async () => {
              await repo.borrowerGetsCurrencyPair({
                collateralBlockchainKey: 'invalid',
                collateralTokenId: 'INVALID',
                principalBlockchainKey: 'eip155:56',
                principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
              });
            },
            { message: /Currency pair .* does not exist/ },
          );
        });
      });

      describe('borrowerCreatesLoanApplication', function () {
        it('should create loan application with calculated values successfully', async function () {
          // Setup test data
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower@example.com',
            emailVerified: true,
          });

          await repo.testCreatesBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.testCreatesCurrencies({
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

          const appliedDate = new Date('2024-01-01T00:00:00Z');
          const expirationDate = new Date('2024-02-01T00:00:00Z');

          // Create exchange rate first
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test',
            bidPrice: 2000,
            askPrice: 2010,
            sourceDate: appliedDate,
          });

          const result = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '5000000000000000000', // 5 USDC in smallest units
            provisionAmount: '150000000000000000', // 3% provision
            maxInterestRate: 15.0,
            minLtvRatio: 0.6,
            maxLtvRatio: 0.75,
            termInMonths: 6,
            liquidationMode: 'Partial',
            collateralDepositAmount: '4166666666666666', // Calculated collateral amount
            collateralDepositExchangeRateId: exchangeRateId,
            appliedDate,
            expirationDate,
            collateralWalletDerivationPath: "m/44'/0'/0'/0/100",
            collateralWalletAddress: 'test-collateral-address-100',
          });

          equal(result.borrowerUserId, String(borrower.id));
          equal(result.principalCurrency.symbol, 'USDC');
          equal(result.collateralCurrency.symbol, 'BNB');
          equal(result.principalAmount, '5000000000000000000');
          equal(result.status, 'PendingCollateral');
          equal(result.liquidationMode, 'Partial');
          ok(result.collateralDepositInvoice.id);
          equal(result.collateralDepositInvoice.currency.symbol, 'BNB');
        });

        it('should fail when currencies do not exist', async function () {
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower@example.com',
            emailVerified: true,
          });

          await rejects(
            async () => {
              await repo.borrowerCreatesLoanApplication({
                borrowerUserId: borrower.id,
                collateralBlockchainKey: 'invalid',
                collateralTokenId: 'INVALID',
                principalBlockchainKey: 'eip155:56',
                principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                principalAmount: '5000000000000000000',
                provisionAmount: '150000000000000000',
                maxInterestRate: 15.0,
                minLtvRatio: 0.6,
                maxLtvRatio: 0.75,
                termInMonths: 6,
                liquidationMode: 'Partial',
                collateralDepositAmount: '4166666666666666',
                collateralDepositExchangeRateId: '1',
                appliedDate: new Date('2024-01-01T00:00:00Z'),
                expirationDate: new Date('2024-02-01T00:00:00Z'),
                collateralWalletDerivationPath: "m/44'/0'/0'/0/100",
                collateralWalletAddress: 'test-collateral-address-100',
              });
            },
            { message: /Currency pair .* does not exist/ },
          );
        });
      });

      describe('borrowerUpdatesLoanApplication', function () {
        it('should cancel loan application successfully', async function () {
          // Setup test data
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower@example.com',
            emailVerified: true,
          });

          await repo.testCreatesBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.testCreatesCurrencies({
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

          // Create exchange rate first
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test',
            bidPrice: 2000,
            askPrice: 2010,
            sourceDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Create loan application first
          const application = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '5000000000000000000',
            provisionAmount: '150000000000000000',
            maxInterestRate: 15.0,
            minLtvRatio: 0.6,
            maxLtvRatio: 0.75,
            termInMonths: 6,
            liquidationMode: 'Partial',
            collateralDepositAmount: '4166666666666666',
            collateralDepositExchangeRateId: exchangeRateId,
            appliedDate: new Date('2024-01-01T00:00:00Z'),
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            collateralWalletDerivationPath: "m/44'/0'/0'/0/101",
            collateralWalletAddress: 'test-collateral-address-101',
          });

          const updateDate = new Date('2024-01-02T00:00:00Z');

          // Cancel the application
          const result = await repo.borrowerUpdatesLoanApplication({
            loanApplicationId: application.id,
            borrowerUserId: borrower.id,
            action: 'cancel',
            updateDate,
            closureReason: 'User cancelled',
          });

          equal(result.id, application.id);
          equal(result.status, 'Cancelled');
          equal(result.closureReason, 'User cancelled');
          deepEqual(result.updatedDate, updateDate);
        });
      });

      describe('borrowerViewsMyLoanApplications', function () {
        it('should return paginated loan applications for borrower', async function () {
          // Setup test data
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower@example.com',
            emailVerified: true,
          });

          await repo.testCreatesBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.testCreatesCurrencies({
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

          // Create exchange rate first
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test',
            bidPrice: 2000,
            askPrice: 2010,
            sourceDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Create multiple loan applications
          const application1 = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '5000000000000000000',
            provisionAmount: '150000000000000000',
            maxInterestRate: 15.0,
            minLtvRatio: 0.6,
            maxLtvRatio: 0.75,
            termInMonths: 6,
            liquidationMode: 'Partial',
            collateralDepositAmount: '4166666666666666',
            collateralDepositExchangeRateId: exchangeRateId,
            appliedDate: new Date('2024-01-01T00:00:00Z'),
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            collateralWalletDerivationPath: "m/44'/0'/0'/0/102",
            collateralWalletAddress: 'test-collateral-address-102',
          });

          const application2 = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '10000000000000000000',
            provisionAmount: '300000000000000000',
            maxInterestRate: 18.0,
            minLtvRatio: 0.6,
            maxLtvRatio: 0.75,
            termInMonths: 12,
            liquidationMode: 'Full',
            collateralDepositAmount: '8333333333333333',
            collateralDepositExchangeRateId: exchangeRateId,
            appliedDate: new Date('2024-01-02T00:00:00Z'),
            expirationDate: new Date('2024-02-02T00:00:00Z'),
            collateralWalletDerivationPath: "m/44'/0'/0'/0/103",
            collateralWalletAddress: 'test-collateral-address-103',
          });

          // Get loan applications
          const result = await repo.borrowerViewsMyLoanApplications({
            borrowerUserId: borrower.id,
            page: 1,
            limit: 10,
          });

          equal(result.loanApplications.length, 2);
          equal(result.pagination.total, 2);
          equal(result.pagination.page, 1);
          equal(result.pagination.limit, 10);

          // Check if applications are sorted by applied date DESC
          equal(result.loanApplications[0].id, application2.id);
          equal(result.loanApplications[1].id, application1.id);
        });

        it('should filter loan applications by status', async function () {
          // Setup test data similar to above but with different statuses
          const borrower = await repo.betterAuthCreateUser({
            name: 'Borrower User',
            email: 'borrower@example.com',
            emailVerified: true,
          });

          await repo.testCreatesBlockchains({
            blockchains: [
              { key: 'ethereum', name: 'Ethereum', shortName: 'ETH', image: 'eth.png' },
            ],
          });

          await repo.testCreatesCurrencies({
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

          // Create exchange rate first
          const { exchangeRateId } = await repo.testSetupPriceFeeds({
            blockchainKey: 'eip155:56',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            source: 'test',
            bidPrice: 2000,
            askPrice: 2010,
            sourceDate: new Date('2024-01-01T00:00:00Z'),
          });

          // Create application
          const application = await repo.borrowerCreatesLoanApplication({
            borrowerUserId: borrower.id,
            collateralBlockchainKey: 'eip155:56',
            collateralTokenId: 'slip44:714',
            principalBlockchainKey: 'eip155:56',
            principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            principalAmount: '5000000000000000000',
            provisionAmount: '150000000000000000',
            maxInterestRate: 15.0,
            minLtvRatio: 0.6,
            maxLtvRatio: 0.75,
            termInMonths: 6,
            liquidationMode: 'Partial',
            collateralDepositAmount: '4166666666666666',
            collateralDepositExchangeRateId: exchangeRateId,
            appliedDate: new Date('2024-01-01T00:00:00Z'),
            expirationDate: new Date('2024-02-01T00:00:00Z'),
            collateralWalletDerivationPath: "m/44'/0'/0'/0/104",
            collateralWalletAddress: 'test-collateral-address-104',
          });

          // Filter by PendingCollateral status
          const result = await repo.borrowerViewsMyLoanApplications({
            borrowerUserId: borrower.id,
            status: 'PendingCollateral',
          });

          equal(result.loanApplications.length, 1);
          equal(result.loanApplications[0].id, application.id);
          equal(result.loanApplications[0].status, 'PendingCollateral');
        });
      });
    });
  });
}
