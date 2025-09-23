import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { SharedModule } from '../../shared/shared.module';
import { NotificationModule } from '../notifications/notification.module';
import { InvoiceExpirationProcessor } from './invoice-expiration.processor';
import { InvoiceExpirationService } from './invoice-expiration.service';
import { InvoiceExpirationQueueService } from './invoice-expiration-queue.service';

@Module({
  imports: [
    SharedModule,
    NotificationModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: 'invoiceExpirationQueue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      },
    }),
  ],
  providers: [InvoiceExpirationService, InvoiceExpirationQueueService, InvoiceExpirationProcessor],
  exports: [InvoiceExpirationService, InvoiceExpirationQueueService],
})
export class InvoiceExpirationModule {}
