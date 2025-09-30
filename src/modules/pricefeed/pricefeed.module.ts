import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { PricefeedService } from './pricefeed.service';
import { PriceFeedProviderFactory } from './pricefeed-provider.factory';
import { BinancePriceFeedProvider } from './providers/binance.provider';
import { CoinGeckoPriceFeedProvider } from './providers/coingecko.provider';
import { CoinMarketCapPriceFeedProvider } from './providers/coinmarketcap.provider';
import { RandomPriceFeedProvider } from './providers/random.provider';

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
