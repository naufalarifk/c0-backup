import { deepEqual, equal, notEqual, ok, rejects } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { assertArrayOf, assertDefined, assertPropStringOrNumber } from '../utils';
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
            collateralWalletDerivationPath: "m/44'/0'/0'/0/12345",
            collateralWalletAddress: 'collateral_test_address_12345',
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
              collateralWalletDerivationPath: "m/44'/0'/0'/0/99999",
              collateralWalletAddress: 'invalid_test_address_99999',
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
            collateralWalletDerivationPath: "m/44'/0'/0'/0/33333",
            collateralWalletAddress: 'update_test_address_33333',
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
              collateralWalletDerivationPath: `m/44'/0'/0'/0/${44444 + i}`,
              collateralWalletAddress: `view_test_address_${44444 + i}`,
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
            collateralWalletDerivationPath: "m/44'/0'/0'/0/55555",
            collateralWalletAddress: 'filter_test_address1_55555',
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
            collateralWalletDerivationPath: "m/44'/0'/0'/0/66666",
            collateralWalletAddress: 'filter_test_address2_66666',
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
