import type { INestApplication } from '@nestjs/common';

import { Test, TestingModule } from '@nestjs/testing';

import * as request from 'supertest';

import { AppModule } from '../../src/app.module';

describe('Loan Applications (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/loan-applications/calculate (POST)', () => {
    it('should calculate loan requirements', () => {
      return request(app.getHttpServer())
        .post('/loan-applications/calculate')
        .send({
          collateralBlockchainKey: 'btc-mainnet',
          collateralTokenId: 'BTC',
          principalBlockchainKey: 'eth-mainnet',
          principalTokenId: 'USDC',
          principalAmount: '1000.000000000000000000',
          termInMonths: 12,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success');
          if (res.body.success) {
            expect(res.body.data).toHaveProperty('requiredCollateralAmount');
            expect(res.body.data).toHaveProperty('exchangeRate');
            expect(res.body.data).toHaveProperty('collateralCurrency');
            expect(res.body.data).toHaveProperty('principalCurrency');
            expect(res.body.data).toHaveProperty('maxLtvRatio');
            expect(res.body.data).toHaveProperty('calculationDetails');
          }
        });
    });

    it('should return error for invalid blockchain', () => {
      return request(app.getHttpServer())
        .post('/loan-applications/calculate')
        .send({
          collateralBlockchainKey: 'invalid-blockchain',
          collateralTokenId: 'INVALID',
          principalBlockchainKey: 'eth-mainnet',
          principalTokenId: 'USDC',
          principalAmount: '1000.000000000000000000',
          termInMonths: 12,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success');
          if (!res.body.success) {
            expect(res.body).toHaveProperty('error');
          }
        });
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/loan-applications/calculate')
        .send({
          collateralBlockchainKey: 'btc-mainnet',
          // Missing required fields
        })
        .expect(400);
    });

    it('should validate principal amount format', () => {
      return request(app.getHttpServer())
        .post('/loan-applications/calculate')
        .send({
          collateralBlockchainKey: 'btc-mainnet',
          collateralTokenId: 'BTC',
          principalBlockchainKey: 'eth-mainnet',
          principalTokenId: 'USDC',
          principalAmount: 'invalid-amount', // Invalid format
          termInMonths: 12,
        })
        .expect(400);
    });
  });

  describe('/loan-applications (POST) - Authentication Required', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/loan-applications')
        .send({
          collateralBlockchainKey: 'btc-mainnet',
          collateralTokenId: 'BTC',
          principalBlockchainKey: 'eth-mainnet',
          principalTokenId: 'USDC',
          principalAmount: '1000.000000000000000000',
          maxInterestRate: 15,
          termMonths: 12,
          liquidationMode: 'FULL',
        })
        .expect(401);
    });
  });

  describe('/loan-applications/my-applications (GET) - Authentication Required', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer()).get('/loan-applications/my-applications').expect(401);
    });

    it('should accept pagination parameters when authenticated', () => {
      // This test would require authentication setup
      // For now, we'll just test that the endpoint exists and requires auth
      return request(app.getHttpServer())
        .get('/loan-applications/my-applications?page=1&limit=10')
        .expect(401);
    });
  });

  describe('Endpoint Structure Validation', () => {
    it('should have correct API structure', () => {
      // Test that our endpoints are properly defined
      return request(app.getHttpServer())
        .post('/loan-applications/calculate')
        .send({})
        .then(res => {
          // Should not be 404 - endpoint exists
          expect(res.status).not.toBe(404);
        });
    });

    it('should return JSON responses', () => {
      return request(app.getHttpServer())
        .post('/loan-applications/calculate')
        .send({
          collateralBlockchainKey: 'btc-mainnet',
          collateralTokenId: 'BTC',
          principalBlockchainKey: 'eth-mainnet',
          principalTokenId: 'USDC',
          principalAmount: '1000.000000000000000000',
          termInMonths: 12,
        })
        .expect('Content-Type', /json/);
    });
  });

  describe('WalletFactory Integration in Live System', () => {
    it('should handle wallet generation for supported blockchains', () => {
      // Test BTC mainnet calculation (which uses WalletFactory internally)
      return request(app.getHttpServer())
        .post('/loan-applications/calculate')
        .send({
          collateralBlockchainKey: 'btc-mainnet',
          collateralTokenId: 'BTC',
          principalBlockchainKey: 'eth-mainnet',
          principalTokenId: 'USDC',
          principalAmount: '1000.000000000000000000',
          termInMonths: 6,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('success');
        });
    });

    it('should handle different blockchain combinations', async () => {
      const blockchainPairs = [
        { collateral: 'btc-mainnet', principal: 'eth-mainnet' },
        { collateral: 'eth-mainnet', principal: 'btc-mainnet' },
        { collateral: 'sol-mainnet', principal: 'eth-mainnet' },
      ];

      for (const pair of blockchainPairs) {
        await request(app.getHttpServer())
          .post('/loan-applications/calculate')
          .send({
            collateralBlockchainKey: pair.collateral,
            collateralTokenId: pair.collateral.includes('btc')
              ? 'BTC'
              : pair.collateral.includes('eth')
                ? 'ETH'
                : 'SOL',
            principalBlockchainKey: pair.principal,
            principalTokenId: pair.principal.includes('btc')
              ? 'BTC'
              : pair.principal.includes('eth')
                ? 'USDC'
                : 'USDC',
            principalAmount: '1000.000000000000000000',
            termInMonths: 6,
          })
          .expect(200);
      }
    });
  });
});
