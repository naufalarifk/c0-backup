import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import {
  BlockchainController,
  CurrencyController,
  ExchangeRateController,
} from './finance-config.controller';
import { FinanceConfigService } from './finance-config.service';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [BlockchainController, CurrencyController, ExchangeRateController],
  providers: [FinanceConfigService],
  exports: [FinanceConfigService],
})
export class FinanceConfigModule {}
