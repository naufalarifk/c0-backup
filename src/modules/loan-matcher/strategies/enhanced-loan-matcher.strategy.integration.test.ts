import type {
  BorrowerMatchingCriteria,
  LenderMatchingCriteria,
  MatchableLoanApplication,
} from '../../types/loan-matcher.types';

import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { InMemoryCryptogadaiRepository } from '../../../../shared/repositories/in-memory-cryptogadai.repository';
import { EnhancedLoanMatcherStrategy } from './enhanced-loan-matcher.strategy';

/**
 * Integration tests for EnhancedLoanMatcherStrategy with real database
 * Uses InMemoryCryptogadaiRepository (PGlite) for actual database operations
 */
describe('EnhancedLoanMatcherStrategy - Integration Tests', () => {
  let repository: InMemoryCryptogadaiRepository;
  let strategy: EnhancedLoanMatcherStrategy;

  // Test data IDs
  let lenderUserId: string;
  let borrowerUserId: string;
  let institutionUserId: string;

  before(async () => {
    // Initialize real database
    repository = new InMemoryCryptogadaiRepository();
    await repository.connect();
    await repository.migrate();

    // Setup test currencies
    await setupCurrencies(repository);

    // Create test users using betterAuthCreateUser
    const lenderUser = await repository.betterAuthCreateUser({
      name: 'Test Lender',
      email: 'lender@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    lenderUserId = String(lenderUser.id);
    await repository.userDecidesUserType({
      userId: lenderUserId,
      userType: 'Individual',
      decisionDate: new Date(),
    });

    const borrowerUser = await repository.betterAuthCreateUser({
      name: 'Test Borrower',
      email: 'borrower@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    borrowerUserId = String(borrowerUser.id);
    await repository.userDecidesUserType({
      userId: borrowerUserId,
      userType: 'Individual',
      decisionDate: new Date(),
    });

    const institutionUser = await repository.betterAuthCreateUser({
      name: 'Test Institution',
      email: 'institution@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    institutionUserId = String(institutionUser.id);
    await repository.userDecidesUserType({
      userId: institutionUserId,
      userType: 'Institution',
      decisionDate: new Date(),
    });

    // Create test loan offers
    await createTestOffers(repository, lenderUserId, institutionUserId);

    // Initialize strategy with real repository
    strategy = new EnhancedLoanMatcherStrategy(repository);

    console.log('✅ Integration test setup complete');
  });

  after(async () => {
    await repository.close();
  });

  describe('Real Database Operations', () => {
    it('should find compatible offers with lender criteria - duration options', async () => {
      // Arrange
      const application: MatchableLoanApplication = {
        id: 'app-1',
        borrowerUserId,
        principalAmount: '50000',
        maxInterestRate: 10,
        termInMonths: 24,
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'ETH',
        collateralDepositAmount: '100',
        principalBlockchainKey: 'eip155:1',
        principalTokenId: 'USDC',
        status: 'Approved',
        appliedDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      const lenderCriteria: LenderMatchingCriteria = {
        durationOptions: [12, 24], // Only offers with 12 or 24 month options
      };

      // Act
      const compatibleOffers = await strategy.findCompatibleOffers(
        application,
        undefined,
        lenderCriteria,
        undefined,
      );

      // Debug: check what offers exist
      const allOffers = await repository.platformListsAvailableLoanOffers({
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'ETH',
        principalBlockchainKey: 'eip155:1',
        principalTokenId: 'USDC',
        limit: 50,
      });
      console.log(`Found ${allOffers.loanOffers.length} total offers`);
      console.log(`Found ${compatibleOffers.length} compatible offers after filtering`);

      // Assert
      assert.ok(
        compatibleOffers.length > 0,
        `Should find compatible offers. Total offers: ${allOffers.loanOffers.length}`,
      );
      for (const offer of compatibleOffers) {
        const hasMatchingDuration = offer.termInMonthsOptions.some(term =>
          lenderCriteria.durationOptions?.includes(term),
        );
        assert.ok(hasMatchingDuration, 'Offer should have matching duration option');
      }
    });

    it('should find compatible offers with borrower criteria - fixed amount', async () => {
      // Arrange
      const application: MatchableLoanApplication = {
        id: 'app-2',
        borrowerUserId,
        principalAmount: '50000',
        maxInterestRate: 10,
        termInMonths: 24,
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'ETH',
        collateralDepositAmount: '100',
        principalBlockchainKey: 'eip155:1',
        principalTokenId: 'USDC',
        status: 'Approved',
        appliedDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      const borrowerCriteria: BorrowerMatchingCriteria = {
        fixedPrincipalAmount: '50000',
      };

      // Act
      const compatibleOffers = await strategy.findCompatibleOffers(
        application,
        undefined,
        undefined,
        borrowerCriteria,
      );

      // Assert
      assert.ok(compatibleOffers.length > 0, 'Should find compatible offers');
      for (const offer of compatibleOffers) {
        const minAmount = parseFloat(offer.minLoanPrincipalAmount);
        const maxAmount = parseFloat(offer.maxLoanPrincipalAmount);
        const fixedAmount = parseFloat(borrowerCriteria.fixedPrincipalAmount!);

        assert.ok(
          fixedAmount >= minAmount && fixedAmount <= maxAmount,
          'Fixed amount should be within offer range',
        );
      }
    });

    it('should filter by borrower max interest rate', async () => {
      // Arrange
      const application: MatchableLoanApplication = {
        id: 'app-3',
        borrowerUserId,
        principalAmount: '50000',
        maxInterestRate: 8,
        termInMonths: 24,
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'ETH',
        collateralDepositAmount: '100',
        principalBlockchainKey: 'eip155:1',
        principalTokenId: 'USDC',
        status: 'Approved',
        appliedDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      const borrowerCriteria: BorrowerMatchingCriteria = {
        maxInterestRate: 8,
      };

      // Act
      const compatibleOffers = await strategy.findCompatibleOffers(
        application,
        undefined,
        undefined,
        borrowerCriteria,
      );

      // Assert
      assert.ok(compatibleOffers.length > 0, 'Should find compatible offers');
      for (const offer of compatibleOffers) {
        assert.ok(
          offer.interestRate <= borrowerCriteria.maxInterestRate!,
          `Offer rate ${offer.interestRate}% should be <= ${borrowerCriteria.maxInterestRate}%`,
        );
      }
    });

    it('should apply combined lender and borrower criteria', async () => {
      // Arrange
      const application: MatchableLoanApplication = {
        id: 'app-4',
        borrowerUserId,
        principalAmount: '50000',
        maxInterestRate: 8,
        termInMonths: 24,
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'ETH',
        collateralDepositAmount: '100',
        principalBlockchainKey: 'eip155:1',
        principalTokenId: 'USDC',
        status: 'Approved',
        appliedDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      const lenderCriteria: LenderMatchingCriteria = {
        durationOptions: [24],
        fixedInterestRate: 7.5,
      };

      const borrowerCriteria: BorrowerMatchingCriteria = {
        maxInterestRate: 8,
        fixedDuration: 24,
      };

      // Act
      const compatibleOffers = await strategy.findCompatibleOffers(
        application,
        undefined,
        lenderCriteria,
        borrowerCriteria,
      );

      // Assert
      for (const offer of compatibleOffers) {
        // Check lender criteria
        assert.ok(offer.termInMonthsOptions.includes(24), 'Should have 24-month term option');
        assert.strictEqual(offer.interestRate, 7.5, 'Should match fixed interest rate');

        // Check borrower criteria
        assert.ok(offer.interestRate <= 8, 'Should be within borrower max rate');
      }
    });

    it('should return empty array when no offers match criteria', async () => {
      // Arrange
      const application: MatchableLoanApplication = {
        id: 'app-5',
        borrowerUserId,
        principalAmount: '50000',
        maxInterestRate: 10,
        termInMonths: 60, // No offers have 60 month option
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'ETH',
        collateralDepositAmount: '100',
        principalBlockchainKey: 'eip155:1',
        principalTokenId: 'USDC',
        status: 'Approved',
        appliedDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act
      const compatibleOffers = await strategy.findCompatibleOffers(
        application,
        undefined,
        undefined,
        undefined,
      );

      // Assert
      assert.strictEqual(
        compatibleOffers.length,
        0,
        'Should return no offers for unmatchable term',
      );
    });

    it('should handle amount outside offer ranges', async () => {
      // Arrange
      const application: MatchableLoanApplication = {
        id: 'app-6',
        borrowerUserId,
        principalAmount: '500', // Too small for any offer
        maxInterestRate: 10,
        termInMonths: 24,
        collateralBlockchainKey: 'eip155:1',
        collateralTokenId: 'ETH',
        collateralDepositAmount: '100',
        principalBlockchainKey: 'eip155:1',
        principalTokenId: 'USDC',
        status: 'Approved',
        appliedDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      // Act
      const compatibleOffers = await strategy.findCompatibleOffers(
        application,
        undefined,
        undefined,
        undefined,
      );

      // Assert
      assert.strictEqual(
        compatibleOffers.length,
        0,
        'Should return no offers for amount too small',
      );
    });
  });

  describe('Strategy Behavior', () => {
    it('should correctly identify when it can handle criteria', () => {
      // With lender criteria
      assert.strictEqual(
        strategy.canHandle({ durationOptions: [24] }, undefined),
        true,
        'Should handle lender criteria',
      );

      // With borrower criteria
      assert.strictEqual(
        strategy.canHandle(undefined, { maxInterestRate: 8 }),
        true,
        'Should handle borrower criteria',
      );

      // With both
      assert.strictEqual(
        strategy.canHandle({ durationOptions: [24] }, { maxInterestRate: 8 }),
        true,
        'Should handle both criteria',
      );

      // With neither
      assert.strictEqual(
        strategy.canHandle(undefined, undefined),
        false,
        'Should not handle without criteria',
      );
    });

    it('should generate meaningful descriptions', () => {
      const lenderCriteria: LenderMatchingCriteria = {
        durationOptions: [12, 24, 36],
        fixedInterestRate: 7.5,
      };

      const borrowerCriteria: BorrowerMatchingCriteria = {
        fixedDuration: 24,
        maxInterestRate: 8,
      };

      const description = strategy.getDescription(lenderCriteria, borrowerCriteria);

      assert.ok(description.includes('24'), 'Should include borrower duration');
      assert.ok(description.includes('8'), 'Should include borrower max rate');
      assert.ok(description.includes('12, 24, 36'), 'Should include lender duration options');
      assert.ok(description.includes('7.5'), 'Should include lender fixed rate');
    });
  });
});

/**
 * Setup test currencies in database
 */
async function setupCurrencies(repository: InMemoryCryptogadaiRepository) {
  // Create ETH currency (collateral)
  await repository.sql`
		INSERT INTO currencies (blockchain_key, token_id, name, symbol, decimals, image, max_ltv, ltv_warning_threshold, ltv_critical_threshold, ltv_liquidation_threshold)
		VALUES ('eip155:1', 'ETH', 'Ethereum', 'ETH', 18, 'https://cryptologos.cc/logos/ethereum-eth-logo.png', 0.8, 0.75, 0.85, 0.9)
		ON CONFLICT (blockchain_key, token_id) DO NOTHING
	`;

  // Create USDC currency (principal)
  await repository.sql`
		INSERT INTO currencies (blockchain_key, token_id, name, symbol, decimals, image, min_loan_principal_amount, max_loan_principal_amount)
		VALUES ('eip155:1', 'USDC', 'USD Coin', 'USDC', 6, 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png', 1000, 1000000)
		ON CONFLICT (blockchain_key, token_id) DO NOTHING
	`;

  // Create price feed for ETH/USDC
  const priceFeedResult = await repository.sql`
		INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
		VALUES ('eip155:1', 'ETH', 'USDC', 'TestSource')
		ON CONFLICT DO NOTHING
		RETURNING id
	`;

  let priceFeedId = 1;
  if (priceFeedResult.length > 0) {
    priceFeedId = (priceFeedResult[0] as { id: number }).id;
  }

  // Add exchange rate
  await repository.sql`
		INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
		VALUES (${priceFeedId}, 2500.0, 2500.0, NOW(), NOW())
	`;
}

/**
 * Create test loan offers with various configurations
 */
async function createTestOffers(
  repository: InMemoryCryptogadaiRepository,
  lenderUserId: string,
  institutionUserId: string,
) {
  const now = new Date();
  const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const invoiceDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invoiceExpiredDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Use unique invoice IDs to avoid conflicts with other tests
  const baseInvoiceId = 9000 + (Date.now() % 1000);

  // Offer 1: Individual lender, flexible terms (12, 24, 36), 7.5% rate
  const offer1 = await repository.lenderCreatesLoanOffer({
    lenderUserId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '100000',
    minLoanPrincipalAmount: '10000',
    maxLoanPrincipalAmount: '80000',
    interestRate: 7.5,
    termInMonthsOptions: [12, 24, 36],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/0",
    fundingWalletAddress: '0x' + Date.now().toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });

  // Publish offer 1
  await repository.testPublishesLoanOffer({
    loanOfferId: offer1.id,
    publishedDate: now,
  });

  // Pay the funding invoice to make offer available
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: offer1.id,
    paymentDate: now,
  });

  // Offer 2: Individual lender, only 24 months, 8.0% rate
  const offer2 = await repository.lenderCreatesLoanOffer({
    lenderUserId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '50000',
    minLoanPrincipalAmount: '20000',
    maxLoanPrincipalAmount: '50000',
    interestRate: 8.0,
    termInMonthsOptions: [24],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/1",
    fundingWalletAddress: '0x' + (Date.now() + 1).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 1,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });

  // Publish offer 2
  await repository.testPublishesLoanOffer({
    loanOfferId: offer2.id,
    publishedDate: now,
  });

  // Pay the funding invoice to make offer available
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: offer2.id,
    paymentDate: now,
  });

  // Offer 3: Institution lender, flexible terms, lower rate (6.5%)
  const offer3 = await repository.lenderCreatesLoanOffer({
    lenderUserId: institutionUserId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '200000',
    minLoanPrincipalAmount: '30000',
    maxLoanPrincipalAmount: '100000',
    interestRate: 6.5,
    termInMonthsOptions: [12, 24, 36],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/2",
    fundingWalletAddress: '0x' + (Date.now() + 2).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 2,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });

  // Publish offer 3
  await repository.testPublishesLoanOffer({
    loanOfferId: offer3.id,
    publishedDate: now,
  });

  // Pay the funding invoice to make offer available
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: offer3.id,
    paymentDate: now,
  });
}
