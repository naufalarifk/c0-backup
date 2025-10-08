import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { WalletModule } from '../../shared/wallets/wallet.module';
import { BinanceAssetMapperService } from './binance-asset-mapper.service';
import { BinanceClientService } from './binance-client.service';
import { SettlementScheduler } from './settlement.scheduler';
import { SettlementService } from './settlement.service';

/**
 * Settlement Module
 *
 * Handles automated settlement of blockchain balances with Binance Exchange
 * Runs daily at midnight (00:00 AM) via cron job
 * Maintains configured ratio between hot wallets and Binance
 *
 * Features:
 * - Automated daily settlement via cron scheduler
 * - Binance Exchange API integration for deposits/withdrawals
 * - Configurable settlement percentage and target network
 * - Audit trail logging to settlement_logs table
 * - Manual settlement trigger for testing
 * - Actual blockchain transfers using WalletService
 * - Asset mapping between blockchain tokens and Binance assets
 *
 * Environment Variables:
 * - SETTLEMENT_ENABLED: Enable/disable settlement scheduler (default: true)
 * - SETTLEMENT_PERCENTAGE: Percentage of balance to settle (default: 50)
 * - SETTLEMENT_TARGET_NETWORK: Target blockchain network (default: eip155:56 for BSC)
 * - BINANCE_API_ENABLED: Enable Binance API integration (default: false)
 * - BINANCE_API_KEY: Binance API key for authentication
 * - BINANCE_API_SECRET: Binance API secret for HMAC signature
 * - BINANCE_API_BASE_URL: Binance API base URL (default: https://api.binance.com)
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Required for @Cron decorators
    RepositoryModule,
    WalletModule,
  ],
  providers: [
    SettlementService,
    SettlementScheduler,
    BinanceClientService,
    BinanceAssetMapperService,
  ],
  exports: [SettlementService, BinanceClientService],
})
export class SettlementModule {}
