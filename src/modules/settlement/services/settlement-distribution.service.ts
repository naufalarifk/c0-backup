import { Injectable, Logger } from '@nestjs/common';

/**
 * Balance source for distribution calculation
 */
export interface BalanceSource {
  /** Blockchain key (e.g., 'eip155:1', 'bip122:000000000019d6689c085ae165831e93') */
  blockchainKey: string;
  /** Current balance in smallest unit (wei, satoshi, etc.) */
  balance: string;
  /** Optional label for debugging */
  label?: string;
}

/**
 * Distribution target for settlement
 */
export interface DistributionTarget {
  /** Source blockchain key */
  blockchainKey: string;
  /** Amount to withdraw from this source */
  amount: string;
  /** Percentage of total this represents */
  percentage: number;
  /** Original balance before settlement */
  originalBalance: string;
  /** Remaining balance after settlement */
  remainingBalance: string;
}

/**
 * Distribution calculation result
 */
export interface DistributionResult {
  /** Total platform balance across all sources */
  totalBalance: string;
  /** Target balance each side should have (1:1 ratio) */
  targetBalance: string;
  /** Amount needed to settle (positive = send to Binance, negative = send to platform) */
  settlementAmount: string;
  /** Distribution per source */
  distributions: DistributionTarget[];
  /** Whether settlement is needed */
  needsSettlement: boolean;
  /** Current ratio (platform_balance / binance_balance) */
  currentRatio: number;
  /** Target ratio (should be 1.0 for 1:1) */
  targetRatio: number;
}

/**
 * SettlementDistributionService
 *
 * Handles calculation of proportional distribution for multi-source settlements.
 * When settling to Binance to achieve 1:1 ratio, this service calculates
 * how much to withdraw from each source proportionally.
 *
 * Example:
 * - USDT from Ethereum: 10
 * - USDT from BSC: 20
 * - USDT from Solana: 30
 * - Total platform: 60
 * - USDT on Binance: 40
 *
 * To reach 1:1 (50:50):
 * - Need to settle: 10 (20% of platform balance)
 * - From Ethereum: 10 * (10/60) = 1.67 (16.7%)
 * - From BSC: 10 * (20/60) = 3.33 (33.3%)
 * - From Solana: 10 * (30/60) = 5.00 (50.0%)
 */
@Injectable()
export class SettlementDistributionService {
  private readonly logger = new Logger(SettlementDistributionService.name);

