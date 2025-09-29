import type { JobsOptions, Queue } from 'bullmq';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../shared/telemetry.logger';

export interface WithdrawalProcessingData {
  withdrawalId: string;
  amount: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  beneficiaryAddress: string;
  userId: string;
}

@Injectable()
export class WithdrawalsQueueService {
  private readonly logger = new TelemetryLogger(WithdrawalsQueueService.name);

  constructor(
    @InjectQueue('withdrawalsQueue')
    private readonly withdrawalsQueue: Queue<WithdrawalProcessingData>,
  ) {}

  async queueWithdrawalProcessing(
    data: WithdrawalProcessingData,
    options: JobsOptions = {},
  ): Promise<void> {
    try {
      const job = await this.withdrawalsQueue.add('process-withdrawal', data, {
        priority: options.priority ?? 5, // High priority for financial operations
        delay: options.delay ?? 5000, // 5 second delay for database consistency
        attempts: options.attempts ?? 5, // More retry attempts for blockchain operations
        backoff: options.backoff ?? {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      });

      this.logger.log(
        `Queued withdrawal processing for ID: ${data.withdrawalId}, Job ID: ${job.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue withdrawal processing for ID: ${data.withdrawalId}:`,
        error,
      );
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.withdrawalsQueue.getWaiting(),
        this.withdrawalsQueue.getActive(),
        this.withdrawalsQueue.getCompleted(),
        this.withdrawalsQueue.getFailed(),
        this.withdrawalsQueue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      this.logger.error('Failed to get withdrawal queue stats:', error);
      throw error;
    }
  }

  async retryFailedJobs(): Promise<void> {
    try {
      const failedJobs = await this.withdrawalsQueue.getFailed();
      for (const job of failedJobs) {
        await job.retry();
        this.logger.log(`Retrying failed withdrawal job: ${job.id}`);
      }
    } catch (error) {
      this.logger.error('Failed to retry failed withdrawal jobs:', error);
      throw error;
    }
  }

  async clearQueue(): Promise<void> {
    try {
      await this.withdrawalsQueue.drain();
      await this.withdrawalsQueue.clean(0, Number.MAX_SAFE_INTEGER, 'completed');
      await this.withdrawalsQueue.clean(0, Number.MAX_SAFE_INTEGER, 'failed');
      await this.withdrawalsQueue.clean(0, Number.MAX_SAFE_INTEGER, 'active');
      await this.withdrawalsQueue.clean(0, Number.MAX_SAFE_INTEGER, 'waiting');
      await this.withdrawalsQueue.clean(0, Number.MAX_SAFE_INTEGER, 'delayed');
      this.logger.log('Withdrawal queue cleared');
    } catch (error) {
      this.logger.error('Failed to clear withdrawal queue:', error);
      throw error;
    }
  }
}
