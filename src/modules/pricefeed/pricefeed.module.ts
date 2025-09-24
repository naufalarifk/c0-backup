import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { SharedModule } from '../../shared/shared.module';
import { CryptocurrencyPriceService } from './cryptocurrency-price.service';
import { PriceFeedProcessor } from './pricefeed.processor';
import { PriceFeedService } from './pricefeed.service';
import { PriceFeedQueueService } from './pricefeed-queue.service';
import { PriceFeedWorkerFactory } from './pricefeed-worker.factory';
// Providers
import { CoinMarketCapProvider } from './providers/coinmarketcap.provider';
// Workers
import { ExchangeRateFetcherWorker } from './workers/exchange-rate-fetcher.worker';
import { ExchangeRateUpdaterWorker } from './workers/exchange-rate-updater.worker';

@Module({
  imports: [
    SharedModule, // Provides repository access
    DiscoveryModule, // Required for worker factory
    BullModule.registerQueue({
      name: 'pricefeedQueue',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  providers: [
    // Core services
    PriceFeedService,
    PriceFeedProcessor,
    PriceFeedQueueService,
    PriceFeedWorkerFactory,
    CryptocurrencyPriceService,

    // Workers
    ExchangeRateFetcherWorker,
    ExchangeRateUpdaterWorker,

    // Providers
    CoinMarketCapProvider,
  ],
  exports: [PriceFeedService, PriceFeedQueueService, CryptocurrencyPriceService],
})
export class PriceFeedModule {}
