import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { ValuationProcessor } from './valuation.processor';
import { ValuationScheduler } from './valuation.scheduler';
import { ValuationService } from './valuation.service';
import { ValuationEventService } from './valuation-event.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({
      name: 'valuationQueue',
    }),
    BullModule.registerQueue({
      name: 'notificationQueue',
    }),
    BullModule.registerQueue({
      name: 'liquidationQueue',
    }),
  ],
  providers: [ValuationService, ValuationEventService, ValuationProcessor, ValuationScheduler],
  exports: [ValuationService, ValuationEventService],
})
export class ValuationModule {}
