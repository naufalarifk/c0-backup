import type { Job } from 'bullmq';
import type { LoanMatchingWorkerData } from './loan-matcher.types';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { LoanMatcherService } from './loan-matcher.service';

@Processor('loanMatcherQueue')
export class LoanMatcherProcessor extends WorkerHost {
  private readonly logger = new Logger(LoanMatcherProcessor.name);

  constructor(private readonly loanMatcherService: LoanMatcherService) {
    super();
  }

  async process(job: Job<LoanMatchingWorkerData>): Promise<void> {
    this.logger.log(`Processing loan matcher job ${job.id}`);

    try {
      const result = await this.loanMatcherService.processLoanMatching(job.data);

      this.logger.log(
        `Loan matcher job ${job.id} completed: ${result.matchedPairs} matches created ` +
          `from ${result.processedApplications} applications and ${result.processedOffers} offers`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          `Job ${job.id} completed with ${result.errors.length} errors: ${result.errors.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.error(`Loan matcher job ${job.id} failed:`, error);
      throw error;
    }
  }
}
