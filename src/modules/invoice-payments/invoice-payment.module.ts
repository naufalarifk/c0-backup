import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { WalletBalanceCollectorQueueService } from '../wallet-balance-collector/wallet-balance-collector.queue.service';
import { InvoicePaymentProcessor } from './invoice-payment.processor';
import { InvoicePaymentQueueService } from './invoice-payment.queue.service';
import { InvoicePaymentService } from './invoice-payment.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({
      name: 'invoicePaymentQueue',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    }),
    BullModule.registerQueue({
      name: 'walletBalanceCollectorQueue',
    }),
  ],
  providers: [
    InvoicePaymentService,
    InvoicePaymentQueueService,
    InvoicePaymentProcessor,
    WalletBalanceCollectorQueueService,
  ],
  exports: [InvoicePaymentService, InvoicePaymentQueueService],
})
export class InvoicePaymentModule {}
