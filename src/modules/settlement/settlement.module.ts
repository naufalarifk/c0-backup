import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { WalletModule } from '../../shared/wallets/wallet.module';
import { SettlementScheduler } from './settlement.scheduler';
import { SettlementService } from './settlement.service';

/**
 * Settlement Module
 *
 * Handles automated settlement of blockchain balances to Binance network
 * Runs daily at midnight (00:00 AM) via cron job
 * Transfers 50% of current blockchain balances
 *
 * Features:
 * - Automated daily settlement via cron scheduler
 * - Configurable settlement percentage and target network
 * - Audit trail logging to settlement_logs table
 * - Manual settlement trigger for testing
 * - Actual blockchain transfers using WalletService
 *
 * Environment Variables:
 * - SETTLEMENT_ENABLED: Enable/disable settlement scheduler (default: true)
 * - SETTLEMENT_PERCENTAGE: Percentage of balance to settle (default: 50)
 * - SETTLEMENT_TARGET_NETWORK: Target blockchain network (default: eip155:56 for BSC)
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Required for @Cron decorators
    RepositoryModule,
    WalletModule,
  ],
  providers: [SettlementService, SettlementScheduler],
  exports: [SettlementService],
})
export class SettlementModule {}
