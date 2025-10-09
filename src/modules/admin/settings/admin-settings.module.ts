import { Module } from '@nestjs/common';

import { AdminCurrenciesController } from './admin-currencies.controller';
import { AdminCurrenciesService } from './admin-currencies.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';

@Module({
  controllers: [AdminSettingsController, AdminCurrenciesController],
  providers: [AdminSettingsService, AdminCurrenciesService],
})
export class AdminSettingsModule {}
