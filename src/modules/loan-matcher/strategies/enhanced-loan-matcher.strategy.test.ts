import type { MatchableLoanApplication } from '../../types/loan-matcher.types';

import assert from 'node:assert';
import { describe, it, mock } from 'node:test';

import { CryptogadaiRepository } from '../../../../shared/repositories/cryptogadai.repository';
import { EnhancedLoanMatcherStrategy } from './enhanced-loan-matcher.strategy';
import { MatcherStrategyType } from './loan-matcher-strategy.abstract';

describe('EnhancedLoanMatcherStrategy', () => {
  it('should be decorated with Enhanced strategy type', () => {
    const mockRepository = {} as unknown as CryptogadaiRepository;
    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    assert.ok(strategy instanceof EnhancedLoanMatcherStrategy);
  });

  it('should canHandle return true when lender criteria is provided', () => {
    const mockRepository = {} as unknown as CryptogadaiRepository;
    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    const result = strategy.canHandle({ durationOptions: [12, 24] }, undefined);

    assert.strictEqual(result, true);
  });

  it('should canHandle return true when borrower criteria is provided', () => {
    const mockRepository = {} as unknown as CryptogadaiRepository;
    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    const result = strategy.canHandle(undefined, { fixedDuration: 24 });

    assert.strictEqual(result, true);
  });

  it('should canHandle return false when no criteria is provided', () => {
    const mockRepository = {} as unknown as CryptogadaiRepository;
    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    const result = strategy.canHandle(undefined, undefined);

    assert.strictEqual(result, false);
  });

  it('should getDescription return proper description with borrower criteria', () => {
    const mockRepository = {} as unknown as CryptogadaiRepository;
    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    const description = strategy.getDescription(undefined, {
      fixedDuration: 24,
      fixedPrincipalAmount: '50000',
      maxInterestRate: 8.5,
      preferInstitutionalLenders: true,
    });

    assert.ok(description.includes('duration 24mo'));
    assert.ok(description.includes('amount 50000'));
    assert.ok(description.includes('max rate 8.5%'));
    assert.ok(description.includes('prefer institutions: true'));
  });

  it('should getDescription return proper description with lender criteria', () => {
    const mockRepository = {} as unknown as CryptogadaiRepository;
    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    const description = strategy.getDescription(
      {
        durationOptions: [12, 24, 36],
        fixedInterestRate: 7.5,
      },
      undefined,
    );

    assert.ok(description.includes('duration options [12, 24, 36]'));
    assert.ok(description.includes('fixed rate 7.5%'));
  });

  it('should filter offers by lender criteria - duration options', async () => {
    const mockRepository = {
      platformListsAvailableLoanOffers: mock.fn(async () => ({
        loanOffers: [
          {
            id: 'offer1',
            lenderUserId: 'lender1',
            principalCurrency: 'USDC' as const,
            availablePrincipalAmount: '100000',
            minLoanPrincipalAmount: '10000',
            maxLoanPrincipalAmount: '200000',
            interestRate: 8.0,
            termInMonthsOptions: [12, 24],
            expirationDate: new Date('2025-12-31'),
            publishedDate: new Date('2025-01-01'),
          },
          {
            id: 'offer2',
            lenderUserId: 'lender2',
            principalCurrency: 'USDC' as const,
            availablePrincipalAmount: '150000',
            minLoanPrincipalAmount: '20000',
            maxLoanPrincipalAmount: '300000',
            interestRate: 7.5,
            termInMonthsOptions: [36],
            expirationDate: new Date('2025-12-31'),
            publishedDate: new Date('2025-01-01'),
          },
        ],
        pagination: { page: 1, limit: 50, total: 2 },
      })),
    } as unknown as CryptogadaiRepository;

    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    const application: MatchableLoanApplication = {
      id: 'app1',
      borrowerUserId: 'borrower1',
      principalAmount: '50000',
      maxInterestRate: 10.0,
      termInMonths: 24,
      collateralBlockchainKey: 'eip155:1',
      collateralTokenId: 'ETH',
      collateralDepositAmount: '25',
      principalBlockchainKey: 'eip155:1',
      principalTokenId: 'USDC',
      status: 'Approved',
      appliedDate: new Date(),
      expirationDate: new Date('2025-12-31'),
    };

    const result = await strategy.findCompatibleOffers(
      application,
      undefined,
      { durationOptions: [24] },
      undefined,
    );

    // Should only return offer1 which has 24 months option
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'offer1');
  });

  it('should filter offers by borrower criteria - max interest rate', async () => {
    const mockRepository = {
      platformListsAvailableLoanOffers: mock.fn(async () => ({
        loanOffers: [
          {
            id: 'offer1',
            lenderUserId: 'lender1',
            principalCurrency: 'USDC' as const,
            availablePrincipalAmount: '100000',
            minLoanPrincipalAmount: '10000',
            maxLoanPrincipalAmount: '200000',
            interestRate: 8.0,
            termInMonthsOptions: [24],
            expirationDate: new Date('2025-12-31'),
            publishedDate: new Date('2025-01-01'),
          },
          {
            id: 'offer2',
            lenderUserId: 'lender2',
            principalCurrency: 'USDC' as const,
            availablePrincipalAmount: '150000',
            minLoanPrincipalAmount: '20000',
            maxLoanPrincipalAmount: '300000',
            interestRate: 12.0,
            termInMonthsOptions: [24],
            expirationDate: new Date('2025-12-31'),
            publishedDate: new Date('2025-01-01'),
          },
        ],
        pagination: { page: 1, limit: 50, total: 2 },
      })),
    } as unknown as CryptogadaiRepository;

    const strategy = new EnhancedLoanMatcherStrategy(mockRepository);

    const application: MatchableLoanApplication = {
      id: 'app1',
      borrowerUserId: 'borrower1',
      principalAmount: '50000',
      maxInterestRate: 10.0,
      termInMonths: 24,
      collateralBlockchainKey: 'eip155:1',
      collateralTokenId: 'ETH',
      collateralDepositAmount: '25',
      principalBlockchainKey: 'eip155:1',
      principalTokenId: 'USDC',
      status: 'Approved',
      appliedDate: new Date(),
      expirationDate: new Date('2025-12-31'),
    };

    const result = await strategy.findCompatibleOffers(application, undefined, undefined, {
      maxInterestRate: 10.0,
    });

    // Should only return offer1 which has 8% rate (under 10% max)
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'offer1');
    assert.strictEqual(result[0].interestRate, 8.0);
  });
});
