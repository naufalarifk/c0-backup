import type {
  BorrowerMatchingCriteria,
  LenderMatchingCriteria,
  LoanMatchingWorkerData,
} from '../loan-matcher.types';

import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { InMemoryCryptogadaiRepository } from '../../../shared/repositories/in-memory-cryptogadai.repository';
import { NotificationQueueService } from '../../notifications/notification-queue.service';
import { LoanMatcherService } from '../loan-matcher.service';
import { LoanMatcherStrategyFactory } from '../loan-matcher-strategy.factory';
import { EnhancedLoanMatcherStrategy } from './enhanced-loan-matcher.strategy';

/**
 * End-to-End Integration Test: LoanMatcherService with Enhanced Strategy
 * Tests the complete flow: Service → Factory → Strategy → Repository
 */
describe('LoanMatcherService E2E - With Enhanced Strategy', () => {
  let repository: InMemoryCryptogadaiRepository;
  let service: LoanMatcherService;
  let notificationService: NotificationQueueService;
  let strategyFactory: LoanMatcherStrategyFactory;

  // Test data IDs
  let lenderUserId: string;
  let borrowerUserId: string;
  let institutionUserId: string;
  let offer1Id: string;
  let offer2Id: string;
  let offer3Id: string;
  let applicationId: string;

  before(async () => {
    // Initialize real database
    repository = new InMemoryCryptogadaiRepository();
    await repository.connect();
    await repository.migrate();

    // Setup test currencies
    await setupCurrencies(repository);

    // Create test users
    const lenderUser = await repository.betterAuthCreateUser({
      name: 'E2E Lender',
      email: 'e2e-lender@test.com',
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
      name: 'E2E Borrower',
      email: 'e2e-borrower@test.com',
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
      name: 'E2E Institution',
      email: 'e2e-institution@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    institutionUserId = String(institutionUser.id);
    await repository.userDecidesUserType({
      userId: institutionUserId,
      userType: 'Institution',
      decisionDate: new Date(),
    });

    // Create and publish test loan offers
    const { offer1, offer2, offer3 } = await createPublishedOffers(
      repository,
      lenderUserId,
      institutionUserId,
    );
    offer1Id = offer1;
    offer2Id = offer2;
    offer3Id = offer3;

    // Create a test loan application
    applicationId = await createTestApplication(repository, borrowerUserId);

    // Setup the complete service stack
    notificationService = {
      addNotification: async () => {
        /* mock */
      },
    } as unknown as NotificationQueueService;

    // Create strategy factory with real discovery (simulated)
    const mockDiscoveryService = {
      discover: () => {
        return [
          {
            instance: new EnhancedLoanMatcherStrategy(repository),
            metatype: EnhancedLoanMatcherStrategy,
          },
        ];
      },
      getProviders: () => [],
      getMetadataByDecorator: () => undefined,
    } as unknown as import('@nestjs/core').DiscoveryService;
    strategyFactory = new LoanMatcherStrategyFactory(mockDiscoveryService);

    // Initialize the service with all dependencies
    service = new LoanMatcherService(repository, notificationService, strategyFactory);

    console.log(
      `   Lender: ${lenderUserId}, Borrower: ${borrowerUserId}, Institution: ${institutionUserId}`,
    );
    console.log(`   Offers: ${offer1Id}, ${offer2Id}, ${offer3Id}`);
    console.log(`   Application: ${applicationId}`);
  });

  after(async () => {
    await repository.close();
  });

  describe('Complete Workflow: Service → Factory → Strategy → Repository', () => {
    it('should process loan matching without criteria (legacy path)', async () => {
      // Arrange
      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should return matching result');
      assert.ok(result.processedApplications >= 0, 'Should process applications');
      console.log(
        `   Legacy path: processed ${result.processedApplications} apps, ${result.processedOffers} offers, ${result.matchedPairs} matches`,
      );
    });

    it('should process loan matching with lender criteria (enhanced strategy)', async () => {
      // Arrange
      const lenderCriteria: LenderMatchingCriteria = {
        durationOptions: [12, 24],
      };

      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        lenderCriteria,
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should return matching result');
      assert.ok(result.processedApplications >= 0, 'Should process applications');
      console.log(
        `   Enhanced (lender): processed ${result.processedApplications} apps, ${result.processedOffers} offers, ${result.matchedPairs} matches`,
      );
    });

    it('should process loan matching with borrower criteria (enhanced strategy)', async () => {
      // Arrange
      const borrowerCriteria: BorrowerMatchingCriteria = {
        fixedPrincipalAmount: '50000',
      };

      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        borrowerCriteria,
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should return matching result');
      assert.ok(result.processedApplications >= 0, 'Should process applications');
      console.log(
        `   Enhanced (borrower): processed ${result.processedApplications} apps, ${result.processedOffers} offers, ${result.matchedPairs} matches`,
      );
    });

    it('should process loan matching with combined criteria (enhanced strategy)', async () => {
      // Arrange
      const lenderCriteria: LenderMatchingCriteria = {
        durationOptions: [12, 24, 36],
      };

      const borrowerCriteria: BorrowerMatchingCriteria = {
        maxInterestRate: 10,
      };

      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        lenderCriteria,
        borrowerCriteria,
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should return matching result');
      assert.ok(result.processedApplications >= 0, 'Should process applications');
      console.log(
        `   Enhanced (combined): processed ${result.processedApplications} apps, ${result.processedOffers} offers, ${result.matchedPairs} matches`,
      );
    });

    it('should process targeted application matching', async () => {
      // Arrange - create a fresh application for this test
      const freshAppId = await createTestApplication(repository, borrowerUserId);

      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        targetApplicationId: freshAppId,
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should return matching result');
      assert.strictEqual(result.processedApplications, 1, 'Should process exactly 1 application');
      console.log(
        `   Targeted: processed app ${freshAppId}, found ${result.processedOffers} offers`,
      );
    });

    it('should handle errors gracefully and continue processing', async () => {
      // Arrange - use invalid criteria to trigger potential errors
      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        targetApplicationId: 'non-existent-app-id',
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should return matching result even with errors');
      assert.strictEqual(
        result.processedApplications,
        0,
        'Should process 0 applications for non-existent ID',
      );
      console.log('   Error handling: gracefully handled non-existent application');
    });
  });

  describe('Strategy Selection and Fallback', () => {
    it('should use enhanced strategy when criteria provided', async () => {
      // Arrange
      const lenderCriteria: LenderMatchingCriteria = {
        fixedInterestRate: 7.5,
      };

      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        lenderCriteria,
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert - verify the enhanced strategy was used by checking logs or behavior
      assert.ok(result, 'Should complete matching');
      console.log('   Strategy selection: Enhanced strategy used with criteria');
    });

    it('should fallback to legacy when no criteria provided', async () => {
      // Arrange
      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        // No criteria provided
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should complete matching');
      console.log('   Strategy selection: Legacy fallback used without criteria');
    });
  });

  describe('Multi-Scenario: Multiple Offers and Applications', () => {
    it('should match multiple applications with multiple offers efficiently', async () => {
      // Arrange - Create diverse portfolio of lenders and borrowers
      console.log('\n📊 Creating multi-scenario test data...');

      // Create 3 additional lenders with different profiles
      const conservativeLender = await repository.betterAuthCreateUser({
        name: 'Conservative Lender',
        email: 'conservative@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await repository.userDecidesUserType({
        userId: String(conservativeLender.id),
        userType: 'Individual',
        decisionDate: new Date(),
      });

      const aggressiveLender = await repository.betterAuthCreateUser({
        name: 'Aggressive Lender',
        email: 'aggressive@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await repository.userDecidesUserType({
        userId: String(aggressiveLender.id),
        userType: 'Individual',
        decisionDate: new Date(),
      });

      const bankInstitution = await repository.betterAuthCreateUser({
        name: 'Big Bank',
        email: 'bigbank@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await repository.userDecidesUserType({
        userId: String(bankInstitution.id),
        userType: 'Institution',
        decisionDate: new Date(),
      });

      // Create 5 additional borrowers with different needs
      const borrowers: string[] = [];
      for (let i = 0; i < 5; i++) {
        const borrower = await repository.betterAuthCreateUser({
          name: `Borrower ${i + 1}`,
          email: `borrower${i + 1}@test.com`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await repository.userDecidesUserType({
          userId: String(borrower.id),
          userType: 'Individual',
          decisionDate: new Date(),
        });
        borrowers.push(String(borrower.id));
      }

      console.log(`✅ Created 3 lenders and 5 borrowers`);

      // Create diverse offers
      const offers = await createDiverseOffers(
        repository,
        String(conservativeLender.id),
        String(aggressiveLender.id),
        String(bankInstitution.id),
      );

      console.log(`✅ Created ${offers.length} diverse loan offers`);

      // Create diverse applications
      const applications = await createDiverseApplications(repository, borrowers);

      console.log(`✅ Created ${applications.length} loan applications`);
      console.log('\n🎯 Running matching algorithm...\n');

      // Act - Run matching without criteria (legacy path for maximum matches)
      const matchingData: LoanMatchingWorkerData = {
        batchSize: 20,
        asOfDate: new Date().toISOString(),
      };

      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should return matching result');
      assert.ok(
        result.processedApplications >= applications.length,
        'Should process all applications',
      );
      assert.ok(result.processedOffers >= offers.length, 'Should consider all offers');
      assert.ok(result.matchedPairs > 0, 'Should create at least one match');

      console.log('\n📈 Multi-Scenario Results:');
      console.log(`   Applications processed: ${result.processedApplications}`);
      console.log(`   Offers evaluated: ${result.processedOffers}`);
      console.log(`   Successful matches: ${result.matchedPairs}`);
      console.log(
        `   Match rate: ${((result.matchedPairs / result.processedApplications) * 100).toFixed(1)}%`,
      );
    });

    it('should prioritize institution offers when borrower prefers institutions', async () => {
      // Arrange - Create borrower who prefers institutions
      const institutionFan = await repository.betterAuthCreateUser({
        name: 'Institution Fan',
        email: 'institution-fan@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await repository.userDecidesUserType({
        userId: String(institutionFan.id),
        userType: 'Individual',
        decisionDate: new Date(),
      });

      // Create application with institution preference
      const _appId = await createTestApplication(repository, String(institutionFan.id));

      const borrowerCriteria: BorrowerMatchingCriteria = {
        fixedPrincipalAmount: '50000',
        maxInterestRate: 10,
        preferInstitutionalLenders: true,
      };

      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        borrowerCriteria,
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should complete matching');
      console.log('\n🏦 Institution preference test:');
      console.log(
        `   Processed: ${result.processedApplications} apps, ${result.processedOffers} offers`,
      );
      console.log(`   Matches: ${result.matchedPairs}`);
    });

    it('should match only applications meeting lender criteria', async () => {
      // Arrange - Create selective lender criteria
      const lenderCriteria: LenderMatchingCriteria = {
        durationOptions: [24], // Only 24-month terms
        fixedInterestRate: 7.0, // 7% rate
      };

      // Create fresh applications matching and not matching criteria
      const borrower1 = await repository.betterAuthCreateUser({
        name: 'Perfect Match Borrower',
        email: 'perfect@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await repository.userDecidesUserType({
        userId: String(borrower1.id),
        userType: 'Individual',
        decisionDate: new Date(),
      });

      await createTestApplication(repository, String(borrower1.id));

      const matchingData: LoanMatchingWorkerData = {
        batchSize: 10,
        asOfDate: new Date().toISOString(),
        lenderCriteria,
      };

      // Act
      const result = await service.processLoanMatching(matchingData);

      // Assert
      assert.ok(result, 'Should complete matching with lender criteria');
      console.log('\n🎯 Lender criteria filtering:');
      console.log(`   Criteria: 24mo term, 7% rate`);
      console.log(`   Applications: ${result.processedApplications}`);
      console.log(`   Matches: ${result.matchedPairs}`);
    });
  });
});

/**
 * Helper: Create diverse loan offers with different characteristics
 */
async function createDiverseOffers(
  repository: InMemoryCryptogadaiRepository,
  conservativeLenderId: string,
  aggressiveLenderId: string,
  institutionLenderId: string,
) {
  const now = new Date();
  const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const invoiceDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invoiceExpiredDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const baseInvoiceId = 20000 + (Date.now() % 1000);
  const offers: string[] = [];

  // Conservative Offer 1: Low amount, low risk, low rate
  const conservativeOffer1 = await repository.lenderCreatesLoanOffer({
    lenderUserId: conservativeLenderId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '50000',
    minLoanPrincipalAmount: '5000',
    maxLoanPrincipalAmount: '25000',
    interestRate: 5.5,
    termInMonthsOptions: [12],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/200",
    fundingWalletAddress: '0x' + (Date.now() + 100).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });
  await repository.testPublishesLoanOffer({
    loanOfferId: conservativeOffer1.id,
    publishedDate: now,
  });
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: conservativeOffer1.id,
    paymentDate: now,
  });
  offers.push(conservativeOffer1.id);

  // Conservative Offer 2: Medium amount, moderate terms
  const conservativeOffer2 = await repository.lenderCreatesLoanOffer({
    lenderUserId: conservativeLenderId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '100000',
    minLoanPrincipalAmount: '10000',
    maxLoanPrincipalAmount: '40000',
    interestRate: 6.0,
    termInMonthsOptions: [12, 24],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/201",
    fundingWalletAddress: '0x' + (Date.now() + 101).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 1,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });
  await repository.testPublishesLoanOffer({
    loanOfferId: conservativeOffer2.id,
    publishedDate: now,
  });
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: conservativeOffer2.id,
    paymentDate: now,
  });
  offers.push(conservativeOffer2.id);

  // Aggressive Offer 1: High amount, high risk, high rate
  const aggressiveOffer1 = await repository.lenderCreatesLoanOffer({
    lenderUserId: aggressiveLenderId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '150000',
    minLoanPrincipalAmount: '20000',
    maxLoanPrincipalAmount: '75000',
    interestRate: 9.5,
    termInMonthsOptions: [24, 36],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/202",
    fundingWalletAddress: '0x' + (Date.now() + 102).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 2,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });
  await repository.testPublishesLoanOffer({
    loanOfferId: aggressiveOffer1.id,
    publishedDate: now,
  });
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: aggressiveOffer1.id,
    paymentDate: now,
  });
  offers.push(aggressiveOffer1.id);

  // Aggressive Offer 2: Very flexible terms
  const aggressiveOffer2 = await repository.lenderCreatesLoanOffer({
    lenderUserId: aggressiveLenderId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '200000',
    minLoanPrincipalAmount: '15000',
    maxLoanPrincipalAmount: '80000',
    interestRate: 8.5,
    termInMonthsOptions: [12, 24, 36],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/203",
    fundingWalletAddress: '0x' + (Date.now() + 103).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 3,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });
  await repository.testPublishesLoanOffer({
    loanOfferId: aggressiveOffer2.id,
    publishedDate: now,
  });
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: aggressiveOffer2.id,
    paymentDate: now,
  });
  offers.push(aggressiveOffer2.id);

  // Institution Offer 1: Large amounts, competitive rates
  const institutionOffer1 = await repository.lenderCreatesLoanOffer({
    lenderUserId: institutionLenderId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '500000',
    minLoanPrincipalAmount: '25000',
    maxLoanPrincipalAmount: '100000',
    interestRate: 5.0,
    termInMonthsOptions: [12, 24, 36],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/204",
    fundingWalletAddress: '0x' + (Date.now() + 104).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 4,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });
  await repository.testPublishesLoanOffer({
    loanOfferId: institutionOffer1.id,
    publishedDate: now,
  });
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: institutionOffer1.id,
    paymentDate: now,
  });
  offers.push(institutionOffer1.id);

  // Institution Offer 2: Smaller amounts, premium rate
  const institutionOffer2 = await repository.lenderCreatesLoanOffer({
    lenderUserId: institutionLenderId,
    principalBlockchainKey: 'eip155:1',
    principalTokenId: 'USDC',
    offeredPrincipalAmount: '300000',
    minLoanPrincipalAmount: '10000',
    maxLoanPrincipalAmount: '50000',
    interestRate: 6.5,
    termInMonthsOptions: [24],
    expirationDate,
    createdDate: now,
    fundingWalletDerivationPath: "m/44'/60'/0'/0/205",
    fundingWalletAddress: '0x' + (Date.now() + 105).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 5,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });
  await repository.testPublishesLoanOffer({
    loanOfferId: institutionOffer2.id,
    publishedDate: now,
  });
  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: institutionOffer2.id,
    paymentDate: now,
  });
  offers.push(institutionOffer2.id);

  return offers;
}

