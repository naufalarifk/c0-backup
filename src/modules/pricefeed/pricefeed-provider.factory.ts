import type { PriceFeedSource } from './pricefeed-provider.types';

import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AbstractPriceFeedProvider, PriceFeedProvider } from './pricefeed-provider.abstract';

@Injectable()
export class PriceFeedProviderFactory {
  constructor(private readonly discoveryService: DiscoveryService) {}

  getProvider(source: PriceFeedSource): AbstractPriceFeedProvider | undefined {
    const providers = this.discoveryService.getProviders();
    const provider = providers.find(provider => {
      return this.discoveryService.getMetadataByDecorator(PriceFeedProvider, provider) === source;
    })?.instance;
    return provider instanceof AbstractPriceFeedProvider ? provider : undefined;
  }
}
