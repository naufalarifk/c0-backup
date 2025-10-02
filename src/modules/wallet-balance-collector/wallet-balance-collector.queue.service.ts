import type { Queue } from 'bullmq';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { WalletBalanceCollectionJobData } from './wallet-balance-collector.types';

export interface EnqueueWalletBalanceCollectionOptions {
  delay?: number;
  attempts?: number;
  priority?: number;
}

@Injectable()
export class WalletBalanceCollectorQueueService {
  private readonly logger = new Logger(WalletBalanceCollectorQueueService.name);

  constructor(
    @InjectQueue('walletBalanceCollectorQueue')
    private readonly walletBalanceCollectorQueue: Queue<WalletBalanceCollectionJobData>,
  ) {}

  async enqueueBalanceCollection(
    data: WalletBalanceCollectionJobData,
    options: EnqueueWalletBalanceCollectionOptions = {},
  ): Promise<void> {
    const job = await this.walletBalanceCollectorQueue.add('wallet-balance-collection', data, {
      removeOnComplete: 50,
      removeOnFail: 10,
      attempts: options.attempts ?? 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      delay: options.delay ?? 0,
      priority: options.priority ?? 5,
    });

    this.logger.debug(
      `Queued wallet balance collection job ${job.id} for invoice ${data.invoiceId} (${data.blockchainKey})`,
    );
  }
}
