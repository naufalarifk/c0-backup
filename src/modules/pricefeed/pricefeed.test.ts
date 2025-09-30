import {
  doesNotReject,
  doesNotThrow,
  equal,
  notEqual,
  ok,
  rejects,
  throws,
} from 'node:assert/strict';

import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { InMemoryCryptogadaiRepository } from '../../shared/repositories/in-memory-cryptogadai.repository';
import { afterEach, beforeEach, describe, it, suite } from '../../shared/utils/test';
import { PricefeedService } from './pricefeed.service';
import { PriceFeedProviderFactory } from './pricefeed-provider.factory';
import { RandomPriceFeedProvider } from './providers/random.provider';

describe('PriceFeed Integration Tests', () => {
  let repository: CryptogadaiRepository;
  let priceFeedService: PricefeedService;
  let module: TestingModule;

  beforeEach(async () => {
    // Create in-memory repository
    repository = new InMemoryCryptogadaiRepository();
    await repository.connect();
    await repository.migrate();

    // Create NestJS testing module manually with all required providers
    const configService = {
      get: (key: string, defaultValue?: unknown) => {
        if (key === 'PRICEFEED_FETCH_TIMEOUT') return 5000;
        return defaultValue;
      },
    };

    module = await Test.createTestingModule({
      providers: [
        {
          provide: PricefeedService,
          useFactory: (
            repo: CryptogadaiRepository,
            factory: PriceFeedProviderFactory,
            config: ConfigService,
          ) => {
            return new PricefeedService(repo, factory, config);
          },
          inject: [CryptogadaiRepository, PriceFeedProviderFactory, ConfigService],
        },
        {
          provide: PriceFeedProviderFactory,
          useFactory: (discoveryService: DiscoveryService) => {
            return new PriceFeedProviderFactory(discoveryService);
          },
          inject: [DiscoveryService],
        },
        RandomPriceFeedProvider,
        DiscoveryService,
        {
          provide: CryptogadaiRepository,
          useValue: repository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    priceFeedService = module.get<PricefeedService>(PricefeedService);
  });

  afterEach(async () => {
    await repository.close();
    await module.close();
  });

  describe('RandomPriceFeedProvider', () => {
    it('should fetch reasonable prices for BTC/USD', async () => {
      const provider = new RandomPriceFeedProvider();

      const request = {
        priceFeedId: '1',
        blockchainKey: 'crosschain',
        baseCurrencyTokenId: 'slip44:0',
        quoteCurrencyTokenId: 'iso4217:usd',
        source: 'random' as const,
      };

      const priceData = await provider.fetchPrice(request);

      // Verify price data structure
      ok(priceData.bidPrice);
      ok(priceData.askPrice);
      ok(priceData.sourceDate instanceof Date);
      ok(priceData.retrievalDate instanceof Date);

      const bidPrice = parseFloat(priceData.bidPrice);
      const askPrice = parseFloat(priceData.askPrice);

      // BTC should be reasonably priced (between $30k and $100k)
      ok(bidPrice > 30000);
      ok(bidPrice < 100000);
      ok(askPrice > 30000);
      ok(askPrice < 100000);

      // Ask price should be higher than bid price (spread)
      ok(askPrice > bidPrice);
    });

    it('should fetch reasonable prices for ETH/USD', async () => {
      const provider = new RandomPriceFeedProvider();

      const request = {
        priceFeedId: '2',
        blockchainKey: 'crosschain',
        baseCurrencyTokenId: 'slip44:60',
        quoteCurrencyTokenId: 'iso4217:usd',
        source: 'random' as const,
      };

      const priceData = await provider.fetchPrice(request);
      const bidPrice = parseFloat(priceData.bidPrice);
      const askPrice = parseFloat(priceData.askPrice);

      // ETH should be reasonably priced (between $1k and $10k)
      ok(bidPrice > 1000);
      ok(bidPrice < 10000);
      ok(askPrice > bidPrice);
    });

    it('should fetch reasonable prices for BNB/USD', async () => {
      const provider = new RandomPriceFeedProvider();

      const request = {
        priceFeedId: '3',
        blockchainKey: 'crosschain',
        baseCurrencyTokenId: 'slip44:714',
        quoteCurrencyTokenId: 'iso4217:usd',
        source: 'random' as const,
      };

      const priceData = await provider.fetchPrice(request);
      const bidPrice = parseFloat(priceData.bidPrice);
      const askPrice = parseFloat(priceData.askPrice);

      // BNB should be reasonably priced (between $100 and $2000)
      ok(bidPrice > 100);
      ok(bidPrice < 2000);
      ok(askPrice > bidPrice);
    });

    it('should fetch reasonable prices for SOL/USD', async () => {
      const provider = new RandomPriceFeedProvider();

      const request = {
        priceFeedId: '4',
        blockchainKey: 'crosschain',
        baseCurrencyTokenId: 'slip44:501',
        quoteCurrencyTokenId: 'iso4217:usd',
        source: 'random' as const,
      };

      const priceData = await provider.fetchPrice(request);
      const bidPrice = parseFloat(priceData.bidPrice);
      const askPrice = parseFloat(priceData.askPrice);

      // SOL should be reasonably priced (between $50 and $500)
      ok(bidPrice > 50);
      ok(bidPrice < 500);
      ok(askPrice > bidPrice);
    });

    it('should handle USD/USD pair correctly', async () => {
      const provider = new RandomPriceFeedProvider();

      const request = {
        priceFeedId: '5',
        blockchainKey: 'crosschain',
        baseCurrencyTokenId: 'iso4217:usd',
        quoteCurrencyTokenId: 'iso4217:usd',
        source: 'random' as const,
      };

      const priceData = await provider.fetchPrice(request);
      const bidPrice = parseFloat(priceData.bidPrice);
      const askPrice = parseFloat(priceData.askPrice);

      // USD/USD should be close to 1.0 (within small spread)
      ok(bidPrice > 0.99);
      ok(bidPrice < 1.01);
      ok(askPrice > 0.99);
      ok(askPrice < 1.01);
      ok(askPrice > bidPrice);
    });

    it('should throw error for unsupported currency pairs', async () => {
      const provider = new RandomPriceFeedProvider();

      const request = {
        priceFeedId: '6',
        blockchainKey: 'crosschain',
        baseCurrencyTokenId: 'unsupported:currency',
        quoteCurrencyTokenId: 'iso4217:usd',
        source: 'random' as const,
      };

      await rejects(() => provider.fetchPrice(request), /Unsupported currency pair/);
    });
  });

  describe('PricefeedService Integration', () => {
    it('should have repository methods available', async () => {
      // Test that the repository methods we need exist
      ok(typeof repository.platformRetrievesActivePriceFeeds === 'function');
      ok(typeof repository.platformRetrievesExchangeRates === 'function');
      ok(typeof repository.platformFeedsExchangeRate === 'function');
    });

    it('should retrieve active price feeds from database with currency decimals', async () => {
      // Direct repository test
      const result = await repository.platformRetrievesActivePriceFeeds();
      ok(result);
      ok(Array.isArray(result.priceFeeds));

      // Should have price feeds inserted from SQL migration
      ok(result.priceFeeds.length > 0);

      // Verify structure of price feeds
      const priceFeed = result.priceFeeds[0];
      ok(priceFeed.id);
      ok(priceFeed.blockchainKey);
      ok(priceFeed.baseCurrencyTokenId);
      ok(priceFeed.quoteCurrencyTokenId);
      ok(priceFeed.source);
      ok(typeof priceFeed.quoteCurrencyDecimals === 'number');
      ok(priceFeed.quoteCurrencyDecimals >= 0);
    });

    it('should manually feed exchange rate in lowest denomination and retrieve it', async () => {
      // Get a price feed to use
      const { priceFeeds } = await repository.platformRetrievesActivePriceFeeds();
      ok(priceFeeds.length > 0);

      const priceFeed = priceFeeds[0];
      const _decimals = priceFeed.quoteCurrencyDecimals;

      // Manually feed an exchange rate (in lowest denomination)
      // For USD with 6 decimals: 65000.123456 USD = 65000123456 lowest units
      const bidPriceLowest = '65000123456';
      const askPriceLowest = '65010654321';

      await repository.platformFeedsExchangeRate({
        priceFeedId: priceFeed.id,
        bidPrice: bidPriceLowest,
        askPrice: askPriceLowest,
        retrievalDate: new Date(),
        sourceDate: new Date(),
      });

      // Verify it was stored
      const { exchangeRates } = await repository.platformRetrievesExchangeRates({
        limit: 100,
        offset: 0,
      });

      ok(exchangeRates.length > 0);

      const exchangeRate = exchangeRates[0];
      ok(exchangeRate.id);
      ok(exchangeRate.priceFeedId);
      equal(exchangeRate.bidPrice, bidPriceLowest);
      equal(exchangeRate.askPrice, askPriceLowest);
      ok(exchangeRate.retrievalDate);
      ok(exchangeRate.sourceDate);
    });

    it('should use PricefeedService to fetch and store exchange rates with decimal conversion', async () => {
      // Debug: Check if the service was properly instantiated
      ok(priceFeedService, 'PricefeedService should be instantiated');

      // Clear existing exchange rates first
      await repository.sql`DELETE FROM exchange_rates`;

      // Use the injected PricefeedService to fetch and store prices
      await priceFeedService.fetchAndStorePrices();

      // Verify exchange rates were stored
      const { exchangeRates } = await repository.platformRetrievesExchangeRates({
        limit: 100,
        offset: 0,
      });

      ok(exchangeRates.length > 0);

      // Find a BTC/USD exchange rate to verify decimal conversion
      const btcUsdRate = exchangeRates.find(
        er => er.baseCurrency === 'slip44:0' && er.quoteCurrency === 'iso4217:usd',
      );

      if (btcUsdRate) {
        // BTC prices are typically in the tens of thousands
        // USD has 6 decimals, so 65000 USD = 65000000000 lowest units
        const bidPrice = parseFloat(btcUsdRate.bidPrice);
        const askPrice = parseFloat(btcUsdRate.askPrice);

        // Verify prices are in lowest denomination (should be large numbers)
        ok(bidPrice > 30000000000); // > 30k USD in lowest units
        ok(bidPrice < 100000000000); // < 100k USD in lowest units
        ok(askPrice > bidPrice); // Ask should be higher than bid

        // Verify prices are whole numbers (no decimals in lowest denomination)
        equal(bidPrice, Math.floor(bidPrice));
        equal(askPrice, Math.floor(askPrice));
      }
    });

    it('should use RandomPriceFeedProvider to generate and store exchange rates', async () => {
      // Get price feeds
      const { priceFeeds } = await repository.platformRetrievesActivePriceFeeds();
      const randomPriceFeeds = priceFeeds.filter(pf => pf.source === 'random');
      ok(randomPriceFeeds.length > 0);

      const priceFeed = randomPriceFeeds[0];

      // Use RandomPriceFeedProvider directly
      const provider = new RandomPriceFeedProvider();
      const request = {
        priceFeedId: priceFeed.id,
        blockchainKey: priceFeed.blockchainKey,
        baseCurrencyTokenId: priceFeed.baseCurrencyTokenId,
        quoteCurrencyTokenId: priceFeed.quoteCurrencyTokenId,
        source: priceFeed.source,
      };

      const priceData = await provider.fetchPrice(request);

      // Store the price data (still need to convert to lowest denomination manually here)
      await repository.platformFeedsExchangeRate({
        priceFeedId: priceFeed.id,
        bidPrice: priceData.bidPrice,
        askPrice: priceData.askPrice,
        retrievalDate: priceData.retrievalDate,
        sourceDate: priceData.sourceDate,
      });

      // Verify it was stored correctly
      const { exchangeRates } = await repository.platformRetrievesExchangeRates({
        limit: 100,
        offset: 0,
      });

      ok(exchangeRates.length > 0);

      const exchangeRate = exchangeRates.find(er => er.priceFeedId === priceFeed.id);
      ok(exchangeRate);
      ok(parseFloat(exchangeRate.bidPrice) > 0);
      ok(parseFloat(exchangeRate.askPrice) > 0);
      ok(parseFloat(exchangeRate.askPrice) >= parseFloat(exchangeRate.bidPrice));
    });
  });
});
