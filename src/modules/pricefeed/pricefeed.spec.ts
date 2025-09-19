import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { CoinMarketCapProvider } from './providers/coinmarketcap.provider';

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config = {
      PRICEFEED_API_KEY: 'test-api-key-123',
    };
    return config[key] || defaultValue;
  }),
};

describe('PriceFeed Unit Tests', () => {
  let module: TestingModule;
  let coinMarketCapProvider: CoinMarketCapProvider;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        CoinMarketCapProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    coinMarketCapProvider = module.get<CoinMarketCapProvider>(CoinMarketCapProvider);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('CoinMarketCap Provider', () => {
    it('should be instantiated correctly', () => {
      expect(coinMarketCapProvider).toBeDefined();
      expect(coinMarketCapProvider).toBeInstanceOf(CoinMarketCapProvider);
    });

    it('should initialize with correct configuration', () => {
      // Test that the provider was created with the correct config key
      expect(mockConfigService.get).toHaveBeenCalledWith('PRICEFEED_API_KEY', '');
    });

    it('should have required methods', () => {
      expect(typeof coinMarketCapProvider.isAvailable).toBe('function');
      expect(typeof coinMarketCapProvider.fetchExchangeRate).toBe('function');
    });

    // Note: Integration tests with real API calls should be in separate e2e test files
    // This unit test focuses on testing the provider's structure and mocked behavior
  });
});
