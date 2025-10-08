import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { defaultSettlementConfig } from './settlement.config';
import { SettlementService } from './settlement.service';

/**
 * Settlement Scheduler
 * Runs settlement process at midnight (00:00 AM) every day
 * Transfers balances between hot wallets and Binance based on configured ratio
 */
@Injectable()
export class SettlementScheduler implements OnModuleInit {
  private readonly logger = new Logger(SettlementScheduler.name);

  constructor(
    private readonly settlementService: SettlementService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService.get<boolean>(
      'SETTLEMENT_SCHEDULER_ENABLED',
      defaultSettlementConfig.schedulerEnabled,
    );

    if (!isEnabled) {
      this.logger.debug('Settlement scheduler is disabled, skipping initialization');
      return;
    }

    const cronSchedule = this.configService.get<string>(
      'SETTLEMENT_CRON_SCHEDULE',
      defaultSettlementConfig.cronSchedule,
    );

    this.logger.log('Settlement scheduler initialized');
    this.logger.log(`Scheduled to run at: ${cronSchedule}`);

    // Run initial settlement on module init if configured
    const runOnInit = this.configService.get<boolean>(
      'SETTLEMENT_RUN_ON_INIT',
      defaultSettlementConfig.runOnInit,
    );

    if (runOnInit) {
      this.logger.log('Running initial settlement on module init');
      // Run async without blocking module initialization
      this.settlementService
        .executeSettlement()
        .then(results => {
          const successCount = results.filter(r => r.success).length;
          this.logger.log(
            `Initial settlement completed: ${successCount}/${results.length} succeeded`,
          );
        })
        .catch(error => {
          this.logger.error('Initial settlement failed:', error);
        });
    }
  }

  /**
   * Cron job that runs at midnight (00:00 AM) every day
   * Schedule: "0 0 * * *" means:
   * - 0 minutes
   * - 0 hours (midnight)
   * - every day of month
   * - every month
   * - every day of week
   */
  @Cron('0 0 * * *', {
    name: 'settlement-daily',
    timeZone: 'UTC',
  })
  async handleSettlementCron() {
    const isEnabled = this.configService.get<boolean>(
      'SETTLEMENT_SCHEDULER_ENABLED',
      defaultSettlementConfig.schedulerEnabled,
    );

    if (!isEnabled) {
      this.logger.debug('Settlement scheduler is disabled');
      return;
    }

    this.logger.log('Starting scheduled settlement');

    try {
      const results = await this.settlementService.executeSettlement();

      const successCount = results.filter(r => r.success).length;
      const totalAmount = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + Number.parseFloat(r.settlementAmount), 0);

      this.logger.log(
        `Scheduled settlement completed successfully: ${successCount}/${results.length} succeeded, ` +
          `Total transferred: ${totalAmount.toFixed(2)}`,
      );
    } catch (error) {
      this.logger.error('Scheduled settlement failed:', error);
      // Don't throw - we want the scheduler to continue running
    }
  }

  /**
   * Manual trigger for testing purposes
   * Can be called via admin API or CLI
   */
  async triggerManualSettlement() {
    this.logger.log('🔧 Manual settlement triggered');

    try {
      const results = await this.settlementService.executeSettlement();
      this.logger.log(`Manual settlement completed: ${results.length} processed`);
      return results;
    } catch (error) {
      this.logger.error('Manual settlement failed:', error);
      throw error;
    }
  }
}
