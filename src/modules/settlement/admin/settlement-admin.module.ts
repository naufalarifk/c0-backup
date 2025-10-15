import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RepositoryModule } from '../../../shared/repositories/repository.module';
import { WalletModule } from '../../../shared/wallets/wallet.module';
import { SettlementController } from '../controllers/settlement.controller';
import { SettlementScheduler } from '../schedulers/settlement.scheduler';
import { BinanceAssetMapperService } from '../services/binance/binance-asset-mapper.service';
import { BinanceClientService } from '../services/binance/binance-client.service';
import { BinanceDepositVerificationService } from '../services/binance/binance-deposit-verification.service';
import { SolService } from '../services/blockchain/sol.service';
import { SettlementService } from '../services/core/settlement.service';
import { SettlementAlertService } from '../services/core/settlement-alert.service';
import { TransactionMatchingService } from '../services/matching/transaction-matching.service';

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
    BinanceClientService,
    BinanceAssetMapperService,
    BinanceDepositVerificationService,
    TransactionMatchingService,
    SettlementAlertService,
    SolService,
  ],
  exports: [SettlementService, SettlementScheduler],
})
export class SettlementAdminModule {}
