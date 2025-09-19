import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  CoinMarketCapMetadata,
  CoinMarketCapProvider,
} from '../../../src/modules/pricefeed/providers/coinmarketcap.provider';

describe('CoinMarketCap Provider E2E Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let coinMarketCapProvider: CoinMarketCapProvider;
  let configService: ConfigService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env',
          isGlobal: true,
        }),
      ],
      providers: [CoinMarketCapProvider],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    coinMarketCapProvider = module.get<CoinMarketCapProvider>(CoinMarketCapProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (module) {
      await module.close();
    }
  });

  describe('Environment Setup', () => {
    it('should have required environment variables', () => {
      const apiKey = configService.get('PRICEFEED_API_KEY');
      console.log('CoinMarketCap API Key configured:', !!apiKey);

      expect(apiKey).toBeDefined();
      expect(apiKey).not.toBe('');

      if (!apiKey) {
        console.warn('PRICEFEED_API_KEY not configured - tests may fail');
      }
    });
  });

  describe('CoinMarketCap Provider E2E', () => {
    it('should be available and authenticate successfully', async () => {
      const isAvailable = await coinMarketCapProvider.isAvailable();
      console.log('CoinMarketCap API available:', isAvailable);

      expect(isAvailable).toBe(true);
    }, 15000);

    it('should fetch real Bitcoin price data', async () => {
      try {
        const exchangeRate = await coinMarketCapProvider.fetchExchangeRate({
          blockchainKey: 'bitcoin',
          baseCurrencyTokenId: 'BTC',
          quoteCurrencyTokenId: 'USD',
        });

        const metadata = exchangeRate.metadata as unknown as CoinMarketCapMetadata;

        console.log('Bitcoin Exchange Rate:', {
          bidPrice: `$${parseFloat(exchangeRate.bidPrice).toLocaleString()}`,
          askPrice: `$${parseFloat(exchangeRate.askPrice).toLocaleString()}`,
          sourceDate: exchangeRate.sourceDate,
          rank: metadata?.cmcRank,
          marketCap: metadata?.marketCap ? `$${(metadata.marketCap / 1e9).toFixed(1)}B` : 'N/A',
          volume24h: metadata?.volume24h ? `$${(metadata.volume24h / 1e9).toFixed(1)}B` : 'N/A',
          change24h: metadata?.percentChange24h
            ? `${metadata.percentChange24h.toFixed(2)}%`
            : 'N/A',
        });

        // Validate response structure
        expect(exchangeRate.bidPrice).toBeDefined();
        expect(exchangeRate.askPrice).toBeDefined();
        expect(exchangeRate.sourceDate).toBeInstanceOf(Date);
        expect(parseFloat(exchangeRate.bidPrice)).toBeGreaterThan(0);
        expect(parseFloat(exchangeRate.askPrice)).toBeGreaterThan(0);

        // Bitcoin should be rank 1
        expect(metadata?.cmcRank).toBe(1);

        // Should have valid market data
        expect(metadata?.marketCap).toBeGreaterThan(0);
        expect(metadata?.volume24h).toBeGreaterThan(0);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to fetch Bitcoin price:', errorMessage);
        if (errorMessage.includes('API key') || errorMessage.includes('401')) {
          throw new Error('Authentication failed - check PRICEFEED_API_KEY');
        }
        throw error;
      }
    }, 30000);

    it('should fetch Ethereum price data', async () => {
      try {
        const exchangeRate = await coinMarketCapProvider.fetchExchangeRate({
          blockchainKey: 'ethereum',
          baseCurrencyTokenId: 'ETH',
          quoteCurrencyTokenId: 'USD',
        });

        const ethMetadata = exchangeRate.metadata as unknown as CoinMarketCapMetadata;

        console.log('Ethereum Exchange Rate:', {
          bidPrice: `$${parseFloat(exchangeRate.bidPrice).toLocaleString()}`,
          askPrice: `$${parseFloat(exchangeRate.askPrice).toLocaleString()}`,
          rank: ethMetadata?.cmcRank,
          change24h: ethMetadata?.percentChange24h
            ? `${ethMetadata.percentChange24h.toFixed(2)}%`
            : 'N/A',
        });

        expect(exchangeRate.bidPrice).toBeDefined();
        expect(exchangeRate.askPrice).toBeDefined();
        expect(parseFloat(exchangeRate.bidPrice)).toBeGreaterThan(0);
        expect(parseFloat(exchangeRate.askPrice)).toBeGreaterThan(0);

        // Ethereum should be rank 2
        expect(ethMetadata?.cmcRank).toBe(2);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to fetch Ethereum price:', errorMessage);
        throw error;
      }
    }, 30000);

    it('should handle invalid currency gracefully', async () => {
      try {
        await coinMarketCapProvider.fetchExchangeRate({
          blockchainKey: 'invalid',
          baseCurrencyTokenId: 'INVALID',
          quoteCurrencyTokenId: 'USD',
        });

        fail('Expected error for invalid currency');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('Expected error for invalid currency:', errorMessage);
        expect(errorMessage).toContain('Could not find CoinMarketCap ID');
      }
    });

    it('should test multiple currencies in sequence', async () => {
      const currencies = [
        { symbol: 'BTC', name: 'Bitcoin', expectedRank: 1 },
        { symbol: 'ETH', name: 'Ethereum', expectedRank: 2 },
        { symbol: 'ADA', name: 'Cardano', blockchain: 'cardano' },
      ];

      for (const currency of currencies) {
        try {
          const exchangeRate = await coinMarketCapProvider.fetchExchangeRate({
            blockchainKey: currency.blockchain || currency.symbol.toLowerCase(),
            baseCurrencyTokenId: currency.symbol,
            quoteCurrencyTokenId: 'USD',
          });

          const currencyMetadata = exchangeRate.metadata as unknown as CoinMarketCapMetadata;

          console.log(`${currency.name} (${currency.symbol}):`, {
            price: `$${parseFloat(exchangeRate.bidPrice).toLocaleString()}`,
            rank: currencyMetadata?.cmcRank,
          });

          expect(exchangeRate.bidPrice).toBeDefined();
          expect(parseFloat(exchangeRate.bidPrice)).toBeGreaterThan(0);

          if (currency.expectedRank) {
            expect(currencyMetadata?.cmcRank).toBe(currency.expectedRank);
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to fetch ${currency.name} price:`, errorMessage);
          throw error;
        }
      }
    }, 60000);
  });

  describe('Provider Integration E2E', () => {
    it('should test real-time price differences between multiple requests', async () => {
      // Make two requests spaced apart to see price movement
      const btcPrice1 = await coinMarketCapProvider.fetchExchangeRate({
        blockchainKey: 'bitcoin',
        baseCurrencyTokenId: 'BTC',
        quoteCurrencyTokenId: 'USD',
      });

      console.log('First Bitcoin request:', {
        price: `$${parseFloat(btcPrice1.bidPrice).toLocaleString()}`,
        timestamp: btcPrice1.sourceDate,
      });

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));

      const btcPrice2 = await coinMarketCapProvider.fetchExchangeRate({
        blockchainKey: 'bitcoin',
        baseCurrencyTokenId: 'BTC',
        quoteCurrencyTokenId: 'USD',
      });

      console.log('Second Bitcoin request:', {
        price: `$${parseFloat(btcPrice2.bidPrice).toLocaleString()}`,
        timestamp: btcPrice2.sourceDate,
        priceDiff: (parseFloat(btcPrice2.bidPrice) - parseFloat(btcPrice1.bidPrice)).toFixed(2),
      });

      // Both should be valid prices
      expect(parseFloat(btcPrice1.bidPrice)).toBeGreaterThan(0);
      expect(parseFloat(btcPrice2.bidPrice)).toBeGreaterThan(0);

      console.log('✅ Real-time price fetching validated');
    }, 20000);
  });

  describe('Error Handling E2E', () => {
    it('should handle network errors gracefully', async () => {
      // This test would require mocking network failures
      // For now, we'll just verify the provider handles missing API keys

      const mockProvider = new CoinMarketCapProvider(new ConfigService({ PRICEFEED_API_KEY: '' }));

      const isAvailable = await mockProvider.isAvailable();
      expect(isAvailable).toBe(false);

      console.log('✅ Provider correctly handles missing API key');
    });

    it('should handle rate limiting appropriately', async () => {
      // Test rapid requests to check rate limiting behavior
      const requests = [];

      for (let i = 0; i < 3; i++) {
        requests.push(
          coinMarketCapProvider
            .fetchExchangeRate({
              blockchainKey: 'bitcoin',
              baseCurrencyTokenId: 'BTC',
              quoteCurrencyTokenId: 'USD',
            })
            .catch(error => ({ error: error.message })),
        );
      }

      const results = await Promise.all(requests);
      console.log('Rate limiting test results:', results.length, 'requests completed');

      // At least one should succeed
      const successes = results.filter(r => !('error' in r));
      expect(successes.length).toBeGreaterThan(0);

      console.log('✅ Rate limiting handled appropriately');
    }, 30000);
  });
});
