import type { PriceData, PriceFeedRequest, PriceFeedSource } from './pricefeed-provider.types';

import { DiscoveryService } from '@nestjs/core';

export const PriceFeedProvider = DiscoveryService.createDecorator<PriceFeedSource>();

export abstract class AbstractPriceFeedProvider {
  abstract fetchPrice(request: PriceFeedRequest): Promise<PriceData>;
}
