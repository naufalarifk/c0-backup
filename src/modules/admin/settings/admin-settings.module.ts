import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AdminCurrenciesController } from './admin-currencies.controller';
import { AdminCurrenciesService } from './admin-currencies.service';
import { AdminExchangeRatesController } from './admin-exchange-rates.controller';
import { AdminExchangeRatesService } from './admin-exchange-rates.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pricefeedQueue',
    }),
  ],
  controllers: [AdminSettingsController, AdminCurrenciesController, AdminExchangeRatesController],
  providers: [AdminSettingsService, AdminCurrenciesService, AdminExchangeRatesService],
})
export class AdminSettingsModule {}