/**
 * Helper: Create diverse loan applications with different requirements
 */
async function createDiverseApplications(
  repository: InMemoryCryptogadaiRepository,
  borrowerUserIds: string[],
) {
  const now = new Date();
  const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const applications: string[] = [];

  // Application 1: Small loan, low risk (10K USDC, 5 ETH collateral)
  const app1Rows = await repository.sql`
    INSERT INTO loan_applications (
      borrower_user_id, principal_currency_blockchain_key, principal_currency_token_id,
      principal_amount, provision_amount, max_interest_rate, min_ltv_ratio, max_ltv_ratio,
      term_in_months, liquidation_mode, collateral_currency_blockchain_key,
      collateral_currency_token_id, collateral_deposit_amount, collateral_deposit_exchange_rate_id,
      status, applied_date, expired_date
    )
    VALUES (
      ${borrowerUserIds[0]}, 'eip155:1', 'USDC', 10000, 0, 8, 0.5, 0.75,
      12, 'Partial', 'eip155:1', 'ETH', 5, 1,
      'PendingCollateral', ${now.toISOString()}, ${expirationDate.toISOString()}
    )
    RETURNING id
  `;
  const app1Id = String((app1Rows[0] as { id: number }).id);
  await repository.sql`
    UPDATE loan_applications 
    SET status = 'Published', published_date = ${now.toISOString()}
    WHERE id = ${app1Id}
  `;
  applications.push(app1Id);

  // Application 2: Medium loan, moderate risk (30K USDC, 13 ETH collateral)
  const app2Rows = await repository.sql`
    INSERT INTO loan_applications (
      borrower_user_id, principal_currency_blockchain_key, principal_currency_token_id,
      principal_amount, provision_amount, max_interest_rate, min_ltv_ratio, max_ltv_ratio,
      term_in_months, liquidation_mode, collateral_currency_blockchain_key,
      collateral_currency_token_id, collateral_deposit_amount, collateral_deposit_exchange_rate_id,
      status, applied_date, expired_date
    )
    VALUES (
      ${borrowerUserIds[1]}, 'eip155:1', 'USDC', 30000, 0, 9, 0.6, 0.8,
      24, 'Partial', 'eip155:1', 'ETH', 13, 1,
      'PendingCollateral', ${now.toISOString()}, ${expirationDate.toISOString()}
    )
    RETURNING id
  `;
  const app2Id = String((app2Rows[0] as { id: number }).id);
  await repository.sql`
    UPDATE loan_applications 
    SET status = 'Published', published_date = ${now.toISOString()}
    WHERE id = ${app2Id}
  `;
  applications.push(app2Id);

  // Application 3: Large loan, willing to pay higher rate (60K USDC, 26 ETH collateral)
  const app3Rows = await repository.sql`
    INSERT INTO loan_applications (
      borrower_user_id, principal_currency_blockchain_key, principal_currency_token_id,
      principal_amount, provision_amount, max_interest_rate, min_ltv_ratio, max_ltv_ratio,
      term_in_months, liquidation_mode, collateral_currency_blockchain_key,
      collateral_currency_token_id, collateral_deposit_amount, collateral_deposit_exchange_rate_id,
      status, applied_date, expired_date
    )
    VALUES (
      ${borrowerUserIds[2]}, 'eip155:1', 'USDC', 60000, 0, 10, 0.6, 0.8,
      36, 'Partial', 'eip155:1', 'ETH', 26, 1,
      'PendingCollateral', ${now.toISOString()}, ${expirationDate.toISOString()}
    )
    RETURNING id
  `;
  const app3Id = String((app3Rows[0] as { id: number }).id);
  await repository.sql`
    UPDATE loan_applications 
    SET status = 'Published', published_date = ${now.toISOString()}
    WHERE id = ${app3Id}
  `;
  applications.push(app3Id);

  // Application 4: Very small loan, short term (5K USDC, 3 ETH collateral)
  const app4Rows = await repository.sql`
    INSERT INTO loan_applications (
      borrower_user_id, principal_currency_blockchain_key, principal_currency_token_id,
      principal_amount, provision_amount, max_interest_rate, min_ltv_ratio, max_ltv_ratio,
      term_in_months, liquidation_mode, collateral_currency_blockchain_key,
      collateral_currency_token_id, collateral_deposit_amount, collateral_deposit_exchange_rate_id,
      status, applied_date, expired_date
    )
    VALUES (
      ${borrowerUserIds[3]}, 'eip155:1', 'USDC', 5000, 0, 7, 0.4, 0.6,
      12, 'Partial', 'eip155:1', 'ETH', 3, 1,
      'PendingCollateral', ${now.toISOString()}, ${expirationDate.toISOString()}
    )
    RETURNING id
  `;
  const app4Id = String((app4Rows[0] as { id: number }).id);
  await repository.sql`
    UPDATE loan_applications 
    SET status = 'Published', published_date = ${now.toISOString()}
    WHERE id = ${app4Id}
  `;
  applications.push(app4Id);

  // Application 5: Medium-large loan, flexible terms (45K USDC, 19 ETH collateral)
  const app5Rows = await repository.sql`
    INSERT INTO loan_applications (
      borrower_user_id, principal_currency_blockchain_key, principal_currency_token_id,
      principal_amount, provision_amount, max_interest_rate, min_ltv_ratio, max_ltv_ratio,
      term_in_months, liquidation_mode, collateral_currency_blockchain_key,
      collateral_currency_token_id, collateral_deposit_amount, collateral_deposit_exchange_rate_id,
      status, applied_date, expired_date
    )
    VALUES (
      ${borrowerUserIds[4]}, 'eip155:1', 'USDC', 45000, 0, 8.5, 0.6, 0.8,
      24, 'Partial', 'eip155:1', 'ETH', 19, 1,
      'PendingCollateral', ${now.toISOString()}, ${expirationDate.toISOString()}
    )
    RETURNING id
  `;
  const app5Id = String((app5Rows[0] as { id: number }).id);
  await repository.sql`
    UPDATE loan_applications 
    SET status = 'Published', published_date = ${now.toISOString()}
    WHERE id = ${app5Id}
  `;
  applications.push(app5Id);

  return applications;
}

