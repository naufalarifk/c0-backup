import type { BlockchainNetwork } from './balance-collection.types';

import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { BalanceCollector } from './balance-collector.abstract';

export const CollectorFlag = DiscoveryService.createDecorator<BlockchainNetwork>();

@Injectable()
export class BalanceCollectorFactory {
  constructor(private readonly discoveryService: DiscoveryService) {}

  getCollector(blockchainKey: BlockchainNetwork): BalanceCollector | undefined {
    const providers = this.discoveryService.getProviders();
    const collector = providers.find(provider => {
      return (
        this.discoveryService.getMetadataByDecorator(CollectorFlag, provider) === blockchainKey
      );
    })?.instance;
    return collector instanceof BalanceCollector ? collector : undefined;
  }

  getAllCollectors(): BalanceCollector[] {
    const providers = this.discoveryService.getProviders();
    return providers
      .filter(provider => {
        const metadata = this.discoveryService.getMetadataByDecorator(CollectorFlag, provider);
        return metadata !== undefined;
      })
      .map(provider => provider.instance)
      .filter((instance): instance is BalanceCollector => instance instanceof BalanceCollector);
  }
}
