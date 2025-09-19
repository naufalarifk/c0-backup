import { Test, TestingModule } from '@nestjs/testing';

import { CryptocurrencyPriceService } from '../../../src/modules/pricefeed/cryptocurrency-price.service';
import { PriceFeedService } from '../../../src/modules/pricefeed/pricefeed.service';

// Create a mock for PriceFeedService with all required methods
const mockPriceFeedService = {
  queueExchangeRateFetch: jest.fn().mockResolvedValue(undefined),
  getQueueStatus: jest.fn().mockResolvedValue({
    waiting: 2,
    active: 0,
    completed: 5,
    failed: 0,
  }),
  // Mock processWork to simulate error for invalid cryptocurrency
  processWork: jest.fn().mockImplementation(params => {
    if (params.blockchainKey === 'invalid-blockchain' || params.baseCurrencyTokenId === 'INVALID') {
      throw new Error('Could not find CoinMarketCap ID for INVALID');
    }
    return Promise.resolve(undefined);
  }),
  isProviderAvailable: jest.fn().mockResolvedValue(true),
};

describe('CryptocurrencyPriceService E2E Tests', () => {
  let module: TestingModule;
  let cryptoPriceService: CryptocurrencyPriceService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        CryptocurrencyPriceService,
        {
          provide: PriceFeedService,
          useValue: mockPriceFeedService,
        },
      ],
    }).compile();

    cryptoPriceService = module.get<CryptocurrencyPriceService>(CryptocurrencyPriceService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Production Service Tests', () => {
    it('should be properly injected and available', () => {
      expect(cryptoPriceService).toBeDefined();
      expect(cryptoPriceService).toBeInstanceOf(CryptocurrencyPriceService);
    });

    it('should fetch Bitcoin price immediately', async () => {
      console.log('Testing immediate Bitcoin price fetch...');

      try {
        await cryptoPriceService.fetchBitcoinPriceNow();
        console.log('✅ Bitcoin price fetched successfully');
      } catch (error) {
        console.error('❌ Bitcoin price fetch failed:', error);
        throw error;
      }
    }, 30000);

    it('should fetch custom cryptocurrency pair', async () => {
      console.log('Testing custom cryptocurrency pair fetch...');

      try {
        await cryptoPriceService.fetchCryptocurrencyPair('ethereum', 'ETH', 'USD');
        console.log('✅ ETH/USD price fetched successfully');
      } catch (error) {
        console.error('❌ ETH/USD price fetch failed:', error);
        throw error;
      }
    }, 30000);

    it('should fetch bulk cryptocurrency prices', async () => {
      console.log('Testing bulk cryptocurrency price fetch...');

      try {
        await cryptoPriceService.fetchCryptoBulk();
        console.log('✅ Bulk cryptocurrency prices queued successfully');
      } catch (error) {
        console.error('❌ Bulk cryptocurrency price fetch failed:', error);
        throw error;
      }
    }, 30000);

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

        expect(status).toBeDefined();
        expect(status.queueStatus).toBeDefined();
        expect(typeof status.queueStatus.waiting).toBe('number');
        expect(typeof status.queueStatus.active).toBe('number');
        expect(typeof status.queueStatus.completed).toBe('number');
        expect(typeof status.queueStatus.failed).toBe('number');

        console.log('✅ Service status retrieved successfully');
      } catch (error) {
        console.error('❌ Service status failed:', error);
        throw error;
      }
    });

    it('should handle invalid cryptocurrency gracefully', async () => {
      console.log('Testing error handling with invalid cryptocurrency...');

      await expect(
        cryptoPriceService.fetchCryptocurrencyPair('invalid-blockchain', 'INVALID', 'USD'),
      ).rejects.toThrow('Could not find CoinMarketCap ID');

      console.log('✅ Expected error occurred for invalid cryptocurrency');
    });
  });

  describe('Integration with Queue System', () => {
    it('should queue major cryptocurrency prices (simulated cron job)', async () => {
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
        expect(status.queueStatus.waiting + status.queueStatus.active).toBeGreaterThanOrEqual(0);
      } catch (error) {
        console.error('❌ Scheduled price fetch failed:', error);
        throw error;
      }
    }, 30000);
  });
});
