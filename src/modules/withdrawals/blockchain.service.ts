import { Injectable } from '@nestjs/common';

import { Connection, clusterApiUrl } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { createPublicClient, formatGwei, http } from 'viem';
import { bsc, mainnet } from 'viem/chains';

import { TelemetryLogger } from '../../shared/telemetry.logger';

export interface NetworkFeeEstimate {
  fee: number;
  feeUnit: string;
  estimatedConfirmationTime: string;
  gasPrice?: number;
  gasLimit?: number;
}

export interface NetworkFeeOptions {
  priority: 'slow' | 'standard' | 'fast';
  amount?: number;
  destinationAddress?: string;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new TelemetryLogger(BlockchainService.name);

  // Viem clients for EVM chains
  private readonly ethereumClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.ETHEREUM_RPC_URL || 'https://ethereum.publicnode.com'),
  });

  private readonly bscClient = createPublicClient({
    chain: bsc,
    transport: http(process.env.BSC_RPC_URL || 'https://bsc.publicnode.com'),
  });

  // Solana connection
  private readonly solanaConnection = new Connection(
    process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'),
    'confirmed',
  );

  /**
   * Estimate network transaction fees for different blockchains
   */
  async estimateNetworkFee(
    blockchainKey: string,
    tokenId?: string,
    options: NetworkFeeOptions = { priority: 'standard' },
  ): Promise<NetworkFeeEstimate> {
    this.logger.log(
      `Estimating network fee for ${blockchainKey}${tokenId ? `:${tokenId}` : ''} with ${options.priority} priority`,
    );

    try {
      switch (blockchainKey) {
        case 'eip155:1': // Ethereum Mainnet
          return this.estimateEthereumFee(tokenId, options);
        case 'eip155:56': // BSC
          return this.estimateBscFee(tokenId, options);
        case 'bip122:000000000019d6689c085ae165831e93': // Bitcoin
          return this.estimateBitcoinFee(options);
        case 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': // Solana
          return this.estimateSolanaFee(options);
        default:
          this.logger.warn(`Unknown blockchain: ${blockchainKey}, using default fee`);
          return this.getDefaultFee(blockchainKey);
      }
    } catch (error) {
      this.logger.error(`Failed to estimate fee for ${blockchainKey}:`, error);
      return this.getDefaultFee(blockchainKey);
    }
  }

  /**
   * Ethereum fee estimation with EIP-1559 support using Viem
   */
  private async estimateEthereumFee(
    tokenId?: string,
    options: NetworkFeeOptions = { priority: 'standard' },
  ): Promise<NetworkFeeEstimate> {
    try {
      // Get gas price using Viem
      const gasPrice = await this.ethereumClient.getGasPrice();
      const gasPriceGwei = Number(formatGwei(gasPrice));

      const isToken = tokenId && tokenId !== 'native';
      const baseGasLimit = isToken ? 65000 : 21000; // ERC-20 vs ETH transfer

      // Apply priority multiplier
      const priorityMultiplier = this.getPriorityMultiplier(options.priority);
      const adjustedGasPrice = gasPriceGwei * priorityMultiplier;

      // Try EIP-1559 fee estimation if available
      try {
        const feeHistory = await this.ethereumClient.getFeeHistory({
          blockCount: 10,
          rewardPercentiles: [25, 50, 75],
        });

        const recentBaseFee = feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1];
        const recentBaseFeeGwei = Number(formatGwei(recentBaseFee));

        const priorityFees = feeHistory.reward?.[feeHistory.reward.length - 1];
        let priorityFeeGwei = 2; // Default 2 Gwei

        if (priorityFees && priorityFees.length > 0) {
          const medianPriorityFee = priorityFees[1] || priorityFees[0]; // 50th percentile or first available
          priorityFeeGwei = Number(formatGwei(medianPriorityFee));
        }

        // Adjust based on priority
        switch (options.priority) {
          case 'slow':
            priorityFeeGwei *= 0.8;
            break;
          case 'fast':
            priorityFeeGwei *= 1.5;
            break;
        }

        const totalGasPrice = recentBaseFeeGwei + priorityFeeGwei;
        const estimatedFee = (baseGasLimit * totalGasPrice) / 1e9; // Convert to ETH

        return {
          fee: estimatedFee,
          feeUnit: 'ETH',
          estimatedConfirmationTime: this.getConfirmationTime('ethereum', options.priority),
          gasPrice: totalGasPrice,
          gasLimit: baseGasLimit,
        };
      } catch (eip1559Error) {
        this.logger.warn('EIP-1559 estimation failed, using legacy gas price:', eip1559Error);

        // Fallback to legacy gas price
        const estimatedFee = (baseGasLimit * adjustedGasPrice) / 1e9;

        return {
          fee: estimatedFee,
          feeUnit: 'ETH',
          estimatedConfirmationTime: this.getConfirmationTime('ethereum', options.priority),
          gasPrice: adjustedGasPrice,
          gasLimit: baseGasLimit,
        };
      }
    } catch (error) {
      this.logger.error('Failed to fetch Ethereum gas prices via RPC, using fallback:', error);
      return this.getFallbackEthereumFee(tokenId, options);
    }
  }

  /**
   * Fallback Ethereum fee estimation
   */
  private getFallbackEthereumFee(
    tokenId?: string,
    options: NetworkFeeOptions = { priority: 'standard' },
  ): NetworkFeeEstimate {
    const isToken = tokenId && tokenId !== 'native';
    const baseGasLimit = isToken ? 65000 : 21000;
    const priorityFeeMultiplier = this.getPriorityMultiplier(options.priority);

    // Conservative fallback gas prices
    const baseGasPrice = 25; // Base gas price in Gwei
    const priorityFee = baseGasPrice * priorityFeeMultiplier;
    const totalGasPrice = baseGasPrice + priorityFee;
    const estimatedFee = (baseGasLimit * totalGasPrice) / 1e9;

    return {
      fee: estimatedFee,
      feeUnit: 'ETH',
      estimatedConfirmationTime: this.getConfirmationTime('ethereum', options.priority),
      gasPrice: totalGasPrice,
      gasLimit: baseGasLimit,
    };
  }

  /**
   * BSC fee estimation using Viem
   */
  private async estimateBscFee(
    tokenId?: string,
    options: NetworkFeeOptions = { priority: 'standard' },
  ): Promise<NetworkFeeEstimate> {
    try {
      // Get real-time gas price from BSC
      const gasPrice = await this.bscClient.getGasPrice();
      const gasPriceGwei = Number(formatGwei(gasPrice));

      const isToken = tokenId && tokenId !== 'native';
      const baseGasLimit = isToken ? 65000 : 21000;

      // Apply priority multiplier
      const priorityMultiplier = this.getPriorityMultiplier(options.priority);
      const adjustedGasPrice = gasPriceGwei * priorityMultiplier;

      const estimatedFee = (baseGasLimit * adjustedGasPrice) / 1e9; // Convert to BNB

      return {
        fee: estimatedFee,
        feeUnit: 'BNB',
        estimatedConfirmationTime: this.getConfirmationTime('bsc', options.priority),
        gasPrice: adjustedGasPrice,
        gasLimit: baseGasLimit,
      };
    } catch (error) {
      this.logger.error('Failed to fetch BSC gas prices via RPC, using fallback:', error);

      // Fallback values for BSC
      const isToken = tokenId && tokenId !== 'native';
      const baseGasLimit = isToken ? 65000 : 21000;
      const baseGasPrice = 5; // 5 Gwei fallback
      const totalGasPrice = baseGasPrice * this.getPriorityMultiplier(options.priority);
      const estimatedFee = (baseGasLimit * totalGasPrice) / 1e9;

      return {
        fee: estimatedFee,
        feeUnit: 'BNB',
        estimatedConfirmationTime: this.getConfirmationTime('bsc', options.priority),
        gasPrice: totalGasPrice,
        gasLimit: baseGasLimit,
      };
    }
  }

  /**
   * Bitcoin fee estimation using real mempool APIs
   */
  private async estimateBitcoinFee(
    options: NetworkFeeOptions = { priority: 'standard' },
  ): Promise<NetworkFeeEstimate> {
    try {
      // Get real-time fee rates from mempool.space API
      const feeRates = await this.fetchBitcoinFeeRates();

      let feeRate: number;
      switch (options.priority) {
        case 'slow':
          feeRate = feeRates.hourFee || 10; // ~1 hour confirmation
          break;
        case 'fast':
          feeRate = feeRates.fastestFee || 50; // Fastest confirmation
          break;
        case 'standard':
        default:
          feeRate = feeRates.halfHourFee || 20; // ~30 minutes
          break;
      }

      // Estimate transaction size using bitcoinjs-lib
      const txSize = this.estimateBitcoinTransactionSize(options.amount || 0);

      const feeInSatoshis = feeRate * txSize;
      const feeInBTC = feeInSatoshis / 1e8;

      return {
        fee: feeInBTC,
        feeUnit: 'BTC',
        estimatedConfirmationTime: this.getConfirmationTime('bitcoin', options.priority),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Bitcoin fee rates, using fallback:', error);
      return this.getFallbackBitcoinFee(options);
    }
  }

  /**
   * Fetch real-time Bitcoin fee rates from mempool.space
   */
  private async fetchBitcoinFeeRates(): Promise<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
  }> {
    try {
      // Primary: mempool.space API (reliable and fast)
      const response = await fetch('https://mempool.space/api/v1/fees/recommended');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;

      return {
        fastestFee: typeof data.fastestFee === 'number' ? data.fastestFee : 50,
        halfHourFee: typeof data.halfHourFee === 'number' ? data.halfHourFee : 20,
        hourFee: typeof data.hourFee === 'number' ? data.hourFee : 10,
        economyFee: typeof data.economyFee === 'number' ? data.economyFee : 5,
      };
    } catch (error) {
      this.logger.warn('mempool.space API failed, trying blockstream...', error);

      // Fallback: Blockstream API
      try {
        const response = await fetch('https://blockstream.info/api/fee-estimates');
        const data = (await response.json()) as Record<string, unknown>;

        // Blockstream returns fee estimates for different confirmation targets
        return {
          fastestFee: Math.ceil(typeof data['1'] === 'number' ? data['1'] : 50), // 1 block (~10 min)
          halfHourFee: Math.ceil(typeof data['3'] === 'number' ? data['3'] : 20), // 3 blocks (~30 min)
          hourFee: Math.ceil(typeof data['6'] === 'number' ? data['6'] : 10), // 6 blocks (~1 hour)
          economyFee: Math.ceil(typeof data['144'] === 'number' ? data['144'] : 5), // 144 blocks (~24 hours)
        };
      } catch (fallbackError) {
        this.logger.error('All Bitcoin fee APIs failed:', fallbackError);
        throw new Error('Unable to fetch Bitcoin fee rates');
      }
    }
  }

  /**
   * Simple Bitcoin transaction size estimation using bitcoinjs-lib
   * More accurate than heuristic, constructs a dummy transaction
   */
  private estimateBitcoinTransactionSize(amount: number): number {
    // Assume 1 input (P2WPKH), 2 outputs (recipient + change)
    // Optionally, adjust input count based on amount/UTXO size
    const estimatedInputs = Math.max(1, Math.ceil(amount / 0.01));
    const outputs = 2;

    // Create dummy inputs
    const txb = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
    for (let i = 0; i < estimatedInputs; i++) {
      txb.addInput({
        hash: Buffer.alloc(32),
        index: 0,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({ pubkey: Buffer.alloc(33, 1) }).output!,
          value: 1000000,
        },
      });
    }
    for (let i = 0; i < outputs; i++) {
      txb.addOutput({
        address: bitcoin.payments.p2wpkh({ pubkey: Buffer.alloc(33, 2) }).address!,
        value: 10000,
      });
    }
    // Finalize and get virtual size
    // Note: Not signing, just for size estimation
    return txb.extractTransaction().virtualSize();
  }

  /**
   * Fallback Bitcoin fee estimation
   */
  private getFallbackBitcoinFee(
    options: NetworkFeeOptions = { priority: 'standard' },
  ): NetworkFeeEstimate {
    const priorityMultiplier = this.getPriorityMultiplier(options.priority);

    // Conservative fallback fee rates (sat/byte)
    const baseFeeRate = 25; // Higher conservative estimate
    const feeRate = baseFeeRate * priorityMultiplier;

    // Standard transaction size estimate
    const txSize = this.estimateBitcoinTransactionSize(options.amount || 0.01);
    const feeInSatoshis = feeRate * txSize;
    const feeInBTC = feeInSatoshis / 1e8;

    return {
      fee: feeInBTC,
      feeUnit: 'BTC',
      estimatedConfirmationTime: this.getConfirmationTime('bitcoin', options.priority),
    };
  }

  /**
   * Solana fee estimation using @solana/web3.js
   */
  private async estimateSolanaFee(
    options: NetworkFeeOptions = { priority: 'standard' },
  ): Promise<NetworkFeeEstimate> {
    try {
      // Get recent prioritization fees from Solana
      const recentPrioritizationFees = await this.solanaConnection.getRecentPrioritizationFees();

      // Calculate average priority fee from recent slots
      const avgPriorityFee =
        recentPrioritizationFees.length > 0
          ? recentPrioritizationFees.reduce((sum, fee) => sum + fee.prioritizationFee, 0) /
            recentPrioritizationFees.length
          : 0;

      // Base transaction fee (always 5,000 lamports)
      const baseFee = 0.000005; // 5,000 lamports = 0.000005 SOL

      let priorityFee = 0;
      if (avgPriorityFee > 0) {
        // Convert lamports to SOL and apply priority multiplier
        const priorityFeeSOL = avgPriorityFee / 1e9;

        switch (options.priority) {
          case 'slow':
            priorityFee = priorityFeeSOL * 0.5; // 50% of average
            break;
          case 'fast':
            priorityFee = priorityFeeSOL * 2.0; // 200% of average
            break;
          case 'standard':
          default:
            priorityFee = priorityFeeSOL; // Use average
            break;
        }
      } else {
        // Fallback if no recent priority fees
        priorityFee = options.priority === 'fast' ? baseFee : 0;
      }

      const totalFee = baseFee + priorityFee;

      return {
        fee: totalFee,
        feeUnit: 'SOL',
        estimatedConfirmationTime: this.getConfirmationTime('solana', options.priority),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Solana fees via RPC, using fallback:', error);

      // Fallback to static fees
      const baseFee = 0.000005;
      const priorityFee = options.priority === 'fast' ? baseFee * 2 : 0;
      const totalFee = baseFee + priorityFee;

      return {
        fee: totalFee,
        feeUnit: 'SOL',
        estimatedConfirmationTime: this.getConfirmationTime('solana', options.priority),
      };
    }
  }

  /**
   * Default fee estimation for unknown blockchains
   */
  private getDefaultFee(blockchainKey: string): NetworkFeeEstimate {
    this.logger.warn(`Using default fee estimation for unknown blockchain: ${blockchainKey}`);

    return {
      fee: 0.001, // Conservative default
      feeUnit: 'UNKNOWN',
      estimatedConfirmationTime: '10-30 minutes',
    };
  }

  /**
   * Get priority multiplier for fee calculation
   */
  private getPriorityMultiplier(priority: 'slow' | 'standard' | 'fast'): number {
    switch (priority) {
      case 'slow':
        return 0.8; // 20% discount for slower confirmation
      case 'standard':
        return 1.0; // Base rate
      case 'fast':
        return 1.5; // 50% premium for faster confirmation
      default:
        return 1.0;
    }
  }

  /**
   * Get estimated confirmation time based on network and priority
   */
  private getConfirmationTime(network: string, priority: 'slow' | 'standard' | 'fast'): string {
    const timeRanges = {
      ethereum: {
        slow: '5-15 minutes',
        standard: '2-5 minutes',
        fast: '30 seconds - 2 minutes',
      },
      bsc: {
        slow: '15-30 seconds',
        standard: '3-15 seconds',
        fast: '1-3 seconds',
      },
      bitcoin: {
        slow: '30-60 minutes',
        standard: '10-30 minutes',
        fast: '10-20 minutes',
      },
      solana: {
        slow: '30-60 seconds',
        standard: '10-30 seconds',
        fast: '5-15 seconds',
      },
    };

    return timeRanges[network]?.[priority] || '10-30 minutes';
  }

  /**
   * Check if blockchain network is operational using real RPC calls
   */
  async isNetworkOperational(blockchainKey: string): Promise<{
    operational: boolean;
    reason?: string;
  }> {
    try {
      const healthCheck = await this.performNetworkHealthCheck(blockchainKey);
      return { operational: healthCheck };
    } catch (error) {
      this.logger.error(`Network health check failed for ${blockchainKey}:`, error);
      return {
        operational: false,
        reason: `Network health check failed: ${error.message}`,
      };
    }
  }

  /**
   * Perform real network health check via RPC calls
   */
  private async performNetworkHealthCheck(blockchainKey: string): Promise<boolean> {
    this.logger.log(`Performing health check for ${blockchainKey}`);

    try {
      switch (blockchainKey) {
        case 'eip155:1': {
          // Ethereum
          const ethBlock = await this.ethereumClient.getBlockNumber();
          return ethBlock > 0n;
        }

        case 'eip155:56': {
          // BSC
          const bscBlock = await this.bscClient.getBlockNumber();
          return bscBlock > 0n;
        }

        case 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
          // Solana
          const solanaSlot = await this.solanaConnection.getSlot();
          return solanaSlot > 0;
        }

        case 'bip122:000000000019d6689c085ae165831e93': {
          // Bitcoin
          // For Bitcoin, we'd typically check a block explorer API
          // Since we don't have direct RPC, use a simple API call
          const response = await fetch('https://blockstream.info/api/blocks/tip/height');
          if (!response.ok) throw new Error('Bitcoin API unavailable');
          const height = await response.json();
          return typeof height === 'number' && height > 0;
        }

        default:
          this.logger.warn(`Unknown blockchain for health check: ${blockchainKey}`);
          return true; // Assume operational for unknown chains
      }
    } catch (error) {
      this.logger.error(`Health check failed for ${blockchainKey}:`, error);
      return false;
    }
  }
}
