import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { WalletBalanceCollectorProcessor } from './wallet-balance-collector.processor';
import { WalletBalanceCollectorQueueService } from './wallet-balance-collector.queue.service';
import { WalletBalanceCollectorService } from './wallet-balance-collector.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({
      name: 'walletBalanceCollectorQueue',
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
  ],
  providers: [
    WalletBalanceCollectorService,
    WalletBalanceCollectorQueueService,
    WalletBalanceCollectorProcessor,
  ],
  exports: [WalletBalanceCollectorService, WalletBalanceCollectorQueueService],
})
export class WalletBalanceCollectorModule {}
