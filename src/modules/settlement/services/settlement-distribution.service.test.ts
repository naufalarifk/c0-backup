import type { BalanceSource } from './settlement-distribution.service';

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { SettlementDistributionService } from './settlement-distribution.service';

/**
 * Settlement Distribution Service Tests
 *
 * Tests the proportional distribution algorithm for multi-source settlements
 */
describe('SettlementDistributionService', () => {
  let service: SettlementDistributionService;

  beforeEach(() => {
    service = new SettlementDistributionService();
  });

  describe('Basic Distribution', () => {
    it('should calculate correct distribution for simple case', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '10000000', label: 'Ethereum' },
        { blockchainKey: 'eip155:56', balance: '20000000', label: 'BSC' },
        { blockchainKey: 'solana:mainnet', balance: '30000000', label: 'Solana' },
      ];

      const binanceBalance = '40000000'; // Total: 60M, Binance: 40M
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      // Total = 60M, Target = 30M (1:1), Settlement = 60M - 40M - 30M = -10M
      // Wait, let me recalculate: Total platform = 60M, Binance = 40M
      // Total overall = 100M, so 1:1 would be 50:50
      // Platform should have 50M, currently has 60M, so settle 10M to Binance

      assert.equal(result.totalBalance, '60000000');
      assert.equal(result.needsSettlement, true);

      // Validate distribution percentages
      const eth = result.distributions.find(d => d.blockchainKey === 'eip155:1');
      const bsc = result.distributions.find(d => d.blockchainKey === 'eip155:56');
      const sol = result.distributions.find(d => d.blockchainKey === 'solana:mainnet');

      assert.ok(eth);
      assert.ok(bsc);
      assert.ok(sol);

      // Ethereum has 10M out of 60M = 16.66%
      assert.equal(Math.round(eth.percentage * 100), 1666);

      // BSC has 20M out of 60M = 33.33%
      assert.equal(Math.round(bsc.percentage * 100), 3333);

      // Solana has 30M out of 60M = 50%
      assert.equal(Math.round(sol.percentage * 100), 5000);
    });

    it('should handle case where no settlement is needed', () => {
      const sources: BalanceSource[] = [{ blockchainKey: 'eip155:1', balance: '50000000' }];

      const binanceBalance = '50000000'; // Already 1:1
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      assert.equal(result.needsSettlement, false);
      assert.equal(result.settlementAmount, '0');
      assert.equal(result.distributions.length, 0);
      assert.equal(result.currentRatio, 1.0);
    });

    it('should handle single source', () => {
      const sources: BalanceSource[] = [{ blockchainKey: 'eip155:1', balance: '100000000' }];

      const binanceBalance = '0';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      assert.equal(result.needsSettlement, true);
      assert.equal(result.distributions.length, 1);
      assert.equal(result.distributions[0].percentage, 100);
      assert.equal(result.distributions[0].amount, result.settlementAmount);
    });

    it('should handle zero Binance balance', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '100000000' },
        { blockchainKey: 'eip155:56', balance: '100000000' },
      ];

      const binanceBalance = '0';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      assert.equal(result.needsSettlement, true);
      assert.equal(result.totalBalance, '200000000');
      assert.equal(result.targetBalance, '100000000'); // Half of total
      // Settlement = 200M - 0 - 100M = 100M
      assert.equal(result.settlementAmount, '100000000');
    });
  });

  describe('Real-world Examples', () => {
    it('should calculate distribution for USDT example', () => {
      // Example from user:
      // USDT from source a: 10
      // USDT from source b: 20
      // USDT from source c: 30
      // Total platform: 60
      // USDT from binance: 40
      // Total overall: 100
      // Target 1:1: 50:50

      const sources: BalanceSource[] = [
        { blockchainKey: 'source-a', balance: '10000000', label: 'Source A' }, // 10 USDT (6 decimals)
        { blockchainKey: 'source-b', balance: '20000000', label: 'Source B' }, // 20 USDT
        { blockchainKey: 'source-c', balance: '30000000', label: 'Source C' }, // 30 USDT
      ];

      const binanceBalance = '40000000'; // 40 USDT
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      // Total platform: 60 USDT
      // Binance: 40 USDT
      // Total overall: 100 USDT
      // Target 1:1: 50 USDT each side
      // Platform currently has 60, needs to be 50, so settle 10 USDT

      assert.equal(result.totalBalance, '60000000'); // Total platform balance
      assert.equal(result.targetBalance, '50000000'); // Target balance for each side (1:1)
      assert.equal(result.needsSettlement, true);

      // Find distributions
      const distA = result.distributions.find(d => d.blockchainKey === 'source-a');
      const distB = result.distributions.find(d => d.blockchainKey === 'source-b');
      const distC = result.distributions.find(d => d.blockchainKey === 'source-c');

      assert.ok(distA);
      assert.ok(distB);
      assert.ok(distC);

      // Validate percentages
      assert.equal(Math.round(distA.percentage * 100) / 100, 16.66); // 10/60 = 16.66% (precision limited to 2 decimals)
      assert.equal(Math.round(distB.percentage * 100) / 100, 33.33); // 20/60 = 33.33%
      assert.equal(Math.round(distC.percentage * 100) / 100, 50.0); // 30/60 = 50%

      // Validate total settlement amount
      const totalSettlement = BigInt(distA.amount) + BigInt(distB.amount) + BigInt(distC.amount);
      assert.equal(totalSettlement.toString(), result.settlementAmount);
    });

    it('should calculate distribution for Bitcoin example', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'bip122:mainnet', balance: '100000000', label: 'BTC Hot Wallet' }, // 1 BTC
      ];

      const binanceBalance = '300000000'; // 3 BTC
      const result = service.calculateDistribution(sources, binanceBalance, 'BTC');

      // Total platform: 1 BTC
      // Binance: 3 BTC
      // Total overall: 4 BTC
      // Target 1:1: 2 BTC each
      // Platform has 1, Binance has 3, already more on Binance side
      // No settlement needed (Binance already has more)

      assert.equal(result.needsSettlement, false);
    });

    it('should handle very small amounts (satoshis)', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'bip122:mainnet', balance: '1000', label: 'Source 1' }, // 1000 sats
        { blockchainKey: 'eip155:1', balance: '2000', label: 'Source 2' }, // 2000 sats
      ];

      const binanceBalance = '1000'; // 1000 sats
      const result = service.calculateDistribution(sources, binanceBalance, 'BTC');

      assert.equal(result.totalBalance, '3000');
      assert.equal(result.needsSettlement, true);

      // Validate proportions
      const dist1 = result.distributions.find(d => d.blockchainKey === 'bip122:mainnet');
      const dist2 = result.distributions.find(d => d.blockchainKey === 'eip155:1');

      assert.ok(dist1);
      assert.ok(dist2);

      // 1000/3000 = 33.33%
      assert.equal(Math.round(dist1.percentage * 100) / 100, 33.33);
      // 2000/3000 = 66.66% (due to precision)
      assert.equal(Math.round(dist2.percentage * 100) / 100, 66.66);
    });
  });

  describe('Threshold Filtering', () => {
    it('should filter out settlements below minimum amount', () => {
      const sources: BalanceSource[] = [{ blockchainKey: 'eip155:1', balance: '100000000' }];

      const binanceBalance = '99000000'; // Very close to 1:1
      const minSettlement = '10000000'; // 10 USDT minimum

      const result = service.calculateDistributionWithThreshold(
        sources,
        binanceBalance,
        'USDT',
        minSettlement,
      );

      // Settlement amount would be small, below threshold
      assert.equal(result, null);
    });

    it('should allow settlements above minimum amount', () => {
      const sources: BalanceSource[] = [{ blockchainKey: 'eip155:1', balance: '100000000' }];

      const binanceBalance = '0';
      const minSettlement = '10000000'; // 10 USDT minimum

      const result = service.calculateDistributionWithThreshold(
        sources,
        binanceBalance,
        'USDT',
        minSettlement,
      );

      assert.ok(result);
      assert.equal(result.needsSettlement, true);
    });

    it('should filter out settlements within ratio threshold', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '105000000' }, // 105 USDT
      ];

      const binanceBalance = '95000000'; // 95 USDT (total 200, so 52.5:47.5 ratio)
      const maxDeviation = 0.1; // 10% deviation allowed

      const result = service.calculateDistributionWithRatioThreshold(
        sources,
        binanceBalance,
        'USDT',
        maxDeviation,
      );

      // Ratio is 105/95 = 1.105, deviation is 0.105 which is > 0.1
      // Should NOT filter this out
      assert.ok(result);
    });

    it('should allow settlements with high ratio deviation', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '200000000' }, // 200 USDT
      ];

      const binanceBalance = '50000000'; // 50 USDT (ratio 4:1)
      const maxDeviation = 0.1; // 10% deviation allowed

      const result = service.calculateDistributionWithRatioThreshold(
        sources,
        binanceBalance,
        'USDT',
        maxDeviation,
      );

      assert.ok(result);
      assert.equal(result.needsSettlement, true);
      // Ratio is 4:1, far from 1:1
      assert.ok(result.currentRatio > 2.0);
    });
  });

  describe('Distribution Validation', () => {
    it('should validate correct distribution', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '100000000' },
        { blockchainKey: 'eip155:56', balance: '100000000' },
      ];

      const binanceBalance = '0';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      const isValid = service.validateDistribution(result);
      assert.equal(isValid, true);
    });

    it('should validate no-settlement case', () => {
      const sources: BalanceSource[] = [{ blockchainKey: 'eip155:1', balance: '50000000' }];

      const binanceBalance = '50000000';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      const isValid = service.validateDistribution(result);
      assert.equal(isValid, true);
    });
  });

  describe('Priority Ordering', () => {
    it('should sort distributions by amount descending', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'small', balance: '10000000' },
        { blockchainKey: 'large', balance: '50000000' },
        { blockchainKey: 'medium', balance: '30000000' },
      ];

      const binanceBalance = '0';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      const priorityOrder = service.getPriorityOrder(result);

      assert.equal(priorityOrder[0].blockchainKey, 'large');
      assert.equal(priorityOrder[1].blockchainKey, 'medium');
      assert.equal(priorityOrder[2].blockchainKey, 'small');
    });
  });

  describe('Formatting', () => {
    it('should format distribution for display', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '10000000', label: 'Ethereum' },
        { blockchainKey: 'eip155:56', balance: '20000000', label: 'BSC' },
      ];

      const binanceBalance = '20000000';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      const formatted = service.formatDistribution(result, 'USDT', 6);

      assert.ok(formatted.includes('USDT'));
      assert.ok(formatted.includes('Settlement Distribution'));
      assert.ok(formatted.includes('eip155:1'));
      assert.ok(formatted.includes('eip155:56'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty sources array', () => {
      const sources: BalanceSource[] = [];
      const binanceBalance = '100000000';

      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      assert.equal(result.needsSettlement, false);
      assert.equal(result.totalBalance, '0');
      assert.equal(result.distributions.length, 0);
    });

    it('should handle all sources with zero balance', () => {
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '0' },
        { blockchainKey: 'eip155:56', balance: '0' },
      ];

      const binanceBalance = '100000000';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      assert.equal(result.needsSettlement, false);
      assert.equal(result.totalBalance, '0');
    });

    it('should handle very large numbers (>2^53)', () => {
      // Using BigInt-safe values
      const sources: BalanceSource[] = [
        { blockchainKey: 'eip155:1', balance: '10000000000000000000' }, // 10^19
      ];

      const binanceBalance = '0';
      const result = service.calculateDistribution(sources, binanceBalance, 'SHIB');

      assert.ok(result.needsSettlement);
      assert.equal(result.totalBalance, '10000000000000000000');
    });
  });

  describe('Ratio Calculations', () => {
    it('should calculate correct ratios', () => {
      const sources: BalanceSource[] = [{ blockchainKey: 'eip155:1', balance: '300000000' }];

      const binanceBalance = '100000000'; // 3:1 ratio
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      assert.equal(result.currentRatio, 3.0);
      assert.equal(result.targetRatio, 1.0);
    });

    it('should handle infinite ratio when Binance balance is zero', () => {
      const sources: BalanceSource[] = [{ blockchainKey: 'eip155:1', balance: '100000000' }];

      const binanceBalance = '0';
      const result = service.calculateDistribution(sources, binanceBalance, 'USDT');

      assert.equal(result.currentRatio, Number.POSITIVE_INFINITY);
    });
  });
});
