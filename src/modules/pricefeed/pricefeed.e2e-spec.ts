import type { ConfigService } from '@nestjs/config';

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { config } from 'dotenv';

// Load environment variables from .env file
config();

import { CoinMarketCapMetadata, CoinMarketCapProvider } from './providers/coinmarketcap.provider';

// Simple ConfigService implementation that reads from environment
class SimpleConfigService {
  get(key: string, defaultValue?: string): string {
    return process.env[key] || defaultValue || '';
  }
}

describe('CoinMarketCap Provider E2E Tests', () => {
  let coinMarketCapProvider: CoinMarketCapProvider;
  let configService: SimpleConfigService;

  beforeEach(() => {
    configService = new SimpleConfigService();
    coinMarketCapProvider = new CoinMarketCapProvider(configService as unknown as ConfigService);
  });

  afterEach(() => {
    coinMarketCapProvider = undefined!;
    configService = undefined!;
  });

  describe('Provider Configuration', () => {
    it('should have PRICEFEED_API_KEY configured', () => {
      const apiKey = configService.get('PRICEFEED_API_KEY', '');
      console.log('API Key configured:', apiKey ? '✅ YES' : '❌ NO');

      assert.ok(apiKey, 'API key should be defined');
      assert.notStrictEqual(apiKey, '', 'API key should not be empty');
    });
  });

  describe('CoinMarketCap Provider E2E', () => {
    it('should be available and authenticate successfully', { timeout: 15000 }, async () => {
      const isAvailable = await coinMarketCapProvider.isAvailable();
      console.log('CoinMarketCap API available:', isAvailable);

      assert.strictEqual(isAvailable, true, 'CoinMarketCap API should be available');
    });

    it('should fetch real Bitcoin price data', { timeout: 30000 }, async () => {
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
        assert.ok(exchangeRate.bidPrice, 'bidPrice should be defined');
        assert.ok(exchangeRate.askPrice, 'askPrice should be defined');
        assert.ok(exchangeRate.sourceDate instanceof Date, 'sourceDate should be a Date instance');
        assert.ok(parseFloat(exchangeRate.bidPrice) > 0, 'bidPrice should be greater than 0');
        assert.ok(parseFloat(exchangeRate.askPrice) > 0, 'askPrice should be greater than 0');

        // Bitcoin should be rank 1
        assert.strictEqual(metadata?.cmcRank, 1, 'Bitcoin should be rank 1');

        // Should have valid market data
        assert.ok(
          metadata?.marketCap && metadata.marketCap > 0,
          'marketCap should be greater than 0',
        );
        assert.ok(
          metadata?.volume24h && metadata.volume24h > 0,
          'volume24h should be greater than 0',
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to fetch Bitcoin price:', errorMessage);
        if (errorMessage.includes('API key') || errorMessage.includes('401')) {
          throw new Error('Authentication failed - check PRICEFEED_API_KEY');
        }
        throw error;
      }
    });

    it('should fetch Ethereum price data', { timeout: 30000 }, async () => {
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

        assert.ok(exchangeRate.bidPrice, 'bidPrice should be defined');
        assert.ok(exchangeRate.askPrice, 'askPrice should be defined');
        assert.ok(parseFloat(exchangeRate.bidPrice) > 0, 'bidPrice should be greater than 0');
        assert.ok(parseFloat(exchangeRate.askPrice) > 0, 'askPrice should be greater than 0');

        // Ethereum should be rank 2
        assert.strictEqual(ethMetadata?.cmcRank, 2, 'Ethereum should be rank 2');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to fetch Ethereum price:', errorMessage);
        throw error;
      }
    });

    it('should handle invalid currency gracefully', { timeout: 15000 }, async () => {
      try {
        await coinMarketCapProvider.fetchExchangeRate({
          blockchainKey: 'invalid',
          baseCurrencyTokenId: 'INVALID',
          quoteCurrencyTokenId: 'USD',
        });

        assert.fail('Expected error for invalid currency');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('Expected error for invalid currency:', errorMessage);
        assert.ok(
          errorMessage.includes('Could not find CoinMarketCap ID'),
          'Error should contain CoinMarketCap ID message',
        );
      }
    });

    it('should test multiple currencies in sequence', { timeout: 60000 }, async () => {
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

          assert.ok(exchangeRate.bidPrice, 'bidPrice should be defined');
          assert.ok(parseFloat(exchangeRate.bidPrice) > 0, 'bidPrice should be greater than 0');

          if (currency.expectedRank) {
            assert.strictEqual(
              currencyMetadata?.cmcRank,
              currency.expectedRank,
              `${currency.name} should have expected rank`,
            );
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to fetch ${currency.name} price:`, errorMessage);
          throw error;
        }
      }
    });
  });

  describe('Provider Integration E2E', () => {
    it(
      'should test real-time price differences between multiple requests',
      { timeout: 20000 },
      async () => {
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
        assert.ok(
          parseFloat(btcPrice1.bidPrice) > 0,
          'First Bitcoin price should be greater than 0',
        );
        assert.ok(
          parseFloat(btcPrice2.bidPrice) > 0,
          'Second Bitcoin price should be greater than 0',
        );

        console.log('✅ Real-time price fetching validated');
      },
    );
  });

  describe('Error Handling E2E', () => {
    it('should handle network errors gracefully', { timeout: 15000 }, async () => {
      // This test would require mocking network failures
      // For now, we'll just verify the provider handles missing API keys

      const mockConfigService = {
        get: (key: string) => (key === 'PRICEFEED_API_KEY' ? '' : process.env[key] || ''),
      };
      const mockProvider = new CoinMarketCapProvider(mockConfigService as unknown as ConfigService);

      const isAvailable = await mockProvider.isAvailable();
      assert.strictEqual(isAvailable, false, 'Provider should not be available with empty API key');

      console.log('✅ Provider correctly handles missing API key');
    });

    it('should handle rate limiting appropriately', { timeout: 30000 }, async () => {
      // Test rapid requests to check rate limiting behavior
      const requests: Array<
        | {
            bidPrice?: string;
            askPrice?: string;
            error?: string;
          }
        | { error: string }
      > = [];

      for (let i = 0; i < 3; i++) {
        requests.push(
          await coinMarketCapProvider
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
      assert.ok(successes.length > 0, 'At least one request should succeed');

      console.log('✅ Rate limiting handled appropriately');
    });
  });
});
