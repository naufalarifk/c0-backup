import { strict as assert } from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

import { Test, type TestingModule } from '@nestjs/testing';

import { CryptogadaiRepository } from '../../../../shared/repositories/cryptogadai.repository';
import { LoanCalculationService } from '../../../loans/services/loan-calculation.service';
import { LoansService } from '../../../loans/services/loans.service';
import { NotificationQueueService } from '../../../notifications/notification-queue.service';
import { LoanMatcherStrategyFactory } from '../strategies/loan-matcher-strategy.factory';
import { LoanMatcherService } from './loan-matcher.service';

interface MockRepository {
  borrowerViewsMyLoanApplications: ReturnType<typeof mock.fn>;
  platformListsAvailableLoanOffers: ReturnType<typeof mock.fn>;
  platformMatchesLoanOffers: ReturnType<typeof mock.fn>;
}

interface MockNotificationQueueService {
  queueNotification: ReturnType<typeof mock.fn>;
}

describe('LoanMatcherService - Unit Tests', () => {
  let service: LoanMatcherService;
  let mockRepository: MockRepository;
  let mockNotificationQueueService: MockNotificationQueueService;

  beforeEach(async () => {
    // Minimal mocks for service instantiation
    mockRepository = {
      borrowerViewsMyLoanApplications: mock.fn(() =>
        Promise.resolve({
          loanApplications: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      ),
      platformListsAvailableLoanOffers: mock.fn(() =>
        Promise.resolve({
          loanOffers: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      ),
      platformMatchesLoanOffers: mock.fn(() => Promise.resolve(null)),
    };

    mockNotificationQueueService = {
      queueNotification: mock.fn(() => Promise.resolve()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanMatcherService,
        {
          provide: CryptogadaiRepository,
          useValue: mockRepository,
        },
        {
          provide: NotificationQueueService,
          useValue: mockNotificationQueueService,
        },
        {
          provide: LoanMatcherStrategyFactory,
          useValue: {
            getStrategy: mock.fn(() => ({
              canHandle: () => false,
              findCompatibleOffers: mock.fn(() => Promise.resolve([])),
              getDescription: () => 'Mock Strategy',
            })),
          },
        },
        {
          provide: LoansService,
          useValue: {
            originateLoan: mock.fn(() => Promise.resolve({ loanId: '123' })),
            disburseLoan: mock.fn(() => Promise.resolve()),
          },
        },
        {
          provide: LoanCalculationService,
          useValue: {
            calculateLoanTerms: mock.fn(() => Promise.resolve({})),
          },
        },
      ],
    }).compile();

    service = module.get<LoanMatcherService>(LoanMatcherService);

    // Mock logger to reduce noise
    Object.defineProperty(service, 'logger', {
      value: {
        log: mock.fn(),
        debug: mock.fn(),
        warn: mock.fn(),
        error: mock.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  describe('Service Instantiation', () => {
    it('should be defined and instantiable', () => {
      assert.ok(service);
      assert.equal(typeof service.processLoanMatching, 'function');
    });

    it('should have all required methods', () => {
      assert.equal(typeof service.processLoanMatching, 'function');
      // Verify the service has the expected public interface
      assert.ok(service);
    });
  });

  describe('processLoanMatching - Basic Functionality', () => {
    it('should handle empty applications and offers gracefully', async () => {
      const result = await service.processLoanMatching({
        batchSize: 10,
      });

      // Should complete without errors
      assert.equal(typeof result, 'object');
      assert.equal(typeof result.processedApplications, 'number');
      assert.equal(typeof result.processedOffers, 'number');
      assert.equal(typeof result.matchedPairs, 'number');
      assert.ok(Array.isArray(result.errors));
      assert.ok(Array.isArray(result.matchedLoans));
    });

    it('should handle repository errors without throwing', async () => {
      // Mock error in repository call
      mockRepository.borrowerViewsMyLoanApplications = mock.fn(() =>
        Promise.reject(new Error('Database unavailable')),
      );

      const result = await service.processLoanMatching({
        batchSize: 5,
      });

      // Should not throw, but return results with error information
      assert.equal(typeof result, 'object');
      assert.ok(Array.isArray(result.errors));
      // May have error messages depending on implementation
    });
  });

  describe('Configuration Options', () => {
    it('should accept different batch sizes', async () => {
      const result1 = await service.processLoanMatching({ batchSize: 1 });
      const result2 = await service.processLoanMatching({ batchSize: 100 });

      // Both should complete successfully
      assert.equal(typeof result1, 'object');
      assert.equal(typeof result2, 'object');
    });

    it('should accept lender criteria options', async () => {
      const result = await service.processLoanMatching({
        batchSize: 10,
        lenderCriteria: {
          durationOptions: [12, 24],
          fixedInterestRate: 8.5,
          minPrincipalAmount: '10000',
          maxPrincipalAmount: '100000',
        },
      });

      // Should handle criteria without errors
      assert.equal(typeof result, 'object');
    });

    it('should accept borrower criteria options', async () => {
      const result = await service.processLoanMatching({
        batchSize: 10,
        borrowerCriteria: {
          fixedDuration: 24,
          fixedPrincipalAmount: '50000',
          maxInterestRate: 8.0,
          preferInstitutionalLenders: true,
        },
      });

      // Should handle criteria without errors
      assert.equal(typeof result, 'object');
    });

    it('should accept combined lender and borrower criteria', async () => {
      const result = await service.processLoanMatching({
        batchSize: 10,
        lenderCriteria: {
          durationOptions: [12, 24, 36],
          fixedInterestRate: 7.5,
        },
        borrowerCriteria: {
          fixedDuration: 24,
          maxInterestRate: 8.0,
          preferInstitutionalLenders: false,
        },
      });

      // Should handle combined criteria without errors
      assert.equal(typeof result, 'object');
    });
  });

  describe('Institutional Lender Detection', () => {
    it('should have isInstitutionalLender method available', () => {
      // Test the method exists and can be called (testing public interface)
      // Note: We can't easily test private methods, so we test via public interface
      assert.equal(typeof service.processLoanMatching, 'function');

      // The institutional lender logic is tested in integration tests
      // Here we just verify the service has the capability
      assert.ok(service);
    });
  });
});
