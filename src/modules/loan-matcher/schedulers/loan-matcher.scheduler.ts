import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { LoanMatcherService } from '../services/loan-matcher.service';
import { defaultLoanMatcherConfig } from '../types/loan-matcher.config';

/**
 * Loan Matcher Scheduler
 * Runs loan matching process every hour (configurable via LOAN_MATCHER_CRON_SCHEDULE)
 * Matches available loan applications with compatible loan offers
 *
 * Environment Variables:
 * - LOAN_MATCHER_SCHEDULER_ENABLED: Enable/disable scheduler (default: true)
 * - LOAN_MATCHER_CRON_SCHEDULE: Cron schedule (default: "0 * * * *")
 * - LOAN_MATCHER_RUN_ON_INIT: Run on module init (default: false)
 * - LOAN_MATCHER_BATCH_SIZE: Batch size (default: 50)
 */
@Injectable()
export class LoanMatcherScheduler implements OnModuleInit {
  private readonly logger = new Logger(LoanMatcherScheduler.name);

  constructor(
    private readonly loanMatcherService: LoanMatcherService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService.get<boolean>(
      'LOAN_MATCHER_SCHEDULER_ENABLED',
      defaultLoanMatcherConfig.schedulerEnabled,
    );

    if (!isEnabled) {
      this.logger.debug('Loan matcher scheduler is disabled, skipping initialization');
      return;
    }

    const cronSchedule = this.configService.get<string>(
      'LOAN_MATCHER_CRON_SCHEDULE',
      defaultLoanMatcherConfig.cronSchedule,
    );

    this.logger.log('Loan matcher scheduler initialized');
    this.logger.log(`Scheduled to run at: ${cronSchedule}`);

    // Run initial matching on module init if configured
    const runOnInit = this.configService.get<boolean>(
      'LOAN_MATCHER_RUN_ON_INIT',
      defaultLoanMatcherConfig.runOnInit,
    );

    if (runOnInit) {
      this.logger.log('Running initial loan matching on module init');
      // Run async without blocking module initialization
      this.executeLoanMatching(new Date())
        .then(result => {
          this.logger.log(
            `Initial loan matching completed: ${result.matchedPairs} matches created from ${result.processedApplications} applications`,
          );
        })
        .catch(error => {
          this.logger.error('Initial loan matching failed:', error);
        });
    }
  }

  /**
   * Cron job that runs at the top of every hour
   * Schedule: "0 * * * *" means:
   * - 0 minutes
   * - every hour
   * - every day of month
   * - every month
   * - every day of week
   */
  @Cron('0 * * * *', {
    name: 'loan-matcher-hourly',
    timeZone: 'UTC',
  })
  async handleLoanMatchingCron() {
    const isEnabled = this.configService.get<boolean>(
      'LOAN_MATCHER_SCHEDULER_ENABLED',
      defaultLoanMatcherConfig.schedulerEnabled,
    );

    if (!isEnabled) {
      this.logger.debug('Loan matcher scheduler is disabled');
      return;
    }

    this.logger.log('Starting scheduled loan matching');

    const matchedDate = new Date();

    try {
      const result = await this.executeLoanMatching(matchedDate);

      this.logger.log(
        `Scheduled loan matching completed: ${result.matchedPairs} matches created from ` +
          `${result.processedApplications} applications and ${result.processedOffers} offers`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          `Encountered ${result.errors.length} errors during matching:`,
          result.errors,
        );
      }
    } catch (error) {
      this.logger.error('Scheduled loan matching failed:', error);
      // Don't throw - we want the scheduler to continue running
    }
  }

  /**
   * Execute loan matching for the given date
   * @param matchedDate The date to use for matching
   */
  private async executeLoanMatching(matchedDate: Date) {
    this.logger.log(`Executing loan matching as of ${matchedDate.toISOString()}`);

    const batchSize = this.configService.get<number>(
      'LOAN_MATCHER_BATCH_SIZE',
      defaultLoanMatcherConfig.batchSize,
    );

    const result = await this.loanMatcherService.processLoanMatching({
      asOfDate: matchedDate.toISOString(),
      batchSize,
    });

    return result;
  }

  /**
   * Manual trigger for testing purposes
   * Can be called via admin API or CLI
   * @param matchedDate Optional date to use for matching (defaults to now)
   */
  async triggerManualMatching(matchedDate?: Date) {
    const date = matchedDate || new Date();
    this.logger.log(`🔧 Manual loan matching triggered for ${date.toISOString()}`);

    try {
      const result = await this.executeLoanMatching(date);
      this.logger.log(
        `Manual loan matching completed: ${result.matchedPairs} matches from ${result.processedApplications} applications`,
      );
      return result;
    } catch (error) {
      this.logger.error('Manual loan matching failed:', error);
      throw error;
    }
  }
}
