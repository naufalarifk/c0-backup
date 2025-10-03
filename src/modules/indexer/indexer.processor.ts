import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { IndexerListener } from './indexer-listener.abstract';

@Injectable()
export class IndexerProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new TelemetryLogger(IndexerProcessor.name);

  constructor(private readonly discovery: DiscoveryService) {}

  #startedListeners = new Set<IndexerListener>();

  async onModuleInit() {
    if (this.#startedListeners.size > 0) {
      await this.onModuleDestroy();
    }

    const listeners = this.discovery.getProviders().filter(wrapper => {
      return wrapper.instance && wrapper.instance instanceof IndexerListener;
    });

    for (const wrapper of listeners) {
      const listener = wrapper.instance as IndexerListener;
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
