import type { BalanceCollectionRequest, BalanceCollectionResult } from './balance-collection.types';

import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { BalanceCollectorFactory } from './balance-collector.factory';

@Injectable()
export class WalletBalanceCollectorService {
  private readonly logger = new TelemetryLogger(WalletBalanceCollectorService.name);

  constructor(private readonly collectorFactory: BalanceCollectorFactory) {}

  async collectBalance(request: BalanceCollectionRequest): Promise<BalanceCollectionResult> {
    try {
      this.logger.log(`Starting balance collection on ${request.blockchainKey}`, {
        blockchainKey: request.blockchainKey,
        walletAddress: request.walletAddress,
      });

      // Get appropriate collector for the blockchain
      const collector = this.collectorFactory.getCollector(request.blockchainKey);

      if (!collector) {
        throw new Error(`No collector found for blockchain: ${request.blockchainKey}`);
      }

      if (!collector.canHandle(request)) {
        throw new Error(`Collector cannot handle blockchain: ${request.blockchainKey}`);
      }

      // Delegate to the specific collector
      const result = await collector.collect(request);

      if (result.skipped) {
        this.logger.log(`Balance collection skipped: ${result.skipReason}`, {
          reason: result.skipReason,
        });
      } else if (result.success) {
        this.logger.log(`Successfully collected balance`, {
          transactionHash: result.transactionHash,
          transferredAmount: result.transferredAmount,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to collect balance: ${errorMessage}`, {
        blockchainKey: request.blockchainKey,
        error: errorMessage,
      });

      return {
        success: false,
        balance: '0',
        error: errorMessage,
      };
    }
  }
}
