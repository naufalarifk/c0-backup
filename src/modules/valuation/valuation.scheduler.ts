import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ValuationService } from './valuation.service';
import { ValuationEventService } from './valuation-event.service';

@Injectable()
export class ValuationScheduler {
  private readonly logger = new Logger(ValuationScheduler.name);

  constructor(
    private readonly valuationService: ValuationService,
    private readonly valuationEventService: ValuationEventService,
  ) {}

  /**
   * Check for loans maturing in 3 days - runs daily at 9:00 AM
   * Based on SRS-CG-v2.4-EN.md RF-014: Time-Based Warnings
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkMaturityD3(): Promise<void> {
    await this.processMaturityReminders(3);
  }

  /**
   * Check for loans maturing in 2 days - runs daily at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkMaturityD2(): Promise<void> {
    await this.processMaturityReminders(2);
  }

  /**
   * Check for loans maturing in 1 day - runs daily at 9:00 AM and 6:00 PM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkMaturityD1Morning(): Promise<void> {
    await this.processMaturityReminders(1);
  }

  @Cron('0 18 * * *') // 6:00 PM daily
  async checkMaturityD1Evening(): Promise<void> {
    await this.processMaturityReminders(1);
  }

  /**
   * Check for loans maturing today - runs every 4 hours
   */
  @Cron(CronExpression.EVERY_4_HOURS)
  async checkMaturityD0(): Promise<void> {
    await this.processMaturityReminders(0);
  }

  /**
   * Process maturity reminders for loans approaching maturity
   */
  private async processMaturityReminders(daysUntilMaturity: number): Promise<void> {
    try {
      this.logger.log(`Checking for loans maturing in ${daysUntilMaturity} days`);

      const loans = await this.valuationService.getLoansApproachingMaturity(daysUntilMaturity);

      if (loans.length === 0) {
        this.logger.log(`No loans found maturing in ${daysUntilMaturity} days`);
        return;
      }

      this.logger.log(`Found ${loans.length} loans maturing in ${daysUntilMaturity} days`);

      for (const loan of loans) {
        try {
          await this.valuationEventService.emitMaturityReminder(loan, daysUntilMaturity);
        } catch (error) {
          this.logger.error(
            `Failed to emit maturity reminder for loan ${loan.loanId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this.logger.log(
        `Completed processing ${loans.length} maturity reminders for D-${daysUntilMaturity}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process maturity reminders for D-${daysUntilMaturity}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
