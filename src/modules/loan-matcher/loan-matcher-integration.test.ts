import type { Job as BullMQJob, Queue } from 'bullmq';
import type { LoanMatchingWorkerData } from './loan-matcher.types';

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';

import { Test, type TestingModule } from '@nestjs/testing';

import { LoanMatcherProcessor } from './loan-matcher.processor';
import { LoanMatcherService } from './loan-matcher.service';
import { LoanMatcherQueueService } from './loan-matcher-queue.service';

interface MockQueue {
  add: ReturnType<typeof mock.fn>;
  close?: ReturnType<typeof mock.fn>;
}

interface MockLoanMatcherService {
  processLoanMatching: ReturnType<typeof mock.fn>;
}

interface MockLogger {
  log: ReturnType<typeof mock.fn>;
  warn: ReturnType<typeof mock.fn>;
  error: ReturnType<typeof mock.fn>;
}

interface JobOptions {
  priority?: number;
  attempts?: number;
  delay?: number;
}

// Using BullMQ Job type for consistency

describe('LoanMatcher Integration', () => {
  let queueService: LoanMatcherQueueService;
  let processor: LoanMatcherProcessor;
  let mockQueue: MockQueue;
  let mockLoanMatcherService: MockLoanMatcherService;

  beforeEach(async () => {
    // Mock BullMQ Queue
    mockQueue = {
      add: mock.fn((name: string, data: unknown, options: JobOptions) =>
        Promise.resolve({
          id: 'job-123',
          name,
          data,
          opts: options,
        }),
      ),
    };

    // Mock LoanMatcherService
    mockLoanMatcherService = {
      processLoanMatching: mock.fn(() =>
        Promise.resolve({
          processedApplications: 5,
          processedOffers: 8,
          matchedPairs: 2,
          errors: [],
          matchedLoans: [
            {
              loanApplicationId: 'app1',
              loanOfferId: 'offer1',
              borrowerUserId: 'borrower1',
              lenderUserId: 'lender1',
              principalAmount: '10000',
              interestRate: 8.5,
              termInMonths: 12,
              collateralValuationAmount: '15000',
              ltvRatio: 66.67,
              matchedDate: new Date('2025-09-24'),
            },
            {
              loanApplicationId: 'app2',
              loanOfferId: 'offer2',
              borrowerUserId: 'borrower2',
              lenderUserId: 'lender2',
              principalAmount: '25000',
              interestRate: 9.0,
              termInMonths: 24,
              collateralValuationAmount: '40000',
              ltvRatio: 62.5,
              matchedDate: new Date('2025-09-24'),
            },
          ],
          hasMore: false,
        }),
      ),
    };

    queueService = new LoanMatcherQueueService(mockQueue as unknown as Queue);
    processor = new LoanMatcherProcessor(mockLoanMatcherService as unknown as LoanMatcherService);

    // Mock processor logger to reduce noise
    Object.defineProperty(processor, 'logger', {
      value: {
        log: mock.fn(),
        warn: mock.fn(),
        error: mock.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  describe('LoanMatcherQueueService', () => {
    it('should queue loan matching job with default options', async () => {
      const data = {
        batchSize: 25,
        asOfDate: '2025-09-24T10:00:00.000Z',
      };

      await queueService.queueLoanMatching(data);

      assert.equal(mockQueue.add.mock.callCount(), 1);
      const call = mockQueue.add.mock.calls[0];
      assert.equal(call.arguments[0], 'loan-matching');
      assert.deepEqual(call.arguments[1], data);
      assert.equal((call.arguments[2] as JobOptions).priority, 10);
      assert.equal((call.arguments[2] as JobOptions).attempts, 3);
    });

    it('should queue loan matching job with custom options', async () => {
      const data = {
        criteria: {
          duration: 12,
          interest: 8.5,
          principalAmount: '10000',
        },
        batchSize: 50,
      };

      const options = {
        priority: 5,
        delay: 1000,
        attempts: 5,
      };

      await queueService.queueLoanMatching(data, options);

      assert.equal(mockQueue.add.mock.callCount(), 1);
      const call = mockQueue.add.mock.calls[0];
      assert.equal((call.arguments[2] as JobOptions).priority, 5);
      assert.equal((call.arguments[2] as JobOptions).delay, 1000);
      assert.equal((call.arguments[2] as JobOptions).attempts, 5);
    });

    it('should queue loan matching with lender criteria', async () => {
      const criteria = {
        durationOptions: [24],
        fixedInterestRate: 7.0,
        minPrincipalAmount: '15000',
        maxPrincipalAmount: '15000',
      };

      await queueService.queueLoanMatchingWithLenderCriteria(criteria);

      assert.equal(mockQueue.add.mock.callCount(), 1);
      const call = mockQueue.add.mock.calls[0];
      const jobData = call.arguments[1] as LoanMatchingWorkerData;

      assert.equal(jobData.lenderCriteria!.durationOptions![0], 24);
      assert.equal(jobData.lenderCriteria!.fixedInterestRate, 7.0);
      assert.equal(jobData.lenderCriteria!.minPrincipalAmount, '15000');
      assert.equal(jobData.lenderCriteria!.maxPrincipalAmount, '15000');
      assert.equal(jobData.batchSize, 50);
    });

    it('should handle queue errors', async () => {
      mockQueue.add = mock.fn(() => Promise.reject(new Error('Redis connection failed')));

      await assert.rejects(() => queueService.queueLoanMatching({ batchSize: 10 }), {
        message: 'Redis connection failed',
      });
    });
  });

  describe('LoanMatcherProcessor', () => {
    it('should process loan matching job successfully', async () => {
      const job = {
        id: 'job-123',
        name: 'process-loan-matching',
        data: {
          batchSize: 25,
          asOfDate: '2025-09-24T10:00:00.000Z',
        },
      };

      await processor.process(job as BullMQJob<LoanMatchingWorkerData>);

      assert.equal(mockLoanMatcherService.processLoanMatching.mock.callCount(), 1);
      const call = mockLoanMatcherService.processLoanMatching.mock.calls[0];
      assert.deepEqual(call.arguments[0], job.data);
    });

    it('should handle processing errors', async () => {
      mockLoanMatcherService.processLoanMatching = mock.fn(() =>
        Promise.reject(new Error('Database timeout')),
      );

      const job = {
        id: 'job-456',
        name: 'process-loan-matching',
        data: { batchSize: 10 },
      };

      await assert.rejects(() => processor.process(job as BullMQJob<LoanMatchingWorkerData>), {
        message: 'Database timeout',
      });

      assert.equal(mockLoanMatcherService.processLoanMatching.mock.callCount(), 1);
    });

    it('should log warnings for jobs with errors', async () => {
      mockLoanMatcherService.processLoanMatching = mock.fn(() =>
        Promise.resolve({
          processedApplications: 3,
          processedOffers: 5,
          matchedPairs: 1,
          errors: ['Application app1 validation failed', 'Offer offer2 expired'],
          matchedLoans: [],
          hasMore: false,
        }),
      );

      const job = {
        id: 'job-789',
        data: { batchSize: 10 },
      } as BullMQJob<LoanMatchingWorkerData>;

      await processor.process(job);

      // Verify that warnings were logged for errors
      const logger = (processor as unknown as { logger: MockLogger }).logger;
      assert.equal(logger.warn.mock.callCount(), 1);
      const warnCall = logger.warn.mock.calls[0];
      assert.ok((warnCall.arguments[0] as string).includes('2 errors'));
    });
  });

  describe('End-to-End Integration', () => {
    it('should queue and process loan matching end-to-end', async () => {
      // Step 1: Queue a job
      const matchingData = {
        criteria: {
          duration: 18,
          interest: 8.0,
          principalAmount: '20000',
        },
        batchSize: 30,
      };

      await queueService.queueLoanMatching(matchingData);

      // Verify job was queued
      assert.equal(mockQueue.add.mock.callCount(), 1);
      const queueCall = mockQueue.add.mock.calls[0];
      assert.equal(queueCall.arguments[0], 'loan-matching');

      // Step 2: Simulate processing the job
      const job = {
        id: 'integration-job',
        data: matchingData,
      } as BullMQJob<LoanMatchingWorkerData>;

      await processor.process(job);

      // Verify processing was called
      assert.equal(mockLoanMatcherService.processLoanMatching.mock.callCount(), 1);
      const processCall = mockLoanMatcherService.processLoanMatching.mock.calls[0];
      assert.deepEqual(processCall.arguments[0], matchingData);
    });

    it('should handle high-priority urgent matching', async () => {
      const urgentData = {
        criteria: {
          duration: 6,
          interest: 12.0,
          principalAmount: '5000',
        },
        batchSize: 10,
      };

      const urgentOptions = {
        priority: 1, // High priority
        delay: 0, // No delay
        attempts: 1, // Single attempt for urgent processing
      };

      await queueService.queueLoanMatching(urgentData, urgentOptions);

      const call = mockQueue.add.mock.calls[0];
      assert.equal((call.arguments[2] as JobOptions).priority, 1);
      assert.equal((call.arguments[2] as JobOptions).delay, 0);
      assert.equal((call.arguments[2] as JobOptions).attempts, 1);
    });

    it('should handle batch processing of multiple loan types', async () => {
      // Queue multiple different loan matching jobs
      const jobs = [
        {
          criteria: { duration: 12, interest: 8.0, principalAmount: '10000' },
          batchSize: 20,
        },
        {
          criteria: { duration: 24, interest: 6.5, principalAmount: '50000' },
          batchSize: 15,
        },
        {
          criteria: { duration: 6, interest: 10.0, principalAmount: '5000' },
          batchSize: 25,
        },
      ];

      for (const jobData of jobs) {
        await queueService.queueLoanMatching(jobData);
      }

      assert.equal(mockQueue.add.mock.callCount(), 3);

      // Process each job
      for (let i = 0; i < jobs.length; i++) {
        const job = {
          id: `batch-job-${i}`,
          data: jobs[i],
        } as BullMQJob<LoanMatchingWorkerData>;
        await processor.process(job);
      }

      assert.equal(mockLoanMatcherService.processLoanMatching.mock.callCount(), 3);
    });
  });
});
