import { Injectable, Logger } from '@nestjs/common';

import { IndexerService } from './indexer.service';

@Injectable()
export class IndexerProcessor {
  private readonly logger = new Logger(IndexerProcessor.name);

  constructor(readonly _indexerService: IndexerService) {}

  async start(): Promise<void> {
    this.logger.log('Starting blockchain indexer processor...');

    try {
      // The IndexerService onModuleInit will start the blockchain subscriptions
      this.logger.log('Blockchain indexer processor started successfully');
      this.logger.log('Subscriptions active for BTC, ETH, and SOL networks');
    } catch (error) {
      this.logger.error('Failed to start blockchain indexer processor:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.log('Stopping blockchain indexer processor...');
    // Add any cleanup logic here if needed
    this.logger.log('Blockchain indexer processor stopped');
  }
}