  /**
   * Calculate proportional distribution for settlement
   *
   * @param sources Array of balance sources (hot wallets per blockchain)
   * @param binanceBalance Current balance on Binance
   * @param currencyTokenId Currency token ID for logging
   * @returns Distribution calculation result
   */
  calculateDistribution(
    sources: BalanceSource[],
    binanceBalance: string,
    currencyTokenId: string,
  ): DistributionResult {
    // Convert to BigInt for precise calculation
    const binanceBalanceBN = BigInt(binanceBalance);
    const platformBalance = sources.reduce((sum, source) => sum + BigInt(source.balance), 0n);

    // Calculate target 1:1 ratio
    // Total = platform + binance
    // Target each side = total / 2
    // Settlement amount = target_binance - current_binance
    const totalBalance = platformBalance + binanceBalanceBN;
    const targetBalance = totalBalance / 2n;
    const settlementAmount = targetBalance - binanceBalanceBN;

    // Check if settlement is needed (positive = send to Binance, negative = send to platform)
    const needsSettlement = settlementAmount > 0n;

    // Calculate current ratio (platform / binance)
    const currentRatio =
      binanceBalanceBN > 0n
        ? Number(platformBalance) / Number(binanceBalanceBN)
        : Number.POSITIVE_INFINITY;

    this.logger.log(
      `Distribution calculation for ${currencyTokenId}: ` +
        `Platform=${platformBalance.toString()}, Binance=${binanceBalance}, Total=${totalBalance.toString()}, ` +
        `Target=${targetBalance.toString()}, Settlement=${settlementAmount.toString()}, ` +
        `Ratio=${currentRatio.toFixed(2)}`,
    );

    if (!needsSettlement) {
      this.logger.log(
        `No settlement needed for ${currencyTokenId}. Current ratio: ${currentRatio.toFixed(2)}`,
      );
      return {
        totalBalance: platformBalance.toString(),
        targetBalance: targetBalance.toString(),
        settlementAmount: '0',
        distributions: [],
        needsSettlement: false,
        currentRatio,
        targetRatio: 1.0,
      };
    }

    // Calculate proportional distribution
    const distributions: DistributionTarget[] = sources.map(source => {
      const sourceBalance = BigInt(source.balance);

      // Calculate percentage of total platform balance this source represents
      const percentage =
        platformBalance > 0n ? Number((sourceBalance * 10000n) / platformBalance) / 100 : 0; // 2 decimal precision

      // Calculate amount to withdraw from this source (proportional to its balance)
      const amount =
        platformBalance > 0n ? (settlementAmount * sourceBalance) / platformBalance : 0n;

      // Calculate remaining balance
      const remainingBalance = sourceBalance - amount;

      this.logger.debug(
        `${source.label || source.blockchainKey}: ` +
          `Balance=${sourceBalance.toString()}, ` +
          `Percentage=${percentage.toFixed(2)}%, ` +
          `Amount=${amount.toString()}, ` +
          `Remaining=${remainingBalance.toString()}`,
      );

      return {
        blockchainKey: source.blockchainKey,
        amount: amount.toString(),
        percentage,
        originalBalance: source.balance,
        remainingBalance: remainingBalance.toString(),
      };
    });

    // Filter out distributions with zero amount
    const nonZeroDistributions = distributions.filter(d => BigInt(d.amount) > 0n);

    // Handle rounding errors: distribute remainder to the largest contributor
    const totalDistributed = nonZeroDistributions.reduce((sum, d) => sum + BigInt(d.amount), 0n);
    const roundingError = settlementAmount - totalDistributed;

    if (roundingError !== 0n && nonZeroDistributions.length > 0) {
      // Find the distribution with the largest amount
      const largestDist = nonZeroDistributions.reduce((max, d) =>
        BigInt(d.amount) > BigInt(max.amount) ? d : max,
      );

      // Add the rounding error to the largest distribution
      const adjustedAmount = BigInt(largestDist.amount) + roundingError;
      largestDist.amount = adjustedAmount.toString();
      largestDist.remainingBalance = (
        BigInt(largestDist.originalBalance) - adjustedAmount
      ).toString();

      this.logger.debug(
        `Adjusted ${largestDist.blockchainKey} by ${roundingError.toString()} to handle rounding error`,
      );
    }

    return {
      totalBalance: platformBalance.toString(),
      targetBalance: targetBalance.toString(),
      settlementAmount: settlementAmount.toString(),
      distributions: nonZeroDistributions,
      needsSettlement: true,
      currentRatio,
      targetRatio: 1.0,
    };
  }

  /**
   * Calculate distribution with minimum settlement amount
   * Only settles if the imbalance exceeds a threshold
   *
   * @param sources Array of balance sources
   * @param binanceBalance Current balance on Binance
   * @param currencyTokenId Currency token ID
   * @param minSettlementAmount Minimum amount needed to trigger settlement
   * @returns Distribution result or null if below threshold
   */
  calculateDistributionWithThreshold(
    sources: BalanceSource[],
    binanceBalance: string,
    currencyTokenId: string,
    minSettlementAmount: string,
  ): DistributionResult | null {
    const result = this.calculateDistribution(sources, binanceBalance, currencyTokenId);

    if (!result.needsSettlement) {
      return null;
    }

    // Check if settlement amount exceeds threshold
    if (BigInt(result.settlementAmount) < BigInt(minSettlementAmount)) {
      this.logger.log(
        `Settlement amount ${result.settlementAmount} below threshold ${minSettlementAmount} for ${currencyTokenId}`,
      );
      return null;
    }

    return result;
  }

