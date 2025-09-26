import type { Queue } from 'bullmq';
import type { LoanMatchingWorkerData } from './loan-matcher.types';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

export interface QueueLoanMatchingOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

@Injectable()
export class LoanMatcherQueueService {
  private readonly logger = new Logger(LoanMatcherQueueService.name);

  constructor(
    @InjectQueue('loanMatcherQueue')
    private readonly loanMatcherQueue: Queue<LoanMatchingWorkerData>,
  ) {}

  async queueLoanMatching(
    data: LoanMatchingWorkerData,
    options: QueueLoanMatchingOptions = {},
  ): Promise<void> {
    try {
      const job = await this.loanMatcherQueue.add('loan-matching', data, {
        priority: options.priority ?? 10,
        delay: options.delay ?? 0,
        attempts: options.attempts ?? 3,
        backoff: options.backoff ?? {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      this.logger.log(`Queued loan matching job with ID: ${job.id}`);
    } catch (error) {
      this.logger.error('Failed to queue loan matching job:', error);
      throw error;
    }
  }

  /**
   * Queue matching with enhanced lender criteria
   * Supports multiple duration options, fixed interest rates, and min/max principal amounts
   */
  async queueLoanMatchingWithLenderCriteria(
    criteria: {
      // Lender rule 1: Multiple duration choices
      durationOptions?: number[]; // e.g., [12, 24, 36] months

      // Lender rule 2: Fixed interest rate
      fixedInterestRate?: number; // e.g., 8.5%

      // Lender rule 3: Principal amount range
      minPrincipalAmount?: string; // e.g., "1000"
      maxPrincipalAmount?: string; // e.g., "100000"

      // Additional filtering
      collateralType?: string;
      principalCurrency?: string;
    },
    options: QueueLoanMatchingOptions = {},
  ): Promise<void> {
    const data: LoanMatchingWorkerData = {
      lenderCriteria: {
        durationOptions: criteria.durationOptions || [],
        fixedInterestRate: criteria.fixedInterestRate,
        minPrincipalAmount: criteria.minPrincipalAmount,
        maxPrincipalAmount: criteria.maxPrincipalAmount,
        collateralType: criteria.collateralType,
        principalCurrency: criteria.principalCurrency,
      },
      batchSize: 50,
      asOfDate: new Date().toISOString(),
    };

    await this.queueLoanMatching(data, options);
  }

  /**
   * Queue matching with enhanced borrower criteria
   * Supports fixed duration, fixed principal amount, max interest rate, and institutional lender preference
   */
  async queueLoanMatchingWithBorrowerCriteria(
    criteria: {
      // Borrower rule 1: Fixed duration requirement
      fixedDuration?: number; // e.g., 24 - exact term requirement

      // Borrower rule 2: Fixed principal amount requirement
      fixedPrincipalAmount?: string; // e.g., "50000" - exact amount requirement

      // Borrower rule 3: Maximum acceptable interest rate
      maxInterestRate?: number; // e.g., 8.0 - won't accept higher rates

      // Borrower preference: Prioritize institutional lenders
      preferInstitutionalLenders?: boolean; // true - prioritize institutions over individuals

      // Additional borrower preferences
      collateralType?: string;
      principalCurrency?: string;
    },
    options: QueueLoanMatchingOptions = {},
  ): Promise<void> {
    const data: LoanMatchingWorkerData = {
      borrowerCriteria: {
        fixedDuration: criteria.fixedDuration,
        fixedPrincipalAmount: criteria.fixedPrincipalAmount,
        maxInterestRate: criteria.maxInterestRate,
        preferInstitutionalLenders: criteria.preferInstitutionalLenders,
        collateralType: criteria.collateralType,
        principalCurrency: criteria.principalCurrency,
      },
      batchSize: 50,
      asOfDate: new Date().toISOString(),
    };

    await this.queueLoanMatching(data, options);
  }

  /**
   * Queue matching with both lender and borrower criteria
   * Provides comprehensive matching with all enhanced rules
   */
  async queueLoanMatchingWithCombinedCriteria(
    criteria: {
      lender?: {
        durationOptions?: number[];
        fixedInterestRate?: number;
        minPrincipalAmount?: string;
        maxPrincipalAmount?: string;
        collateralType?: string;
        principalCurrency?: string;
      };
      borrower?: {
        fixedDuration?: number;
        fixedPrincipalAmount?: string;
        maxInterestRate?: number;
        preferInstitutionalLenders?: boolean;
        collateralType?: string;
        principalCurrency?: string;
      };
    },
    options: QueueLoanMatchingOptions = {},
  ): Promise<void> {
    const data: LoanMatchingWorkerData = {
      lenderCriteria: criteria.lender
        ? {
            durationOptions: criteria.lender.durationOptions || [],
            fixedInterestRate: criteria.lender.fixedInterestRate,
            minPrincipalAmount: criteria.lender.minPrincipalAmount,
            maxPrincipalAmount: criteria.lender.maxPrincipalAmount,
            collateralType: criteria.lender.collateralType,
            principalCurrency: criteria.lender.principalCurrency,
          }
        : undefined,
      borrowerCriteria: criteria.borrower
        ? {
            fixedDuration: criteria.borrower.fixedDuration,
            fixedPrincipalAmount: criteria.borrower.fixedPrincipalAmount,
            maxInterestRate: criteria.borrower.maxInterestRate,
            preferInstitutionalLenders: criteria.borrower.preferInstitutionalLenders,
            collateralType: criteria.borrower.collateralType,
            principalCurrency: criteria.borrower.principalCurrency,
          }
        : undefined,
      batchSize: 50,
      asOfDate: new Date().toISOString(),
    };

    await this.queueLoanMatching(data, options);
  }

  /**
   * Queue immediate loan matching for new loan application
   * This triggers matching as soon as a new application is published
   */
  async queueMatchingForNewApplication(
    applicationId: string,
    options: QueueLoanMatchingOptions = {},
  ): Promise<void> {
    this.logger.log(`Queuing immediate matching for new application: ${applicationId}`);

    await this.queueLoanMatching(
      {
        batchSize: 10, // Smaller batch for immediate processing
        targetApplicationId: applicationId, // Focus on specific application
        asOfDate: new Date().toISOString(),
      },
      {
        priority: 1, // High priority for new applications
        delay: 0, // Process immediately
        ...options,
      },
    );
  }

  /**
   * Queue immediate loan matching for new loan offer
   * This triggers matching as soon as a new offer is published
   */
  async queueMatchingForNewOffer(
    offerId: string,
    options: QueueLoanMatchingOptions = {},
  ): Promise<void> {
    this.logger.log(`Queuing immediate matching for new offer: ${offerId}`);

    await this.queueLoanMatching(
      {
        batchSize: 50, // Check multiple applications against this offer
        targetOfferId: offerId, // Focus on specific offer
        asOfDate: new Date().toISOString(),
      },
      {
        priority: 2, // High priority for new offers
        delay: 0, // Process immediately
        ...options,
      },
    );
  }

  /**
   * Queue periodic matching sweep
   * This can be triggered by external schedulers or manual requests
   */
  async queuePeriodicMatching(
    batchSize = 100,
    options: QueueLoanMatchingOptions = {},
  ): Promise<void> {
    this.logger.log(`Queuing periodic matching sweep with batch size: ${batchSize}`);

    await this.queueLoanMatching(
      {
        batchSize,
        asOfDate: new Date().toISOString(),
      },
      {
        priority: 5, // Lower priority for batch processing
        ...options,
      },
    );
  }
}
