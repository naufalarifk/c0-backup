import type { Job } from 'bullmq';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { WalletBalanceCollectorService } from './wallet-balance-collector.service';
import { WalletBalanceCollectionJobData } from './wallet-balance-collector.types';

@Injectable()
@Processor('walletBalanceCollectorQueue')
export class WalletBalanceCollectorProcessor extends WorkerHost {
  private readonly logger = new Logger(WalletBalanceCollectorProcessor.name);

  constructor(private readonly walletBalanceCollectorService: WalletBalanceCollectorService) {
    super();
  }

  async process(job: Job<WalletBalanceCollectionJobData>): Promise<void> {
    const { invoiceId, blockchainKey, walletAddress, walletDerivationPath } = job.data;

    this.logger.debug(
      `Processing wallet balance collection job ${job.id} for invoice ${invoiceId} (blockchain: ${blockchainKey})`,
    );

    await this.walletBalanceCollectorService.collectBalance({
      invoiceId,
      blockchainKey,
      walletAddress,
      walletDerivationPath,
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WalletBalanceCollectionJobData>) {
    this.logger.debug(
      `Wallet balance collection job ${job.id} completed for invoice ${job.data.invoiceId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WalletBalanceCollectionJobData>, error: Error) {
    this.logger.error(
      `Wallet balance collection job ${job.id} failed for invoice ${job.data.invoiceId}: ${error.message}`,
    );
  }
}