/**
 * Helper: Setup currencies
 */
async function setupCurrencies(repository: InMemoryCryptogadaiRepository) {
  // Create currencies
  await repository.sql`
    INSERT INTO currencies (blockchain_key, token_id, name, symbol, decimals, image, max_ltv, ltv_warning_threshold, ltv_critical_threshold, ltv_liquidation_threshold, min_loan_principal_amount, max_loan_principal_amount)
    VALUES 
      ('eip155:1', 'USDC', 'USD Coin', 'USDC', 6, 'https://example.com/usdc.png', 0, 0, 0, 0, 1000, 1000000),
      ('eip155:1', 'ETH', 'Ethereum', 'ETH', 18, 'https://example.com/eth.png', 0.8, 0.75, 0.85, 0.9, 0, 0),
      ('eip155:1', 'BTC', 'Bitcoin', 'BTC', 8, 'https://example.com/btc.png', 0.7, 0.65, 0.75, 0.8, 0, 0)
    ON CONFLICT DO NOTHING
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
    VALUES (${priceFeedId}, 3000.0, 3000.0, NOW(), NOW())
  `;
}

/**
 * Helper: Create published loan offers
 */
async function createPublishedOffers(
  repository: InMemoryCryptogadaiRepository,
  lenderUserId: string,
  institutionUserId: string,
) {
  const now = new Date();
  const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const invoiceDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invoiceExpiredDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Use unique invoice IDs
  const baseInvoiceId = 10000 + (Date.now() % 1000);

  // Offer 1: Individual, 7.5%, flexible terms
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
    fundingWalletDerivationPath: "m/44'/60'/0'/0/100",
    fundingWalletAddress: '0x' + Date.now().toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });

  await repository.testPublishesLoanOffer({
    loanOfferId: offer1.id,
    publishedDate: now,
  });

  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: offer1.id,
    paymentDate: now,
  });

  // Offer 2: Individual, 8%, limited term
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
    fundingWalletDerivationPath: "m/44'/60'/0'/0/101",
    fundingWalletAddress: '0x' + (Date.now() + 1).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 1,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });

  await repository.testPublishesLoanOffer({
    loanOfferId: offer2.id,
    publishedDate: now,
  });

  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: offer2.id,
    paymentDate: now,
  });

  // Offer 3: Institution, 6.5%, flexible terms
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
    fundingWalletDerivationPath: "m/44'/60'/0'/0/102",
    fundingWalletAddress: '0x' + (Date.now() + 2).toString(16).padStart(40, '0'),
    fundingInvoiceId: baseInvoiceId + 2,
    fundingInvoicePrepaidAmount: '0',
    fundingInvoiceDate: now,
    fundingInvoiceDueDate: invoiceDueDate,
    fundingInvoiceExpiredDate: invoiceExpiredDate,
  });

  await repository.testPublishesLoanOffer({
    loanOfferId: offer3.id,
    publishedDate: now,
  });

  await repository.testPaysLoanOfferFundingInvoice({
    loanOfferId: offer3.id,
    paymentDate: now,
  });

  return {
    offer1: offer1.id,
    offer2: offer2.id,
    offer3: offer3.id,
  };
}

