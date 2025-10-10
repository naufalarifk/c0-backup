import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { WalletModule } from '../../shared/wallets/wallet.module';
import { BinanceAssetMapperService } from './binance-asset-mapper.service';
import { BinanceClientService } from './binance-client.service';
import { SolService } from './currencies/sol.service';
import { SettlementWalletService } from './currencies/wallet.service';
import { SettlementScheduler } from './settlement.scheduler';
import { SettlementService } from './settlement.service';
import { SettlementTestController } from './settlement-test.controller';

/**
 * Settlement Worker Module
 *
 * Handles automated settlement of blockchain balances with Binance Exchange
 * Runs daily at midnight (00:00 AM) via cron job
 * Maintains configured ratio between hot wallets and Binance
 *
 * This module is for the settlement worker process only.
 * For admin API endpoints, use SettlementAdminModule instead.
 *
 * Features:
 * - Automated daily settlement via cron scheduler
 * - Binance Exchange API integration for deposits/withdrawals
 * - Configurable settlement percentage and target network
 * - Audit trail logging to settlement_logs table
 * - Actual blockchain transfers using WalletService
 * - Asset mapping between blockchain tokens and Binance assets
 *
 * Environment Variables:
 * - SETTLEMENT_SCHEDULER_ENABLED: Enable/disable settlement scheduler (default: true)
 * - SETTLEMENT_CRON_SCHEDULE: Cron schedule for settlement (default: "0 0 * * *")
 * - SETTLEMENT_RUN_ON_INIT: Run settlement on module init (default: false)
 * - SETTLEMENT_TARGET_PERCENTAGE: Percentage of balance to settle (default: 50)
 * - SETTLEMENT_TARGET_NETWORK: Target blockchain network (default: eip155:56 for BSC)
 * - SETTLEMENT_MIN_AMOUNT: Minimum amount to settle (default: 0.01)
 * - BINANCE_API_ENABLED: Enable Binance API integration (default: false)
 * - BINANCE_API_KEY: Binance API key (production)
 * - BINANCE_API_SECRET: Binance API secret (production)
 * - BINANCE_TEST_API_KEY: Binance test API key (development)
 * - BINANCE_TEST_API_SECRET: Binance test API secret (development)
 * - BINANCE_API_BASE_URL: Binance API base URL (default: https://api.binance.com)
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Required for @Cron decorators
    WalletModule,
    RepositoryModule, // This depends on SharedModule which includes RedisService
  ],
  controllers: [SettlementTestController], // Test endpoints for E2E testing
  providers: [
    SettlementService,
    SettlementScheduler,
    SettlementWalletService,
    SolService, // Solana-specific service for SOL balance queries
    BinanceClientService,
    BinanceAssetMapperService,
  ],
  exports: [SettlementService, SettlementScheduler, SettlementWalletService, BinanceClientService],
})
export class SettlementModule {}
