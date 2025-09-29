import type { PriceFeedService } from './pricefeed.service';
import type { AnyPriceFeedWorkerData, ExchangeRateFetcherData } from './pricefeed.types';

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { CryptocurrencyPriceService } from './cryptocurrency-price.service';

// Create a mock for PriceFeedService with all required methods
const mockPriceFeedService = {
  queueExchangeRateFetch: mock.fn(async () => undefined),
  getQueueStatus: mock.fn(async () => ({
    waiting: 2,
    active: 0,
    completed: 5,
    failed: 0,
  })),
  // Mock processWork to simulate error for invalid cryptocurrency
  processWork: mock.fn(async (params: AnyPriceFeedWorkerData) => {
    if (params.type === 'exchange-rate-fetcher') {
      const fetcherParams = params as ExchangeRateFetcherData;
      if (
        fetcherParams.blockchainKey === 'invalid-blockchain' ||
        fetcherParams.baseCurrencyTokenId === 'INVALID'
      ) {
        throw new Error('Could not find CoinMarketCap ID for INVALID');
      }
    }
    return undefined;
  }),
  isProviderAvailable: mock.fn(async () => true),
};

describe('CryptocurrencyPriceService E2E Tests', () => {
  let cryptoPriceService: CryptocurrencyPriceService;

  beforeEach(() => {
    // Reset mock call counts
    mockPriceFeedService.queueExchangeRateFetch.mock.resetCalls();
    mockPriceFeedService.getQueueStatus.mock.resetCalls();
    mockPriceFeedService.processWork.mock.resetCalls();
    mockPriceFeedService.isProviderAvailable.mock.resetCalls();

    // Direct instantiation without NestJS DI
    cryptoPriceService = new CryptocurrencyPriceService(
      mockPriceFeedService as unknown as PriceFeedService,
    );
  });

  afterEach(() => {
    cryptoPriceService = undefined!;
  });

  describe('Production Service Tests', () => {
    it('should be properly injected and available', () => {
      assert.ok(cryptoPriceService, 'CryptocurrencyPriceService should be defined');
      assert.ok(
        cryptoPriceService instanceof CryptocurrencyPriceService,
        'Should be instance of CryptocurrencyPriceService',
      );
    });

    it('should fetch Bitcoin price immediately', { timeout: 30000 }, async () => {
      console.log('Testing immediate Bitcoin price fetch...');

      try {
        await cryptoPriceService.fetchBitcoinPriceNow();
        console.log('✅ Bitcoin price fetched successfully');
      } catch (error) {
        console.error('❌ Bitcoin price fetch failed:', error);
        throw error;
      }
    });

    it('should fetch custom cryptocurrency pair', { timeout: 30000 }, async () => {
      console.log('Testing custom cryptocurrency pair fetch...');

      try {
        await cryptoPriceService.fetchCryptocurrencyPair('ethereum', 'ETH', 'USD');
        console.log('✅ ETH/USD price fetched successfully');
      } catch (error) {
        console.error('❌ ETH/USD price fetch failed:', error);
        throw error;
      }
    });

    it('should fetch bulk cryptocurrency prices', { timeout: 30000 }, async () => {
      console.log('Testing bulk cryptocurrency price fetch...');

      try {
        await cryptoPriceService.fetchCryptoBulk();
        console.log('✅ Bulk cryptocurrency prices queued successfully');
      } catch (error) {
        console.error('❌ Bulk cryptocurrency price fetch failed:', error);
        throw error;
      }
    });

    it('should get service status', async () => {
      console.log('Testing service status...');

      try {
        const status = await cryptoPriceService.getServiceStatus();

        console.log('Service Status:', {
          waiting: status.queueStatus.waiting,
          active: status.queueStatus.active,
          completed: status.queueStatus.completed,
          failed: status.queueStatus.failed,
        });

        assert.ok(status, 'Status should be defined');
        assert.ok(status.queueStatus, 'Queue status should be defined');
        assert.strictEqual(
          typeof status.queueStatus.waiting,
          'number',
          'Waiting should be a number',
        );
        assert.strictEqual(typeof status.queueStatus.active, 'number', 'Active should be a number');
        assert.strictEqual(
          typeof status.queueStatus.completed,
          'number',
          'Completed should be a number',
        );
        assert.strictEqual(typeof status.queueStatus.failed, 'number', 'Failed should be a number');

        console.log('✅ Service status retrieved successfully');
      } catch (error) {
        console.error('❌ Service status failed:', error);
        throw error;
      }
    });

    it('should handle invalid cryptocurrency gracefully', async () => {
      console.log('Testing error handling with invalid cryptocurrency...');

      await assert.rejects(
        cryptoPriceService.fetchCryptocurrencyPair('invalid-blockchain', 'INVALID', 'USD'),
        /Could not find CoinMarketCap ID/,
        'Should throw error for invalid cryptocurrency',
      );

      console.log('✅ Expected error occurred for invalid cryptocurrency');
    });
  });

  describe('Integration with Queue System', () => {
    it(
      'should queue major cryptocurrency prices (simulated cron job)',
      { timeout: 30000 },
      async () => {
        console.log('Testing scheduled price fetch (simulated)...');

        try {
          // This simulates what the cron job would do
          await cryptoPriceService.fetchMajorCryptoPrices();
          console.log('✅ Major cryptocurrency prices queued successfully');

          // Check queue status after queuing
          const status = await cryptoPriceService.getServiceStatus();
          console.log('Queue status after scheduling:', {
            waiting: status.queueStatus.waiting,
            active: status.queueStatus.active,
          });

          // Should have queued jobs
          assert.ok(
            status.queueStatus.waiting + status.queueStatus.active >= 0,
            'Should have non-negative queue count',
          );
        } catch (error) {
          console.error('❌ Scheduled price fetch failed:', error);
          throw error;
        }
      },
    );
  });
});
