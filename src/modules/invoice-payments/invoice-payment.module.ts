import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { LoanMatcherModule } from '../loan-matcher/loan-matcher.module';
import { LoansModule } from '../loans/loans.module';
import { NotificationModule } from '../notifications/notification.module';
import { WalletBalanceCollectorModule } from '../wallet-balance-collector/wallet-balance-collector.module';
import { InvoicePaymentQueueService } from './invoice-payment.queue.service';
import { InvoicePaymentService } from './invoice-payment.service';

@Module({
  imports: [
    SharedModule,
    NotificationModule,
    forwardRef(() => LoanMatcherModule),
    LoansModule,
    WalletBalanceCollectorModule,
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
  providers: [InvoicePaymentService, InvoicePaymentQueueService],
  exports: [InvoicePaymentService, InvoicePaymentQueueService, WalletBalanceCollectorModule],
})
export class InvoicePaymentModule {}
