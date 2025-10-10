import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { IndexerListener } from './indexer-listener.abstract';

@Injectable()
export class IndexerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new TelemetryLogger(IndexerProcessor.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly appConfig: AppConfigService,
  ) {}

  #startedListeners = new Set<IndexerListener>();

  async onModuleInit() {
    if (this.#startedListeners.size > 0) {
      this.logger.warn('IndexerProcessor already initialized, skipping duplicate initialization');
      return;
    }

    const enabledIndexers = this.appConfig.enabledIndexers;
    this.logger.log(`Starting indexers for blockchain keys: ${enabledIndexers.join(', ')}`);

    const listeners = this.discovery.getProviders().filter(wrapper => {
      return wrapper.instance && wrapper.instance instanceof IndexerListener;
    });

    for (const wrapper of listeners) {
      const listener = wrapper.instance as IndexerListener;
      const blockchainKey = listener.getBlockchainKey();

      if (!blockchainKey || !enabledIndexers.includes(blockchainKey)) {
        this.logger.log(`Skipping indexer for blockchain key: ${blockchainKey || 'unknown'}`);
        continue;
      }

      this.logger.log(`Starting indexer for blockchain key: ${blockchainKey}`);
      await listener.start();
      this.#startedListeners.add(listener);
    }
  }

  async onModuleDestroy() {
    for (const listener of this.#startedListeners) {
      try {
        await listener.stop();
      } catch (error) {
        this.logger.error('Error stopping indexer listener', error);
      }
    }
  }
}
