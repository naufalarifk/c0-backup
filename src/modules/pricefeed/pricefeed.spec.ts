import type { ConfigService } from '@nestjs/config';

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { CoinMarketCapProvider } from './providers/coinmarketcap.provider';

// Create a mock ConfigService
const getMock = mock.fn((key: string, defaultValue?: string) => {
  const config: Record<string, string> = {
    PRICEFEED_API_KEY: 'test-api-key-123',
  };
  return config[key] || defaultValue;
});

const mockConfigService = {
  get: getMock,
};

describe('PriceFeed Unit Tests', () => {
  let coinMarketCapProvider: CoinMarketCapProvider;

  beforeEach(() => {
    // Reset mock call counts
    getMock.mock.resetCalls();

    // Direct instantiation without NestJS DI
    coinMarketCapProvider = new CoinMarketCapProvider(
      mockConfigService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    coinMarketCapProvider = undefined!;
  });

  describe('CoinMarketCap Provider', () => {
    it('should be instantiated correctly', () => {
      assert.ok(coinMarketCapProvider, 'CoinMarketCapProvider should be defined');
      assert.ok(
        coinMarketCapProvider instanceof CoinMarketCapProvider,
        'Should be instance of CoinMarketCapProvider',
      );
    });

    it('should initialize with correct configuration', () => {
      // Test that the provider was created with the correct config key
      assert.strictEqual(getMock.mock.callCount(), 1, 'Config service get should be called once');
      assert.deepStrictEqual(
        getMock.mock.calls[0].arguments,
        ['PRICEFEED_API_KEY', ''],
        'Should call with correct arguments',
      );
    });

    it('should have required methods', () => {
      assert.strictEqual(
        typeof coinMarketCapProvider.isAvailable,
        'function',
        'isAvailable should be a function',
      );
      assert.strictEqual(
        typeof coinMarketCapProvider.fetchExchangeRate,
        'function',
        'fetchExchangeRate should be a function',
      );
    });

    // Note: Integration tests with real API calls should be in separate e2e test files
    // This unit test focuses on testing the provider's structure and mocked behavior
  });
});
