import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';

import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { LoansModule } from './loans.module';

describe('Loans API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, AuthModule, LoansModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();

    // TODO: Set up authentication token for testing
    // This would typically involve creating a test user and getting an auth token
    authToken = 'Bearer test-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Loan Offers', () => {
    describe('POST /loan-offers', () => {
      it('should create a loan offer successfully', () => {
        const createLoanOfferDto = {
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          totalAmount: '10000.000000000000000000',
          interestRate: 12.5,
          termOptions: [3, 6],
          minLoanAmount: '1000.000000000000000000',
          maxLoanAmount: '10000.000000000000000000',
          liquidationMode: 'Partial',
        };

        return request(app.getHttpServer())
          .post('/loan-offers')
          .set('Authorization', authToken)
          .send(createLoanOfferDto)
          .expect(201)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.lenderId).toBeDefined();
            expect(res.body.data.totalAmount).toBe(createLoanOfferDto.totalAmount);
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
          .set('Authorization', authToken)
          .send(invalidDto)
          .expect(400);
      });

      it('should return 401 without authentication', () => {
        const createLoanOfferDto = {
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          totalAmount: '10000.000000000000000000',
          interestRate: 12.5,
          termOptions: [3, 6],
          minLoanAmount: '1000.000000000000000000',
          maxLoanAmount: '10000.000000000000000000',
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
          .query({
            collateralBlockchainKey: 'eip155:1',
            principalBlockchainKey: 'eip155:56',
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
          .set('Authorization', authToken)
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
          collateralTokenId: 'slip44:60',
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          principalAmount: '5000.000000000000000000',
        };

        return request(app.getHttpServer())
          .post('/loan-applications/calculate')
          .send(calculationRequest)
          .expect(200)
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
          .send(invalidRequest)
          .expect(400);
      });
    });

    describe('POST /loan-applications', () => {
      it('should create loan application successfully', () => {
        const createApplicationDto = {
          collateralBlockchainKey: 'eip155:1',
          collateralTokenId: 'slip44:60',
          principalAmount: '5000.000000000000000000',
          principalBlockchainKey: 'eip155:56',
          principalTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          maxInterestRate: 15.0,
          termMonths: 6,
          liquidationMode: 'Full',
          minLtvRatio: 0.5,
        };

        return request(app.getHttpServer())
          .post('/loan-applications')
          .set('Authorization', authToken)
          .send(createApplicationDto)
          .expect(201)
          .expect(res => {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.borrowerId).toBeDefined();
            expect(res.body.data.principalAmount).toBe(createApplicationDto.principalAmount);
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
          .set('Authorization', authToken)
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
          .set('Authorization', authToken)
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
        const loanId = 'loan_12345';

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-liquidation/estimate`)
          .set('Authorization', authToken)
          .expect(200)
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
        const loanId = 'loan_12345';
        const requestDto = { acknowledgment: true };

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-liquidation/request`)
          .set('Authorization', authToken)
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
        const loanId = 'loan_12345';
        const requestDto = { acknowledgment: false };

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-liquidation/request`)
          .set('Authorization', authToken)
          .send(requestDto)
          .expect(400);
      });
    });

    describe('POST /loans/:id/early-repayment/request', () => {
      it('should submit early repayment request', () => {
        const loanId = 'loan_12345';
        const requestDto = { acknowledgment: true };

        return request(app.getHttpServer())
          .post(`/loans/${loanId}/early-repayment/request`)
          .set('Authorization', authToken)
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
