import assert from 'node:assert';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ConfigService } from '@nestjs/config';

import { config } from 'dotenv';

import { CoinMarketCapMetadata, CoinMarketCapProvider } from './providers/coinmarketcap.provider';

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') });

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

    console.log('🔄 CoinMarketCap Provider E2E test setup complete');
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

      console.log('✅ API Key configuration test passed');
    });
  });

  describe('Provider Availability', () => {
    it('should be available and authenticate successfully', { timeout: 10000 }, async () => {
      console.log('🔄 Testing CoinMarketCap provider availability...');

      const isAvailable = await coinMarketCapProvider.isAvailable();
      assert.strictEqual(isAvailable, true, 'CoinMarketCap provider should be available');

      console.log('✅ CoinMarketCap provider is available');
    });
  });

  describe('Real Price Data Tests', () => {
    it('should fetch real Bitcoin price data', { timeout: 15000 }, async () => {
      console.log('🔄 Fetching real Bitcoin price data...');

      try {
        const exchangeRate = await coinMarketCapProvider.fetchExchangeRate({
          blockchainKey: 'bitcoin',
          baseCurrencyTokenId: 'BTC',
          quoteCurrencyTokenId: 'USD',
        });

        console.log('Bitcoin Price Data:', {
          bidPrice: exchangeRate.bidPrice,
          askPrice: exchangeRate.askPrice,
          sourceDate: exchangeRate.sourceDate,
        });

        // Validate basic structure
        assert.ok(exchangeRate.bidPrice, 'Bid price should be defined');
        assert.ok(exchangeRate.askPrice, 'Ask price should be defined');
        assert.ok(exchangeRate.sourceDate instanceof Date, 'Source date should be a Date instance');
        assert.ok(parseFloat(exchangeRate.bidPrice) > 0, 'Bid price should be greater than 0');
        assert.ok(parseFloat(exchangeRate.askPrice) > 0, 'Ask price should be greater than 0');

        // Test metadata (if available)
        const metadata = exchangeRate.metadata as unknown as CoinMarketCapMetadata;
        if (metadata && typeof metadata === 'object') {
          console.log('Metadata available:', metadata);
          // Basic metadata validation without strict type checking
        }

        console.log('✅ Bitcoin price data fetched successfully');
      } catch (error) {
        console.error('❌ Bitcoin price fetch failed:', error);
        throw error;
      }
    });

    it('should fetch Ethereum price data', { timeout: 15000 }, async () => {
      console.log('🔄 Fetching real Ethereum price data...');

      try {
        const exchangeRate = await coinMarketCapProvider.fetchExchangeRate({
          blockchainKey: 'ethereum',
          baseCurrencyTokenId: 'ETH',
          quoteCurrencyTokenId: 'USD',
        });

        console.log('Ethereum Price Data:', {
          bidPrice: exchangeRate.bidPrice,
          askPrice: exchangeRate.askPrice,
        });

        // Validate basic structure
        assert.ok(exchangeRate.bidPrice, 'ETH bid price should be defined');
        assert.ok(exchangeRate.askPrice, 'ETH ask price should be defined');
        assert.ok(parseFloat(exchangeRate.bidPrice) > 0, 'ETH bid price should be greater than 0');
        assert.ok(parseFloat(exchangeRate.askPrice) > 0, 'ETH ask price should be greater than 0');

        // Test metadata (if available)
        if (exchangeRate.metadata) {
          console.log('Ethereum metadata available:', exchangeRate.metadata);
        }

        console.log('✅ Ethereum price data fetched successfully');
      } catch (error) {
        console.error('❌ Ethereum price fetch failed:', error);
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid currency gracefully', { timeout: 10000 }, async () => {
      console.log('🔄 Testing error handling with invalid currency...');

      try {
        await coinMarketCapProvider.fetchExchangeRate({
          blockchainKey: 'invalid-currency',
          baseCurrencyTokenId: 'INVALID',
          quoteCurrencyTokenId: 'USD',
        });
        assert.fail('Should have thrown an error for invalid currency');
      } catch (error) {
        const errorMessage = (error as Error).message;
        console.log('Expected error caught:', errorMessage);

        assert.ok(
          errorMessage.includes('Could not find CoinMarketCap ID'),
          'Error should contain expected message',
        );
        console.log('✅ Invalid currency error handling works correctly');
      }
    });
  });

  describe('Sequential API Calls', () => {
    it('should test multiple currencies in sequence', { timeout: 30000 }, async () => {
      console.log('🔄 Testing multiple currency requests in sequence...');

      const currencies = [
        { name: 'bitcoin', symbol: 'BTC', fiatSymbol: 'USD' },
        { name: 'ethereum', symbol: 'ETH', fiatSymbol: 'USD' },
        { name: 'binancecoin', symbol: 'BNB', fiatSymbol: 'USD' },
      ];

      const results: Array<{
        symbol: string;
        bidPrice: string;
        askPrice: string;
      }> = [];

      for (const currency of currencies) {
        try {
          console.log(`  🔄 Fetching ${currency.symbol}/${currency.fiatSymbol}...`);

          const exchangeRate = await coinMarketCapProvider.fetchExchangeRate({
            blockchainKey: currency.name,
            baseCurrencyTokenId: currency.symbol,
            quoteCurrencyTokenId: currency.fiatSymbol,
          });

          // Validate each result
          assert.ok(exchangeRate.bidPrice, `${currency.symbol} bid price should be defined`);
          assert.ok(
            parseFloat(exchangeRate.bidPrice) > 0,
            `${currency.symbol} bid price should be positive`,
          );

          results.push({
            symbol: currency.symbol,
            bidPrice: exchangeRate.bidPrice,
            askPrice: exchangeRate.askPrice,
          });

          console.log(`  ✅ ${currency.symbol}: $${exchangeRate.bidPrice}`);

          // Add small delay between requests to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`  ❌ ${currency.symbol} failed:`, (error as Error).message);
          throw error;
        }
      }

      console.log('✅ Sequential currency requests completed successfully');
      console.log('Results summary:', results);
    });
  });

  describe('Rate Limiting and Performance', () => {
    it('should handle API rate limits gracefully', { timeout: 20000 }, async () => {
      console.log('🔄 Testing API rate limit handling...');

      const promises: Array<
        | {
            index: number;
            success: boolean;
            bidPrice?: string;
            error?: string;
          }
        | { error: string }
      > = [];
      const testCount = 3; // Conservative number to avoid hitting rate limits

      for (let i = 0; i < testCount; i++) {
        promises.push(
          await coinMarketCapProvider
            .fetchExchangeRate({
              blockchainKey: 'bitcoin',
              baseCurrencyTokenId: 'BTC',
              quoteCurrencyTokenId: 'USD',
            })
            .then(result => ({
              index: i,
              success: true,
              bidPrice: result.bidPrice,
            }))
            .catch(error => ({
              index: i,
              success: false,
              error: (error as Error).message,
            })),
        );
      }

      const results = await Promise.all(promises);
      console.log('Concurrent request results:', results);

      // At least some requests should succeed
      const successfulRequests = results.filter(r => ('success' in r ? r.success : false));
      assert.ok(successfulRequests.length > 0, 'At least some concurrent requests should succeed');

      console.log(`✅ ${successfulRequests.length}/${testCount} concurrent requests succeeded`);
    });

    it('should respond within reasonable time limits', { timeout: 15000 }, async () => {
      console.log('🔄 Testing response time performance...');

      const startTime = Date.now();

      await coinMarketCapProvider.fetchExchangeRate({
        blockchainKey: 'bitcoin',
        baseCurrencyTokenId: 'BTC',
        quoteCurrencyTokenId: 'USD',
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Response time: ${responseTime}ms`);

      // API should respond within 10 seconds
      assert.ok(responseTime < 10000, 'API should respond within 10 seconds');

      console.log('✅ Response time performance test passed');
    });
  });

  describe('Data Validation', () => {
    it('should validate price data format and ranges', { timeout: 15000 }, async () => {
      console.log('🔄 Testing price data validation...');

      const exchangeRate = await coinMarketCapProvider.fetchExchangeRate({
        blockchainKey: 'bitcoin',
        baseCurrencyTokenId: 'BTC',
        quoteCurrencyTokenId: 'USD',
      });

      // Test price format (should be valid numbers)
      const bidPrice = parseFloat(exchangeRate.bidPrice);
      const askPrice = parseFloat(exchangeRate.askPrice);

      assert.ok(!isNaN(bidPrice), 'Bid price should be a valid number');
      assert.ok(!isNaN(askPrice), 'Ask price should be a valid number');
      assert.ok(bidPrice > 0, 'Bid price should be positive');
      assert.ok(askPrice > 0, 'Ask price should be positive');

      // Bitcoin price should be in reasonable range (very loose bounds)
      assert.ok(bidPrice > 1000, 'Bitcoin price should be above $1000');
      assert.ok(bidPrice < 1000000, 'Bitcoin price should be below $1,000,000');

      // Spread should be reasonable (ask >= bid)
      assert.ok(askPrice >= bidPrice, 'Ask price should be greater than or equal to bid price');

      // Date should be recent (within last hour)
      const now = new Date();
      const timeDiff = now.getTime() - exchangeRate.sourceDate.getTime();
      assert.ok(timeDiff < 3600000, 'Price data should be recent (within 1 hour)');

      console.log('✅ Price data validation passed');
    });
  });
});