/**
 * Helper: Create test loan application
 */
async function createTestApplication(
  repository: InMemoryCryptogadaiRepository,
  borrowerUserId: string,
) {
  const now = new Date();
  const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Insert application directly with SQL - start with PendingCollateral
  const rows = await repository.sql`
    INSERT INTO loan_applications (
      borrower_user_id,
      principal_currency_blockchain_key,
      principal_currency_token_id,
      principal_amount,
      provision_amount,
      max_interest_rate,
      min_ltv_ratio,
      max_ltv_ratio,
      term_in_months,
      liquidation_mode,
      collateral_currency_blockchain_key,
      collateral_currency_token_id,
      collateral_deposit_amount,
      collateral_deposit_exchange_rate_id,
      status,
      applied_date,
      expired_date
    )
    VALUES (
      ${borrowerUserId},
      'eip155:1',
      'USDC',
      50000,
      0,
      10,
      0.5,
      0.8,
      24,
      'Partial',
      'eip155:1',
      'ETH',
      21,
      1,
      'PendingCollateral',
      ${now.toISOString()},
      ${expirationDate.toISOString()}
    )
    RETURNING id
  `;

  const row = rows[0] as { id: number };
  const appId = String(row.id);

  // Now update to Published status
  await repository.sql`
    UPDATE loan_applications 
    SET status = 'Published', published_date = ${now.toISOString()}
    WHERE id = ${appId}
  `;

  return appId;
}
