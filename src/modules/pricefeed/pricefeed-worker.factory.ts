import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { AnyPriceFeedWorkerData, PriceFeedWorkerType } from './pricefeed.types';
import { PriceFeedWorker, PriceFeedWorkerBase } from './pricefeed-worker.abstract';

@Injectable()
export class PriceFeedWorkerFactory {
  private readonly logger = new Logger(PriceFeedWorkerFactory.name);
  private readonly workers = new Map<PriceFeedWorkerType, PriceFeedWorkerBase>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    const providers = this.discoveryService.getProviders();

    providers
      .filter(wrapper => wrapper.metatype && wrapper.instance)
      .forEach(wrapper => {
        const { instance, metatype } = wrapper;
        if (!metatype) return;

        const workerType = this.reflector.get(PriceFeedWorker, metatype);

        if (workerType && instance instanceof PriceFeedWorkerBase) {
          this.workers.set(workerType as PriceFeedWorkerType, instance);
          this.logger.log(`Registered price feed worker: ${workerType}`);
        }
      });
  }

  getWorker(type: PriceFeedWorkerType): PriceFeedWorkerBase | undefined {
    return this.workers.get(type);
  }

  getWorkerByData(data: AnyPriceFeedWorkerData): PriceFeedWorkerBase | undefined {
    for (const worker of this.workers.values()) {
      if (worker.canProcess(data)) {
        return worker;
      }
    }
    return undefined;
  }

  getAllWorkers(): Map<PriceFeedWorkerType, PriceFeedWorkerBase> {
    return new Map(this.workers);
  }
}
