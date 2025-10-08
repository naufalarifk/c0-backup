import type { Job } from 'bullmq';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { WalletBalanceCollectionJobData } from './balance-collection.types';
import { WalletBalanceCollectorService } from './wallet-balance-collector.service';

@Injectable()
@Processor('walletBalanceCollectorQueue')
export class WalletBalanceCollectorProcessor extends WorkerHost {
  private readonly logger = new TelemetryLogger(WalletBalanceCollectorProcessor.name);

  constructor(private readonly walletBalanceCollectorService: WalletBalanceCollectorService) {
    super();
  }

  async process(job: Job<WalletBalanceCollectionJobData>): Promise<void> {
    const { blockchainKey, walletAddress, walletDerivationPath } = job.data;

    this.logger.debug(
      `Processing wallet balance collection job ${job.id} (blockchain: ${blockchainKey})`,
    );

    await this.walletBalanceCollectorService.collectBalance({
      blockchainKey,
      walletAddress,
      walletDerivationPath,
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WalletBalanceCollectionJobData>) {
    this.logger.debug(`Wallet balance collection job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WalletBalanceCollectionJobData>, error: Error) {
    this.logger.error(`Wallet balance collection job ${job.id} failed: ${error.message}`);
  }
}
