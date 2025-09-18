import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';

import { TestUser, TestUserFactory } from '../../../test/utils/test-user.factory';
import { AppModule } from '../../app.module';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AuthService } from '../auth/auth.service';

describe('Loans API (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let repository: CryptogadaiRepository;
  let _testUser: TestUser;
  let authToken: string;
  let _lenderAuthToken: string;
  let _borrowerUserId: string;
  let _lenderUserId: string;
  let realLoanId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    authService = moduleFixture.get<AuthService>(AuthService);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();

    // Setup test exchange rates for loans
    repository = moduleFixture.get<CryptogadaiRepository>(CryptogadaiRepository);

    // Add USDT to Ethereum mainnet for testing
    await repository.sql`
      INSERT INTO currencies (
        blockchain_key, token_id, name, symbol, decimals, image,
        min_loan_principal_amount, max_loan_principal_amount,
        max_ltv, ltv_warning_threshold, ltv_critical_threshold, ltv_liquidation_threshold,
        min_withdrawal_amount
      ) VALUES (
        'eip155:1', 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', 'Tether USD', 'USDT', 6, 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        '100000000', '1000000000000', 0, 0, 0, 0, '1000000'
      )
      ON CONFLICT (blockchain_key, token_id) DO NOTHING
    `;

    // Setup ETH/USDT price feed on Ethereum mainnet
    await repository.testSetupPriceFeeds({
      blockchainKey: 'eip155:1',
      baseCurrencyTokenId: 'slip44:60', // ETH
      quoteCurrencyTokenId: 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
      source: 'binance',
      bidPrice: 3000.0,
      askPrice: 3010.0,
      sourceDate: new Date(),
    });

    // Setup crosschain ETH/USD price feed for collateral calculation
    await repository.testSetupPriceFeeds({
      blockchainKey: 'crosschain',
      baseCurrencyTokenId: 'slip44:60', // ETH (crosschain generic)
      quoteCurrencyTokenId: 'iso4217:usd', // USD (crosschain generic)
      source: 'binance',
      bidPrice: 3000.0,
      askPrice: 3010.0,
      sourceDate: new Date(),
    });

    // Setup USD/USD price feed (1:1 for USD)
    await repository.testSetupPriceFeeds({
      blockchainKey: 'crosschain',
      baseCurrencyTokenId: 'iso4217:usd', // USD
      quoteCurrencyTokenId: 'iso4217:usd', // USD
      source: 'binance',
      bidPrice: 1.0,
      askPrice: 1.0,
      sourceDate: new Date(),
    });

    // Create borrower user (main test user) and get session cookie
    const borrowerUser = TestUserFactory.createUser();
    const borrowerResponse = await authService.api.signUpEmail({
      body: borrowerUser,
      returnHeaders: true,
    });

    // Get borrower session cookie and user ID
    const borrowerCookies = borrowerResponse.headers.get('set-cookie');
    authToken = borrowerCookies || '';
    _borrowerUserId = borrowerResponse.response.user.id;

    // Create lender user (different from borrower)
    const lenderUser = TestUserFactory.createUser();
    const lenderResponse = await authService.api.signUpEmail({
      body: lenderUser,
      returnHeaders: true,
    });

    // Get lender session cookie and user ID
    const lenderCookies = lenderResponse.headers.get('set-cookie');
    _lenderAuthToken = lenderCookies || '';
    _lenderUserId = lenderResponse.response.user.id;

    // Create a real loan for testing liquidation/repayment operations
    // First, set up platform configuration with unique date
    const uniqueDate = new Date(Date.now() + Math.random() * 1000); // Use current timestamp with random offset
    await repository.testSetupPlatformConfig({
      effectiveDate: uniqueDate,
      adminUserId: 1,
      loanProvisionRate: 2.5,
      loanIndividualRedeliveryFeeRate: 1.0,
      loanInstitutionRedeliveryFeeRate: 0.5,
      loanMinLtvRatio: 50.0,
      loanMaxLtvRatio: 75.0,
      loanRepaymentDurationInDays: 30,
    });

    // Create unique derivation paths to avoid conflicts
    const uniquePathSuffix = Date.now() % 100000; // Use timestamp to ensure uniqueness
    const lenderDerivationPath = `m/44'/60'/0'/0/${uniquePathSuffix}`;
    const borrowerDerivationPath = `m/44'/60'/0'/0/${uniquePathSuffix + 1}`;

    // Create a loan offer (from lender user)
    const loanOfferResult = await repository.lenderCreatesLoanOffer({
      lenderUserId: lenderResponse.response.user.id,
      principalBlockchainKey: 'eip155:1',
      principalTokenId: 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7',
      offeredPrincipalAmount: '5000000000', // 5000 USDT (6 decimals)
      minLoanPrincipalAmount: '1000000000', // 1000 USDT
      maxLoanPrincipalAmount: '5000000000', // 5000 USDT
      interestRate: 12.5,
      termInMonthsOptions: [3, 6],
      expirationDate: new Date('2025-12-31'),
      createdDate: new Date('2025-01-01'),
      fundingWalletDerivationPath: lenderDerivationPath,
      fundingWalletAddress: '0x742d35Cc8e6e8C6e7e0e6B1C9Bb0C9e8f8f8f8f8',
    });

    // Create a loan application (from borrower user)
    const loanApplicationResult = await repository.borrowerCreatesLoanApplication({
      borrowerUserId: borrowerResponse.response.user.id,
      collateralBlockchainKey: 'eip155:1',
      collateralTokenId: 'slip44:60', // ETH
      principalBlockchainKey: 'eip155:1',
      principalTokenId: 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
      principalAmount: '3000000000', // 3000 USDT
      maxInterestRate: 15.0,
      termInMonths: 3,
      liquidationMode: 'Partial',
      appliedDate: new Date('2025-01-01'),
      expirationDate: new Date('2025-12-31'),
      collateralWalletDerivationPath: borrowerDerivationPath,
      collateralWalletAddress: '0x123d35Cc8e6e8C6e7e0e6B1C9Bb0C9e8f8f8f8f9',
    });

    // Publish the loan offer and application
    await repository.testPublishesLoanOffer({
      loanOfferId: loanOfferResult.id,
      publishedDate: new Date('2025-01-02'),
    });

    // Manually update loan application status to 'Published' since there's no test method for this
    await repository.sql`UPDATE loan_applications SET status = 'Published' WHERE id = ${loanApplicationResult.id}`;

    // Match the loan offer and application
    const _matchResult = await repository.platformMatchesLoanOffers({
      loanApplicationId: loanApplicationResult.id,
      loanOfferId: loanOfferResult.id,
      matchedDate: new Date('2025-01-03'),
      matchedLtvRatio: 0.65,
      matchedCollateralValuationAmount: '4615384615', // 3000 USDT / 65% = ~4615 USDT
    });

    // Originate the loan to create an actual loan record
    const loanOriginationResult = await repository.platformOriginatesLoan({
      loanOfferId: loanOfferResult.id,
      loanApplicationId: loanApplicationResult.id,
      principalAmount: '3000000000', // 3000 USDT
      interestAmount: '75000000', // 2.5% of 3000 = 75 USDT
      repaymentAmount: '3075000000', // principal + interest
      redeliveryFeeAmount: '750000', // 1% of interest = 0.75 USDT
      redeliveryAmount: '3074250000', // repayment - redelivery fee
      premiAmount: '30000000', // 1% of principal = 30 USDT
      liquidationFeeAmount: '60000000', // 2% of principal = 60 USDT
      minCollateralValuation: '3165000000', // repayment + premi + liquidation fee
      mcLtvRatio: 0.948, // principal / min collateral valuation
      collateralAmount: '1537500000000000000', // ~1.5375 ETH at 3000 USDT/ETH
      legalDocumentPath: '/legal/test_loan.pdf',
      legalDocumentHash: 'test123hash456',
      originationDate: new Date('2025-01-03'),
      maturityDate: new Date('2025-04-03'), // 3 months later
    });

    // Disburse principal to activate the loan (change status from 'Originated' to 'Active')
    await repository.platformDisbursesPrincipal({
      loanId: loanOriginationResult.id,
      disbursementDate: new Date('2025-01-04'),
    });

    realLoanId = loanOriginationResult.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Loan Offers', () => {
    describe('POST /loan-offers', () => {
      it('should create a loan offer successfully', () => {
        const createLoanOfferDto = {
          principalBlockchainKey: 'eip155:1',
          principalTokenId: 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT on Ethereum
          totalAmount: '10000.000000000000000000',
          interestRate: 12.5,
          termOptions: [3, 6],
          minLoanAmount: '1000.000000000000000000',
          maxLoanAmount: '10000.000000000000000000',
          liquidationMode: 'Partial',
        };

        return request(app.getHttpServer())
          .post('/loan-offers')
          .set('Cookie', authToken)
          .send(createLoanOfferDto)
          .expect(res => {
            if (res.status !== 201) {
              console.log('Loan Offer Creation Error:', res.status, res.body);
            }
            expect(res.status).toBe(201);
          })
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.lenderId).toBeDefined();
            expect(res.body.data.totalAmount).toBe('10000');
            expect(res.body.data.interestRate).toBe(createLoanOfferDto.interestRate);
            expect(res.body.data.status).toBe('Draft');
            expect(res.body.data.fundingInvoice).toBeDefined();
          });
      });

      it('should return 400 for invalid loan offer data', () => {
        const invalidDto = {
          principalBlockchainKey: '', // Invalid: empty string
          totalAmount: 'invalid-amount', // Invalid: not a decimal string
          interestRate: -5, // Invalid: negative interest rate
        };

        return request(app.getHttpServer())
          .post('/loan-offers')
          .set('Cookie', authToken)
          .send(invalidDto)
          .expect(400);
      });

      it('should return 401 without authentication', () => {
        const createLoanOfferDto = {
          principalBlockchainKey: 'eip155:1',
          principalTokenId: 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT on Ethereum
          totalAmount: '10000.000000000000000000',
          interestRate: 12.5,
          termOptions: [3, 6],
          minLoanAmount: '1000.000000',
          maxLoanAmount: '10000.000000',
          liquidationMode: 'Partial',
        };

        return request(app.getHttpServer())
          .post('/loan-offers')
          .send(createLoanOfferDto)
          .expect(401);
      });
    });

    describe('GET /loan-offers', () => {
      it('should list available loan offers with pagination', () => {
        return request(app.getHttpServer())
          .get('/loan-offers')
          .set('Cookie', authToken)
          .query({ page: 1, limit: 10 })
          .expect(200)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.offers).toBeDefined();
            expect(Array.isArray(res.body.data.offers)).toBe(true);
            expect(res.body.data.pagination).toBeDefined();
            expect(res.body.data.pagination.page).toBe(1);
            expect(res.body.data.pagination.limit).toBe(10);
          });
      });

      it('should filter loan offers by blockchain parameters', () => {
        return request(app.getHttpServer())
          .get('/loan-offers')
          .set('Cookie', authToken)
          .query({
            collateralBlockchainKey: 'eip155:1',
            principalBlockchainKey: 'eip155:1',
            page: 1,
            limit: 20,
          })
          .expect(200);
      });
    });

    describe('GET /loan-offers/my-offers', () => {
      it("should return lender's loan offers", () => {
        return request(app.getHttpServer())
          .get('/loan-offers/my-offers')
          .set('Cookie', authToken)
          .query({ page: 1, limit: 20 })
          .expect(200)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.offers).toBeDefined();
            expect(res.body.data.pagination).toBeDefined();
          });
      });

      it('should return 401 without authentication', () => {
        return request(app.getHttpServer()).get('/loan-offers/my-offers').expect(401);
      });
    });
  });

  describe('Loan Applications', () => {
    describe('POST /loan-applications/calculate', () => {
      it('should calculate loan requirements successfully', () => {
        const calculationRequest = {
          collateralBlockchainKey: 'eip155:1',
          collateralTokenId: 'slip44:60', // ETH as collateral
          principalBlockchainKey: 'eip155:1',
          principalTokenId: 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT as loan currency
          principalAmount: '5000.000000000000000000',
        };

        return request(app.getHttpServer())
          .post('/loan-applications/calculate')
          .set('Cookie', authToken)
          .send(calculationRequest)
          .expect(res => {
            if (res.status !== 201) {
              console.log('Loan Calculation Error:', res.status, res.body);
            }
            expect(res.status).toBe(201);
          })
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.requiredCollateralAmount).toBeDefined();
            expect(res.body.data.exchangeRate).toBeDefined();
            expect(res.body.data.collateralCurrency).toBeDefined();
            expect(res.body.data.principalCurrency).toBeDefined();
            expect(res.body.data.maxLtvRatio).toBeDefined();
            expect(res.body.data.safetyBuffer).toBeDefined();
          });
      });

      it('should return 400 for invalid calculation request', () => {
        const invalidRequest = {
          collateralBlockchainKey: '', // Invalid: empty
          principalAmount: 'invalid', // Invalid: not decimal
        };

        return request(app.getHttpServer())
          .post('/loan-applications/calculate')
          .set('Cookie', authToken)
          .send(invalidRequest)
          .expect(400);
      });
    });

    describe('POST /loan-applications', () => {
      it('should create loan application successfully', () => {
        const createApplicationDto = {
          collateralBlockchainKey: 'eip155:1',
          collateralTokenId: 'slip44:60', // ETH as collateral
          principalAmount: '5000.000000000000000000',
          principalBlockchainKey: 'eip155:1',
          principalTokenId: 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT as loan currency
          maxInterestRate: 15.0,
          termMonths: 6,
          liquidationMode: 'Full',
          minLtvRatio: 0.5,
        };

        return request(app.getHttpServer())
          .post('/loan-applications')
          .set('Cookie', authToken)
          .send(createApplicationDto)
          .expect(201)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.borrowerId).toBeDefined();
            expect(res.body.data.principalAmount).toBe('5000');
            expect(res.body.data.status).toBe('Draft');
            expect(res.body.data.collateralInvoice).toBeDefined();
          });
      });
    });
  });

  describe('Loans', () => {
    describe('GET /loans', () => {
      it("should list user's loans", () => {
        return request(app.getHttpServer())
          .get('/loans')
          .set('Cookie', authToken)
          .query({ page: 1, limit: 20 })
          .expect(200)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.loans).toBeDefined();
            expect(res.body.data.pagination).toBeDefined();
          });
      });

      it('should filter loans by role and status', () => {
        return request(app.getHttpServer())
          .get('/loans')
          .set('Cookie', authToken)
          .query({
            role: 'borrower',
            status: 'active',
            page: 1,
            limit: 10,
          })
          .expect(200);
      });
    });

    describe('POST /loans/:id/early-liquidation/estimate', () => {
      it('should calculate early liquidation estimate', () => {
        const loanId = realLoanId;

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-liquidation/estimate`)
          .set('Cookie', authToken)
          .expect(201)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.loanId).toBe(loanId);
            expect(res.body.data.calculationDate).toBeDefined();
            expect(res.body.data.disclaimers).toBeDefined();
          });
      });
    });

    describe('POST /loans/:id/early-liquidation/request', () => {
      it('should submit early liquidation request', () => {
        const loanId = realLoanId;
        const requestDto = { acknowledgment: true };

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-liquidation/request`)
          .set('Cookie', authToken)
          .send(requestDto)
          .expect(201)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.loanId).toBe(loanId);
            expect(res.body.data.liquidationId).toBeDefined();
            expect(res.body.data.status).toBe('Pending');
            expect(res.body.message).toBeDefined();
          });
      });

      it('should return 400 when acknowledgment is false', () => {
        const loanId = realLoanId;
        const requestDto = { acknowledgment: false };

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-liquidation/request`)
          .set('Cookie', authToken)
          .send(requestDto)
          .expect(400);
      });
    });

    describe('POST /loans/:id/early-repayment/request', () => {
      it('should submit early repayment request', () => {
        const loanId = realLoanId;
        const requestDto = { acknowledgment: true };

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-repayment/request`)
          .set('Cookie', authToken)
          .send(requestDto)
          .expect(201)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.loanId).toBe(loanId);
            expect(res.body.data.repaymentId).toBeDefined();
            expect(res.body.data.status).toBe('Pending');
            expect(res.body.message).toBeDefined();
          });
      });
    });
  });
});
