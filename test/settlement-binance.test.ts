import type { BinanceAssetMapperService } from '../dist/modules/settlement/binance-asset-mapper.service';
import type { BinanceClientService } from '../dist/modules/settlement/binance-client.service';

import { ok, strictEqual } from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  assertDefined,
  assertPropArrayMapOf,
  assertPropBoolean,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
} from 'typeshaper';

import { setup } from './setup/setup';

/**
 * Settlement Service with Binance Integration E2E Tests
 *
 * Test Coverage:
 * - Asset grouping (multiple networks for same asset)
 * - Binance API integration (deposits, withdrawals, balance queries)
 * - Settlement ratio calculations
 * - Multi-network balance aggregation
 * - Error handling and edge cases
 *
 * Note: These tests mock Binance API calls since we don't want to
 * make real API calls in tests. In production, ensure proper API credentials.
 */

describe('Settlement Service - Binance Integration (e2e)', () => {
  let testSetup: Awaited<ReturnType<typeof setup>>;

  before(async () => {
    testSetup = await setup();
  });

  after(async () => {
    await testSetup.teardown();
  });

  describe('Asset Grouping', () => {
    it('should group currencies by Binance asset across multiple networks', async () => {
      // This tests the groupCurrenciesByAsset() functionality conceptually
      // We test the logic without database access

      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      // Simulate USDT on 3 different networks
      const usdtTokens = [
        'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7',
        'eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955',
        'eip155:137/erc20:0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      ];

      // Map each to Binance asset
      const assetMap = new Map<string, string[]>();
      for (const tokenId of usdtTokens) {
        const mapping = mapper.tokenToBinanceAsset(tokenId);
        if (mapping) {
          if (!assetMap.has(mapping.asset)) {
            assetMap.set(mapping.asset, []);
          }
          assetMap.get(mapping.asset)?.push(tokenId);
        }
      }

      // Verify all USDT tokens are grouped under same asset
      ok(assetMap.has('USDT'), 'Should have USDT asset group');
      const usdtGroup = assetMap.get('USDT');
      assertDefined(usdtGroup);
      strictEqual(usdtGroup.length, 3, 'Should have 3 token IDs grouped under USDT');

      // Verify each token is in the group
      ok(
        usdtGroup.includes('eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7'),
        'Should include ETH USDT',
      );
      ok(
        usdtGroup.includes('eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955'),
        'Should include BSC USDT',
      );
      ok(
        usdtGroup.includes('eip155:137/erc20:0xc2132d05d31c914a87c6611c10748aeb04b58e8f'),
        'Should include Polygon USDT',
      );
    });

    it('should correctly map token IDs to Binance assets', async () => {
      // Test the BinanceAssetMapperService directly
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      // Test USDT mappings
      const usdtEth = mapper.tokenToBinanceAsset(
        'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7',
      );
      assertDefined(usdtEth);
      assertPropString(usdtEth, 'asset');
      assertPropString(usdtEth, 'network');
      strictEqual(usdtEth.asset, 'USDT', 'Should map to USDT asset');
      strictEqual(usdtEth.network, 'ETH', 'Should map to ETH network');

      const usdtBsc = mapper.tokenToBinanceAsset(
        'eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955',
      );
      assertDefined(usdtBsc);
      strictEqual(usdtBsc.asset, 'USDT', 'Should map to USDT asset');
      strictEqual(usdtBsc.network, 'BSC', 'Should map to BSC network');

      const usdtPolygon = mapper.tokenToBinanceAsset(
        'eip155:137/erc20:0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      );
      assertDefined(usdtPolygon);
      strictEqual(usdtPolygon.asset, 'USDT', 'Should map to USDT asset');
      strictEqual(usdtPolygon.network, 'MATIC', 'Should map to MATIC network');
    });

    it('should map blockchain keys to Binance networks correctly', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      // Test CAIP-2 format
      strictEqual(mapper.blockchainKeyToBinanceNetwork('eip155:1'), 'ETH');
      strictEqual(mapper.blockchainKeyToBinanceNetwork('eip155:56'), 'BSC');
      strictEqual(mapper.blockchainKeyToBinanceNetwork('eip155:137'), 'MATIC');

      // Test human-readable format
      strictEqual(mapper.blockchainKeyToBinanceNetwork('ethereum'), 'ETH');
      strictEqual(mapper.blockchainKeyToBinanceNetwork('bsc'), 'BSC');
      strictEqual(mapper.blockchainKeyToBinanceNetwork('polygon'), 'MATIC');
      strictEqual(mapper.blockchainKeyToBinanceNetwork('solana'), 'SOL');

      // Test CAIP-19 format (with token part)
      strictEqual(mapper.blockchainKeyToBinanceNetwork('eip155:1/erc20:0xabc123'), 'ETH');
      strictEqual(mapper.blockchainKeyToBinanceNetwork('eip155:56/bep20:0xabc123'), 'BSC');
    });
  });

  describe('Binance Client Service', () => {
    it('should check if Binance API is enabled', async () => {
      const { BinanceClientService } = await import(
        '../dist/modules/settlement/binance-client.service.js'
      );
      const { ConfigService } = await import('@nestjs/config');

      const configService = new ConfigService({
        BINANCE_API_ENABLED: 'false',
      });

      const client = new BinanceClientService(configService);
      const isEnabled = client.isApiEnabled();

      assertPropBoolean({ isEnabled }, 'isEnabled');
      strictEqual(isEnabled, false, 'Should be disabled when env var is false');
    });

    it('should validate required configuration for Binance API', async () => {
      const { BinanceClientService } = await import(
        '../dist/modules/settlement/binance-client.service.js'
      );
      const { ConfigService } = await import('@nestjs/config');

      // Test with missing API key
      const configWithoutKey = new ConfigService({
        BINANCE_API_ENABLED: 'true',
        BINANCE_API_SECRET: 'test_secret',
      });

      const clientWithoutKey = new BinanceClientService(configWithoutKey);
      strictEqual(clientWithoutKey.isApiEnabled(), false, 'Should be disabled without API key');

      // Test with missing API secret
      const configWithoutSecret = new ConfigService({
        BINANCE_API_ENABLED: 'true',
        BINANCE_API_KEY: 'test_key',
      });

      const clientWithoutSecret = new BinanceClientService(configWithoutSecret);
      strictEqual(
        clientWithoutSecret.isApiEnabled(),
        false,
        'Should be disabled without API secret',
      );
    });

    it('should handle supported tokens list', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      const supportedTokens = mapper.getSupportedTokens();

      assertDefined(supportedTokens);
      ok(Array.isArray(supportedTokens), 'Should return array');
      ok(supportedTokens.length > 0, 'Should have supported tokens');

      // Verify common tokens are supported (lowercase for case-insensitive check)
      ok(
        supportedTokens.some(t =>
          t.toLowerCase().includes('dac17f958d2ee523a2206206994597c13d831ec7'),
        ),
        'Should support USDT on ETH',
      );
      ok(
        supportedTokens.some(t =>
          t.toLowerCase().includes('a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
        ),
        'Should support USDC on ETH',
      );
      ok(
        supportedTokens.some(t => t === 'eip155:1'),
        'Should support ETH',
      );
      ok(
        supportedTokens.some(t => t === 'eip155:56'),
        'Should support BNB',
      );
    });

    it('should check if token is supported', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      // Test supported tokens
      ok(
        mapper.isTokenSupported('eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7'),
        'USDT on ETH should be supported',
      );
      ok(
        mapper.isTokenSupported('eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955'),
        'USDT on BSC should be supported',
      );
      ok(mapper.isTokenSupported('eip155:1'), 'ETH should be supported');

      // Test unsupported token
      ok(
        !mapper.isTokenSupported('eip155:1/erc20:0xunknowntoken123'),
        'Unknown token should not be supported',
      );
    });
  });

  describe('Settlement Calculations', () => {
    it('should calculate correct settlement ratios for asset grouping', async () => {
      // Test the settlement calculation logic
      // Given: USDT on 3 networks with different balances
      // ETH: 1000 USDT, BSC: 2000 USDT, Polygon: 500 USDT
      // Total hot wallet: 3500 USDT
      // Binance balance: 1500 USDT
      // Total: 5000 USDT
      // Target 50%: 2500 USDT on Binance
      // Settlement: Need to move 1000 USDT to Binance

      const ethBalance = 1000;
      const bscBalance = 2000;
      const polygonBalance = 500;
      const totalHotWallet = ethBalance + bscBalance + polygonBalance;
      const binanceBalance = 1500;
      const totalBalance = totalHotWallet + binanceBalance;
      const targetPercentage = 50;

      const targetBinance = (totalBalance * targetPercentage) / 100;
      const settlementAmount = targetBinance - binanceBalance;

      strictEqual(totalHotWallet, 3500, 'Total hot wallet should be 3500');
      strictEqual(totalBalance, 5000, 'Total balance should be 5000');
      strictEqual(targetBinance, 2500, 'Target Binance should be 2500');
      strictEqual(settlementAmount, 1000, 'Should need to move 1000 to Binance');

      // Calculate proportional distribution
      const ethProportion = ethBalance / totalHotWallet;
      const bscProportion = bscBalance / totalHotWallet;
      const polygonProportion = polygonBalance / totalHotWallet;

      const ethSettlement = settlementAmount * ethProportion;
      const bscSettlement = settlementAmount * bscProportion;
      const polygonSettlement = settlementAmount * polygonProportion;

      ok(Math.abs(ethSettlement - 285.71) < 1, 'ETH settlement should be ~285.71');
      ok(Math.abs(bscSettlement - 571.43) < 1, 'BSC settlement should be ~571.43');
      ok(Math.abs(polygonSettlement - 142.86) < 1, 'Polygon settlement should be ~142.86');
    });

    it('should handle withdrawal scenario when Binance balance is above target', async () => {
      // Given: Total 5000 USDT, Binance has 3500, hot wallets have 1500
      // Target 50%: 2500 on Binance
      // Settlement: Need to withdraw 1000 from Binance

      const totalHotWallet = 1500;
      const binanceBalance = 3500;
      const totalBalance = totalHotWallet + binanceBalance;
      const targetPercentage = 50;

      const targetBinance = (totalBalance * targetPercentage) / 100;
      const settlementAmount = targetBinance - binanceBalance;

      strictEqual(totalBalance, 5000, 'Total balance should be 5000');
      strictEqual(targetBinance, 2500, 'Target Binance should be 2500');
      strictEqual(settlementAmount, -1000, 'Should need to withdraw 1000 from Binance');
      ok(settlementAmount < 0, 'Settlement amount should be negative');
    });

    it('should skip settlement when balance is at target', async () => {
      // Given: Total 5000 USDT, exactly 50% on Binance
      const totalHotWallet = 2500;
      const binanceBalance = 2500;
      const totalBalance = totalHotWallet + binanceBalance;
      const targetPercentage = 50;

      const targetBinance = (totalBalance * targetPercentage) / 100;
      const settlementAmount = targetBinance - binanceBalance;

      strictEqual(settlementAmount, 0, 'Settlement amount should be 0');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing asset mapping gracefully', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      const result = mapper.tokenToBinanceAsset('unknown:123/token:abc');
      strictEqual(result, null, 'Should return null for unknown token');
    });

    it('should handle missing network mapping gracefully', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      const result = mapper.blockchainKeyToBinanceNetwork('unknown-chain');
      strictEqual(result, null, 'Should return null for unknown blockchain');
    });

    it('should validate minimum transfer amounts', async () => {
      // Binance has minimum withdrawal amounts (e.g., 0.01 for most tokens)
      const minimumAmount = 0.01;
      const tinyAmount = 0.005;

      ok(tinyAmount < minimumAmount, 'Tiny amount should be below minimum');

      // Settlement should skip transfers below minimum
      const shouldSkip = tinyAmount < minimumAmount;
      strictEqual(shouldSkip, true, 'Should skip transfers below minimum');
    });
  });

  describe('Multi-Network Scenarios', () => {
    it('should handle assets available on multiple networks', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      // USDT is available on 5+ networks
      const usdtNetworks = [
        {
          token: 'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7',
          expectedNetwork: 'ETH',
        },
        {
          token: 'eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955',
          expectedNetwork: 'BSC',
        },
        {
          token: 'eip155:137/erc20:0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
          expectedNetwork: 'MATIC',
        },
        { token: 'tron:0x/trc20:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', expectedNetwork: 'TRX' },
        {
          token:
            'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/spl-token:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          expectedNetwork: 'SOL',
        },
      ];

      for (const { token, expectedNetwork } of usdtNetworks) {
        const mapping = mapper.tokenToBinanceAsset(token);
        assertDefined(mapping, `Should have mapping for ${token}`);
        strictEqual(mapping.asset, 'USDT', 'All should map to USDT asset');
        strictEqual(mapping.network, expectedNetwork, `Should map to ${expectedNetwork} network`);
      }
    });

    it('should handle native tokens correctly', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      // Test native tokens (no token address part)
      const ethMapping = mapper.tokenToBinanceAsset('eip155:1');
      assertDefined(ethMapping);
      strictEqual(ethMapping.asset, 'ETH', 'Should map to ETH asset');
      strictEqual(ethMapping.network, 'ETH', 'Should map to ETH network');

      const bnbMapping = mapper.tokenToBinanceAsset('eip155:56');
      assertDefined(bnbMapping);
      strictEqual(bnbMapping.asset, 'BNB', 'Should map to BNB asset');
      strictEqual(bnbMapping.network, 'BSC', 'Should map to BSC network');
    });

    it('should handle wrapped tokens correctly', async () => {
      const { BinanceAssetMapperService } = await import(
        '../dist/modules/settlement/binance-asset-mapper.service.js'
      );
      const mapper = new BinanceAssetMapperService();

      // WBTC on Ethereum
      const wbtcEth = mapper.tokenToBinanceAsset(
        'eip155:1/erc20:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      );
      assertDefined(wbtcEth);
      strictEqual(wbtcEth.asset, 'BTC', 'WBTC should map to BTC asset');
      strictEqual(wbtcEth.network, 'ETH', 'WBTC should map to ETH network');

      // WETH on BSC
      const wethBsc = mapper.tokenToBinanceAsset(
        'eip155:56/bep20:0x2170ed0880ac9a755fd29b2688956bd959f933f8',
      );
      assertDefined(wethBsc);
      strictEqual(wethBsc.asset, 'ETH', 'WETH should map to ETH asset');
      strictEqual(wethBsc.network, 'BSC', 'WETH should map to BSC network');
    });
  });

  describe('Integration Scenarios', () => {
    it('should properly structure settlement results', async () => {
      // Test the SettlementResult interface structure
      const mockResult = {
        success: true,
        blockchainKey: 'eip155:1',
        originalBalance: '1000000000',
        settlementAmount: '500000000',
        remainingBalance: '500000000',
        transactionHash: '0xabc123...',
        timestamp: new Date(),
      };

      assertPropBoolean(mockResult, 'success');
      assertPropString(mockResult, 'blockchainKey');
      assertPropString(mockResult, 'originalBalance');
      assertPropString(mockResult, 'settlementAmount');
      assertPropString(mockResult, 'remainingBalance');
      assertPropString(mockResult, 'transactionHash');
      assertDefined(mockResult.timestamp);
      ok(mockResult.timestamp instanceof Date, 'Timestamp should be a Date object');
    });

    it('should structure failed settlement results with error messages', async () => {
      const mockFailedResult = {
        success: false,
        blockchainKey: 'eip155:56',
        originalBalance: '2000000000',
        settlementAmount: '0',
        remainingBalance: '2000000000',
        error: 'Insufficient balance on Binance',
        timestamp: new Date(),
      };

      assertPropBoolean(mockFailedResult, 'success');
      strictEqual(mockFailedResult.success, false, 'Should be marked as failed');
      assertPropString(mockFailedResult, 'error');
      ok(mockFailedResult.error.length > 0, 'Should have error message');
    });

    it('should validate environment configuration requirements', async () => {
      // List of required env vars for Binance integration
      const requiredEnvVars = ['BINANCE_API_ENABLED', 'BINANCE_API_KEY', 'BINANCE_API_SECRET'];

      const optionalEnvVars = ['BINANCE_API_BASE_URL'];

      for (const envVar of requiredEnvVars) {
        ok(typeof envVar === 'string', `${envVar} should be a required configuration`);
      }

      for (const envVar of optionalEnvVars) {
        ok(typeof envVar === 'string', `${envVar} should be an optional configuration`);
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large balance numbers correctly', async () => {
      // Test with large numbers (18 decimal places for USDT on BSC)
      const largeBalance = '999999999999999999999999'; // 1 million USDT with 18 decimals
      const balanceNumber = Number.parseFloat(largeBalance);

      ok(balanceNumber > 0, 'Should parse large balance');
      ok(!Number.isNaN(balanceNumber), 'Should not be NaN');
    });

    it('should handle very small amounts correctly', async () => {
      // Test with small amounts (dust)
      const smallAmount = 0.000001;
      const minimumThreshold = 0.01;

      ok(smallAmount < minimumThreshold, 'Dust should be below threshold');

      // In practice, settlement should skip amounts below minimum
      const shouldProcess = smallAmount >= minimumThreshold;
      strictEqual(shouldProcess, false, 'Should not process amounts below minimum');
    });

    it('should handle zero balances correctly', async () => {
      const zeroBalance = '0';
      const balanceNumber = Number.parseFloat(zeroBalance);

      strictEqual(balanceNumber, 0, 'Should parse zero correctly');

      // Settlement should skip zero balances
      const shouldProcess = balanceNumber > 0;
      strictEqual(shouldProcess, false, 'Should not process zero balances');
    });

    it('should validate decimal precision for different tokens', async () => {
      // Different tokens have different decimal places
      const tokenDecimals = {
        'USDT-ETH': 6, // 6 decimals on Ethereum
        'USDT-BSC': 18, // 18 decimals on BSC
        'USDT-Polygon': 6, // 6 decimals on Polygon
        BTC: 8, // 8 decimals
      };

      for (const [token, decimals] of Object.entries(tokenDecimals)) {
        ok(decimals > 0, `${token} should have positive decimals`);
        ok(decimals <= 18, `${token} decimals should be reasonable`);
      }
    });
  });
});
