import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { PricefeedService } from './pricefeed.service';
import { PriceFeedProviderFactory } from './pricefeed-provider.factory.js';
import { BinancePriceFeedProvider } from './providers/binance.provider.js';
import { CoinGeckoPriceFeedProvider } from './providers/coingecko.provider.js';
import { CoinMarketCapPriceFeedProvider } from './providers/coinmarketcap.provider.js';
import { RandomPriceFeedProvider } from './providers/random.provider.js';

@Module({
  imports: [ConfigModule, DiscoveryModule, ScheduleModule.forRoot(), RepositoryModule],
  providers: [
    PricefeedService,
    PriceFeedProviderFactory,

    BinancePriceFeedProvider,
    CoinGeckoPriceFeedProvider,
    CoinMarketCapPriceFeedProvider,
    RandomPriceFeedProvider,
  ],
  exports: [PricefeedService],
})
export class PricefeedModule {}
