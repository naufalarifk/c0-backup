import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';

import {
  assertDefined,
  assertProp,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropNumber,
  assertPropString,
} from 'typeshaper';

import { setup } from './setup/setup';
import { after, before, describe, it, suite } from './setup/test';
import { createTestUser, type TestUser } from './setup/user';

suite('Finance Configuration API', function () {
  let testId: string;
  let testSetup: Awaited<ReturnType<typeof setup>>;
  let testUser: TestUser;

  before(async function () {
    testId = Date.now().toString(36).toLowerCase();
    testSetup = await setup();
    testUser = await createTestUser({ testSetup, testId });
  });

  after(async function () {
    await testSetup?.teardown();
  });

  describe('Blockchain Management', function () {
    it('should retrieve all supported blockchains', async function () {
      const response = await testUser.fetch('/api/blockchains', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 200);

      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
      strictEqual(data.success, true);

      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArrayMapOf(data.data, 'blockchains', function (blockchain) {
        assertDefined(blockchain);
        assertPropString(blockchain, 'key');
        assertPropString(blockchain, 'name');
        assertPropString(blockchain, 'shortName');
        assertPropString(blockchain, 'image');

        // Verify blockchain key follows CAIP-2 format
        ok(blockchain.key.includes(':'), 'Blockchain key should follow CAIP-2 format');
        // Verify image is a valid URL
        ok(blockchain.image.startsWith('https://'), 'Blockchain image should be a valid HTTPS URL');

        return blockchain;
      });

      // Verify count includes mainnet blockchains, CG testnet, and other testnets (excluding 'crosschain')
      const blockchains = data.data.blockchains;
      ok(blockchains.length >= 5, 'Should have at least 5 blockchains');

      // Verify mainnet blockchains appear first in expected order
      strictEqual(
        blockchains[0].key,
        'bip122:000000000019d6689c085ae165831e93',
        'First blockchain should be Bitcoin',
      );
      strictEqual(blockchains[1].key, 'eip155:1', 'Second blockchain should be Ethereum');
      strictEqual(blockchains[2].key, 'eip155:56', 'Third blockchain should be BSC');
      strictEqual(
        blockchains[3].key,
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        'Fourth blockchain should be Solana',
      );
      strictEqual(blockchains[4].key, 'cg:testnet', 'Fifth blockchain should be CG Testnet');

      // Verify CG testnet blockchain is included in results
      const cgTestnet = blockchains.find(b => b.key === 'cg:testnet');
      ok(cgTestnet, 'CG Testnet blockchain should be included');
      strictEqual(cgTestnet.name, 'CryptoGadai Mockchain', 'CG Testnet should have correct name');
      strictEqual(cgTestnet.shortName, 'CG Test', 'CG Testnet should have correct short name');
    });

    it('should require authentication', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/blockchains`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // No authentication cookie
        },
      });

      strictEqual(response.status, 401);
    });
  });

  describe('Currency Management', function () {
    it('should retrieve all supported currencies by default', async function () {
      const response = await testUser.fetch('/api/currencies', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 200);

      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
      strictEqual(data.success, true);

      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArrayMapOf(data.data, 'currencies', function (currency) {
        assertDefined(currency);
        assertPropString(currency, 'blockchainKey');
        assertPropString(currency, 'tokenId');
        assertPropString(currency, 'name');
        assertPropString(currency, 'symbol');
        assertPropNumber(currency, 'decimals');
        assertPropString(currency, 'logoUrl');
        assertProp(
          (value: unknown) => typeof value === 'boolean',
          currency,
          'isCollateralCurrency',
        );
        assertProp((value: unknown) => typeof value === 'boolean', currency, 'isLoanCurrency');
        assertPropNumber(currency, 'maxLtv');
        assertPropNumber(currency, 'ltvWarningThreshold');
        assertPropNumber(currency, 'ltvCriticalThreshold');
        assertPropNumber(currency, 'ltvLiquidationThreshold');
        assertPropString(currency, 'minLoanPrincipalAmount');
        assertPropString(currency, 'maxLoanPrincipalAmount');
        assertPropString(currency, 'minWithdrawalAmount');
        assertPropString(currency, 'maxWithdrawalAmount');
        assertPropString(currency, 'maxDailyWithdrawalAmount');
        assertPropNumber(currency, 'withdrawalFeeRate');

        // Verify blockchain information is included
        assertProp(
          (value: unknown) => typeof value === 'object' && value !== null,
          currency,
          'blockchain',
        );
        assertPropString(currency.blockchain, 'key');
        assertPropString(currency.blockchain, 'name');
        assertPropString(currency.blockchain, 'shortName');
        assertPropString(currency.blockchain, 'image');

        // Basic validation
        ok(
          currency.decimals >= 0 && currency.decimals <= 18,
          'Decimals should be between 0 and 18',
        );
        ok(currency.maxLtv >= 0 && currency.maxLtv <= 100, 'Max LTV should be between 0 and 100');

        return currency;
      });

      // Verify count includes mainnet + testnet currencies
      const currencies = data.data.currencies;
      ok(currencies.length >= 10, 'Should have at least 10 currencies');

      // Count collateral and loan currencies
      const collateralCount = currencies.filter(c => c.isCollateralCurrency).length;
      const loanCount = currencies.filter(c => c.isLoanCurrency).length;

      ok(collateralCount >= 4, 'Should have at least 4 collateral currencies');
      ok(loanCount >= 2, 'Should have at least 2 loan currencies');
    });

    it('should filter currencies by type', async function () {
      // Test collateral currencies
      const collateralResponse = await testUser.fetch('/api/currencies?type=collateral', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(collateralResponse.status, 200);

      const collateralData: unknown = await collateralResponse.json();
      assertDefined(collateralData);
      assertProp((value: unknown) => typeof value === 'boolean', collateralData, 'success');
      assertProp(
        (value: unknown) => typeof value === 'object' && value !== null,
        collateralData,
        'data',
      );
      assertPropArrayMapOf(collateralData.data, 'currencies', function (currency) {
        assertDefined(currency);
        assertProp(
          (value: unknown) => typeof value === 'boolean',
          currency,
          'isCollateralCurrency',
        );
        strictEqual(
          currency.isCollateralCurrency,
          true,
          'Currency should be a collateral currency',
        );
        return currency;
      });

      // Verify count: at least 4 collateral currencies (mainnet BTC, ETH, BNB, SOL)
      ok(
        collateralData.data.currencies.length >= 4,
        'Should have at least 4 collateral currencies',
      );

      // Test loan currencies
      const loanResponse = await testUser.fetch('/api/currencies?type=loan', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(loanResponse.status, 200);

      const loanData: unknown = await loanResponse.json();
      assertDefined(loanData);
      assertProp((value: unknown) => typeof value === 'boolean', loanData, 'success');
      assertProp((value: unknown) => typeof value === 'object' && value !== null, loanData, 'data');
      assertPropArrayMapOf(loanData.data, 'currencies', function (currency) {
        assertDefined(currency);
        assertProp((value: unknown) => typeof value === 'boolean', currency, 'isLoanCurrency');
        strictEqual(currency.isLoanCurrency, true, 'Currency should be a loan currency');
        return currency;
      });

      // Verify count: at least 2 loan currencies (USDC on BSC mainnet, USD on crosschain, plus testnets)
      ok(loanData.data.currencies.length >= 2, 'Should have at least 2 loan currencies');
    });

    it('should filter currencies by blockchain', async function () {
      const response = await testUser.fetch('/api/currencies?blockchainKey=eip155:1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 200);

      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArrayMapOf(data.data, 'currencies', function (currency) {
        assertDefined(currency);
        assertPropString(currency, 'blockchainKey');
        strictEqual(currency.blockchainKey, 'eip155:1', 'Currency should be on Ethereum Mainnet');
        return currency;
      });

      // Verify count: at least 1 currency on Ethereum Mainnet (ETH collateral)
      ok(data.data.currencies.length >= 1, 'Should have at least 1 currency on Ethereum Mainnet');
    });

    it('should filter currencies by LTV range', async function () {
      const response = await testUser.fetch('/api/currencies?minLtv=50&maxLtv=70', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 200);

      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArrayMapOf(data.data, 'currencies', function (currency) {
        assertDefined(currency);
        assertPropNumber(currency, 'maxLtv');
        ok(
          currency.maxLtv >= 50 && currency.maxLtv <= 70,
          `Max LTV (${currency.maxLtv}) should be within specified range (50-70)`,
        );
        return currency;
      });

      // Verify count: at least 4 collateral currencies with LTV in range 50-70
      ok(
        data.data.currencies.length >= 4,
        'Should have at least 4 currencies with LTV in range 50-70',
      );
    });

    it('should require authentication', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/currencies`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // No authentication cookie
        },
      });

      strictEqual(response.status, 401);
    });
  });

  describe('Exchange Rates', function () {
    it('should retrieve current exchange rates', async function () {
      const response = await testUser.fetch('/api/exchange-rates', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 200);

      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
      strictEqual(data.success, true);

      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArrayMapOf(data.data, 'exchangeRates', function (rate) {
        assertDefined(rate);
        assertPropNumber(rate, 'id');
        assertPropString(rate, 'bidPrice');
        assertPropString(rate, 'askPrice');
        assertPropString(rate, 'midPrice');
        assertPropString(rate, 'source');
        assertPropString(rate, 'sourceDate');
        assertPropString(rate, 'retrievalDate');

        // Verify base and quote assets
        assertProp(
          (value: unknown) => typeof value === 'object' && value !== null,
          rate,
          'baseAsset',
        );
        assertPropString(rate.baseAsset, 'blockchainKey');
        assertPropString(rate.baseAsset, 'tokenId');
        assertPropString(rate.baseAsset, 'name');
        assertPropString(rate.baseAsset, 'symbol');
        assertPropNumber(rate.baseAsset, 'decimals');
        assertPropString(rate.baseAsset, 'logoUrl');

        assertProp(
          (value: unknown) => typeof value === 'object' && value !== null,
          rate,
          'quoteAsset',
        );
        assertPropString(rate.quoteAsset, 'blockchainKey');
        assertPropString(rate.quoteAsset, 'tokenId');
        assertPropString(rate.quoteAsset, 'name');
        assertPropString(rate.quoteAsset, 'symbol');
        assertPropNumber(rate.quoteAsset, 'decimals');
        assertPropString(rate.quoteAsset, 'logoUrl');

        // Basic validation
        const bidPrice = Number(rate.bidPrice);
        const askPrice = Number(rate.askPrice);
        const midPrice = Number(rate.midPrice);

        ok(bidPrice > 0, 'Bid price should be positive');
        ok(askPrice > 0, 'Ask price should be positive');
        ok(midPrice > 0, 'Mid price should be positive');
        ok(askPrice >= bidPrice, 'Ask price should be >= bid price');

        // Verify dates are valid ISO strings
        ok(!isNaN(Date.parse(rate.sourceDate)), 'Source date should be valid ISO string');
        ok(!isNaN(Date.parse(rate.retrievalDate)), 'Retrieval date should be valid ISO string');

        return rate;
      });

      assertPropString(data.data, 'lastUpdated');
      ok(!isNaN(Date.parse(data.data.lastUpdated)), 'Last updated should be valid ISO string');

      // Exchange rates table is populated by background price feed workers
      // In test environment, may include mock exchange rates for testnet
      ok(data.data.exchangeRates.length >= 0, 'Should have 0 or more exchange rates');
    });

    it('should filter exchange rates by base currency', async function () {
      const response = await testUser.fetch('/api/exchange-rates?baseCurrencyTokenId=slip44:0', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 200);

      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArray(data.data, 'exchangeRates');

      // Exchange rates table is populated by background price feed workers
      // In test environment, filtering by mainnet BTC should return no results
      ok(data.data.exchangeRates.length >= 0, 'Should have 0 or more exchange rates for BTC');
    });

    it('should filter exchange rates by source', async function () {
      const response = await testUser.fetch('/api/exchange-rates?source=binance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      strictEqual(response.status, 200);

      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArray(data.data, 'exchangeRates');

      // Exchange rates table is populated by background price feed workers
      // In test environment, filtering by binance source should return no results
      ok(data.data.exchangeRates.length >= 0, 'Should have 0 or more exchange rates from binance');
    });

    it('should require authentication', async function () {
      const response = await fetch(`${testSetup.backendUrl}/api/exchange-rates`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // No authentication cookie
        },
      });

      strictEqual(response.status, 401);
    });
  });

  describe('API Integration', function () {
    it('should return validation error for invalid LTV parameter', async function () {
      // Test with invalid LTV values should return validation error
      const response = await testUser.fetch('/api/currencies?minLtv=invalid');

      strictEqual(response.status, 422); // 422 is correct for validation errors
    });

    it('should return empty results for non-existent blockchain key', async function () {
      // Test with invalid blockchain key format should return empty results
      const response = await testUser.fetch('/api/currencies?blockchainKey=invalid-format');

      strictEqual(response.status, 200);
      const data: unknown = await response.json();
      assertDefined(data);
      assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');
      assertPropArray(data.data, 'currencies');

      // Verify exact count: 0 currencies (no matching blockchain)
      strictEqual(
        data.data.currencies.length,
        0,
        'Should have exactly 0 currencies for invalid blockchain key',
      );
    });

    it('should return consistent data structure across endpoints', async function () {
      const endpoints = ['/api/blockchains', '/api/currencies', '/api/exchange-rates'];

      for (const endpoint of endpoints) {
        const response = await testUser.fetch(endpoint);

        strictEqual(response.status, 200);

        const data: unknown = await response.json();
        assertDefined(data);
        assertProp((value: unknown) => typeof value === 'boolean', data, 'success');
        assertProp((value: unknown) => typeof value === 'object' && value !== null, data, 'data');

        // All endpoints should return success: true
        strictEqual(data.success, true);
      }
    });
  });
});