  /**
   * Calculate distribution with ratio threshold
   * Only settles if ratio deviates from 1:1 beyond threshold
   *
   * @param sources Array of balance sources
   * @param binanceBalance Current balance on Binance
   * @param currencyTokenId Currency token ID
   * @param maxRatioDeviation Maximum allowed deviation from 1:1 (e.g., 0.1 = 10%)
   * @returns Distribution result or null if ratio is acceptable
   */
  calculateDistributionWithRatioThreshold(
    sources: BalanceSource[],
    binanceBalance: string,
    currencyTokenId: string,
    maxRatioDeviation = 0.1, // 10% default
  ): DistributionResult | null {
    const result = this.calculateDistribution(sources, binanceBalance, currencyTokenId);

    if (!result.needsSettlement) {
      return null;
    }

    // Check if ratio deviation exceeds threshold
    const ratioDeviation = Math.abs(result.currentRatio - result.targetRatio);
    if (ratioDeviation <= maxRatioDeviation) {
      this.logger.log(
        `Ratio deviation ${ratioDeviation.toFixed(4)} within threshold ${maxRatioDeviation} for ${currencyTokenId}`,
      );
      return null;
    }

    return result;
  }

  /**
   * Format distribution for human-readable display
   *
   * @param result Distribution result
   * @param currencySymbol Currency symbol for display (e.g., 'USDT', 'BTC')
   * @param decimals Number of decimals for the currency
   * @returns Formatted string
   */
  formatDistribution(result: DistributionResult, currencySymbol: string, decimals: number): string {
    const divisor = Math.pow(10, decimals);

    const lines: string[] = [
      `Settlement Distribution for ${currencySymbol}:`,
      `  Total Balance: ${(Number(result.totalBalance) / divisor).toFixed(decimals)} ${currencySymbol}`,
      `  Binance Target: ${(Number(result.targetBalance) / divisor).toFixed(decimals)} ${currencySymbol}`,
      `  Settlement Amount: ${(Number(result.settlementAmount) / divisor).toFixed(decimals)} ${currencySymbol}`,
      `  Current Ratio: ${result.currentRatio.toFixed(4)} (target: ${result.targetRatio.toFixed(4)})`,
      '',
      'Distribution by Source:',
    ];

    for (const dist of result.distributions) {
      lines.push(
        `  ${dist.blockchainKey}:`,
        `    Amount: ${(Number(dist.amount) / divisor).toFixed(decimals)} ${currencySymbol} (${dist.percentage.toFixed(2)}%)`,
        `    Original: ${(Number(dist.originalBalance) / divisor).toFixed(decimals)} ${currencySymbol}`,
        `    Remaining: ${(Number(dist.remainingBalance) / divisor).toFixed(decimals)} ${currencySymbol}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Validate distribution result
   * Ensures the distribution adds up correctly
   *
   * @param result Distribution result to validate
   * @returns true if valid, throws error if invalid
   */
  validateDistribution(result: DistributionResult): boolean {
    if (!result.needsSettlement) {
      return true;
    }

    // Sum up all distribution amounts
    const totalDistributed = result.distributions.reduce(
      (sum, dist) => sum + BigInt(dist.amount),
      0n,
    );

    // Should equal settlement amount
    if (totalDistributed !== BigInt(result.settlementAmount)) {
      throw new Error(
        `Distribution validation failed: Sum of distributions (${totalDistributed.toString()}) ` +
          `does not equal settlement amount (${result.settlementAmount})`,
      );
    }

    // Validate percentages sum to 100%
    const totalPercentage = result.distributions.reduce((sum, dist) => sum + dist.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      // Allow 0.01% rounding error
      throw new Error(
        `Distribution validation failed: Percentages sum to ${totalPercentage.toFixed(2)}% instead of 100%`,
      );
    }

    return true;
  }

  /**
   * Calculate settlement priority order
   * Returns sources sorted by balance (largest first) for optimal settlement
   *
   * @param result Distribution result
   * @returns Distributions sorted by amount (descending)
   */
  getPriorityOrder(result: DistributionResult): DistributionTarget[] {
    return [...result.distributions].sort((a, b) => {
      const amountA = BigInt(a.amount);
      const amountB = BigInt(b.amount);
      if (amountA > amountB) return -1;
      if (amountA < amountB) return 1;
      return 0;
    });
  }
}
