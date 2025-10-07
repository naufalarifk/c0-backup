import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { SettlementService } from './settlement.service';
import { defaultSettlementConfig } from './settlement.types';

/**
 * Settlement Scheduler
 * Runs settlement process at midnight (00:00 AM) every day
 * Transfers 50% of blockchain balances to Binance network
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
      'SETTLEMENT_ENABLED',
      defaultSettlementConfig.enabled,
    );

    if (!isEnabled) {
      this.logger.debug('Settlement scheduler is disabled, skipping initialization');
      return;
    }

    this.logger.log('Settlement scheduler initialized');
    this.logger.log(`Scheduled to run at: ${defaultSettlementConfig.cronSchedule} (midnight)`);
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
      'SETTLEMENT_ENABLED',
      defaultSettlementConfig.enabled,
    );

    if (!isEnabled) {
      this.logger.debug('Settlement scheduler is disabled');
      return;
    }

    this.logger.log('⏰ Scheduled settlement triggered at midnight');

    try {
      const results = await this.settlementService.executeSettlement();

      const successCount = results.filter(r => r.success).length;
      const totalAmount = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + Number.parseFloat(r.settlementAmount), 0);

      this.logger.log(
        `✅ Scheduled settlement completed: ${successCount}/${results.length} succeeded, ` +
          `Total transferred: ${totalAmount.toFixed(2)}`,
      );
    } catch (error) {
      this.logger.error('❌ Scheduled settlement failed:', error);
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
