import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { WalletModule } from '../../shared/wallets/wallet.module';
import { BinanceAssetMapperService } from './binance-asset-mapper.service';
import { BinanceClientService } from './binance-client.service';
import { SettlementWalletService } from './currencies/wallet.service';
import { SettlementController } from './settlement.controller';
import { SettlementScheduler } from './settlement.scheduler';
import { SettlementService } from './settlement.service';

/**
 * Settlement Admin Module
 *
 * Provides admin API endpoints for manual settlement triggers
 * This module is imported by user-api.module.ts to expose settlement admin endpoints
 */
@Module({
  imports: [ConfigModule, RepositoryModule, WalletModule],
  controllers: [SettlementController],
  providers: [
    SettlementService,
    SettlementScheduler,
    SettlementWalletService,
    BinanceClientService,
    BinanceAssetMapperService,
  ],
  exports: [SettlementService, SettlementScheduler, SettlementWalletService],
})
export class SettlementAdminModule {}
