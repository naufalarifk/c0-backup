import type { BinanceDepositAddress } from './binance-client.service';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BinanceAssetMapperService } from './binance-asset-mapper.service';
import { BinanceClientService } from './binance-client.service';

/**
 * Service to handle deposits from hot wallet to Binance exchange
 *
 * Flow:
 * 1. Get Binance deposit address for specific network
 * 2. Transfer tokens from hot wallet to Binance deposit address (using WalletService)
 * 3. Monitor transaction confirmation
 * 4. Verify Binance balance update
 */
@Injectable()
export class BinanceWalletDepositService {
  private readonly logger = new Logger(BinanceWalletDepositService.name);

  // Cache deposit addresses to avoid repeated API calls
  private addressCache: Map<string, BinanceDepositAddress> = new Map();

  constructor(
    private readonly binanceClient: BinanceClientService,
    private readonly assetMapper: BinanceAssetMapperService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get Binance deposit address for a specific blockchain
   * Result is cached to avoid repeated API calls
   *
   * @param blockchain - The blockchain (e.g., 'BNB_CHAIN', 'ETHEREUM', 'SOLANA')
   * @param asset - Optional specific asset (defaults to native token)
   */
  async getBinanceDepositAddress(
    blockchain: string,
    asset?: string,
  ): Promise<BinanceDepositAddress> {
    if (!this.binanceClient.isApiEnabled()) {
      throw new Error('Binance API is not enabled');
    }

    // Map asset to Binance coin symbol
    // If asset has '_' it's a currency token ID, otherwise it's already a Binance asset symbol
    const assetMapping =
      asset && asset.includes('_') ? this.assetMapper.tokenToBinanceAsset(asset) : null;
    const binanceCoin = assetMapping ? assetMapping.asset : asset || '';
    const binanceNetwork = this.assetMapper.blockchainKeyToBinanceNetwork(blockchain);

    if (!binanceCoin) {
      throw new Error(`Invalid asset: ${asset}`);
    }

    if (!binanceNetwork) {
      throw new Error(`No Binance network mapping for blockchain: ${blockchain}`);
    }

    const cacheKey = `${binanceCoin}_${binanceNetwork}`;

    // Check cache first
    if (this.addressCache.has(cacheKey)) {
      this.logger.debug(`Using cached deposit address for ${binanceCoin} on ${binanceNetwork}`);
      return this.addressCache.get(cacheKey)!;
    }

    // Fetch from Binance API
    this.logger.log(`Fetching deposit address for ${binanceCoin} on ${binanceNetwork}...`);

    try {
      const depositAddress = await this.binanceClient.getDepositAddress(
        binanceCoin,
        binanceNetwork,
      );

      // Cache the result
      this.addressCache.set(cacheKey, depositAddress);

      this.logger.log(
        `Deposit address for ${binanceCoin} on ${binanceNetwork}: ${depositAddress.address}`,
      );

      return depositAddress;
    } catch (error) {
      this.logger.error(
        `Failed to get deposit address for ${binanceCoin} on ${binanceNetwork}:`,
        error,
      );
      throw new Error(
        `Failed to get Binance deposit address: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Prepare deposit transaction details
   * This returns the information needed to send tokens from hot wallet to Binance
   *
   * @param blockchain - The blockchain to use
   * @param amount - Amount to deposit
   * @param asset - Optional specific asset (defaults to native token)
   */
  async prepareDepositTransaction(blockchain: string, amount: string, asset?: string) {
    const depositAddress = await this.getBinanceDepositAddress(blockchain, asset);

    return {
      toAddress: depositAddress.address,
      amount,
      asset: asset || this.getDefaultAssetForBlockchain(blockchain),
      network: depositAddress.network,
      tag: depositAddress.tag, // For networks that require memo/tag
      instructions: [
        'Use WalletService to send transaction',
        'Monitor transaction confirmation on blockchain',
        'Verify balance update in Binance account',
      ],
    };
  }

  /**
   * Get Binance balance for a specific asset
   * Useful for verifying deposits have arrived
   */
  async getBalance(asset: string): Promise<{ free: string; locked: string; total: string }> {
    if (!this.binanceClient.isApiEnabled()) {
      throw new Error('Binance API is not enabled');
    }

    // Map asset to Binance coin symbol
    const assetMapping =
      asset && asset.includes('_') ? this.assetMapper.tokenToBinanceAsset(asset) : null;
    const binanceAsset = assetMapping ? assetMapping.asset : asset;

    if (!binanceAsset) {
      throw new Error(`Invalid asset: ${asset}`);
    }

    this.logger.debug(`Fetching Binance balance for ${binanceAsset}...`);

    const balance = await this.binanceClient.getAssetBalance(binanceAsset);

    if (!balance) {
      return {
        free: '0',
        locked: '0',
        total: '0',
      };
    }

    const total = (Number.parseFloat(balance.free) + Number.parseFloat(balance.locked)).toString();

    return {
      free: balance.free,
      locked: balance.locked,
      total,
    };
  }

  /**
   * Verify deposit by checking Binance deposit history
   *
   * @param asset - The asset that was deposited
   * @param expectedAmount - Expected deposit amount
   * @param txHash - Optional transaction hash to match
   * @param afterTime - Only check deposits after this timestamp (ms)
   */
  async verifyDeposit(
    asset: string,
    expectedAmount: string,
    txHash?: string,
    afterTime?: number,
  ): Promise<{
    found: boolean;
    deposit?: {
      amount: string;
      txId: string;
      status: number;
      insertTime: number;
    };
  }> {
    if (!this.binanceClient.isApiEnabled()) {
      throw new Error('Binance API is not enabled');
    }

    // Map asset to Binance coin symbol
    const assetMapping =
      asset && asset.includes('_') ? this.assetMapper.tokenToBinanceAsset(asset) : null;
    const binanceAsset = assetMapping ? assetMapping.asset : asset;

    if (!binanceAsset) {
      throw new Error(`Invalid asset: ${asset}`);
    }

    this.logger.debug(`Checking deposit history for ${binanceAsset}...`);

    const history = await this.binanceClient.getDepositHistory(binanceAsset, afterTime, Date.now());

    if (!history || history.length === 0) {
      return { found: false };
    }

    // Find matching deposit
    const expectedAmountNum = Number.parseFloat(expectedAmount);

    for (const deposit of history) {
      const depositAmount = Number.parseFloat(deposit.amount);
      const amountMatches = Math.abs(depositAmount - expectedAmountNum) < 0.0001; // Small tolerance

      if (amountMatches) {
        // If txHash provided, must match
        if (txHash && deposit.txId !== txHash) {
          continue;
        }

        this.logger.log(`Found matching deposit: ${JSON.stringify(deposit)}`);

        return {
          found: true,
          deposit: {
            amount: deposit.amount,
            txId: deposit.txId,
            status: deposit.status,
            insertTime: deposit.insertTime,
          },
        };
      }
    }

    return { found: false };
  }

  /**
   * Clear cached deposit addresses (useful if addresses change)
   */
  clearAddressCache() {
    this.logger.log('Clearing deposit address cache');
    this.addressCache.clear();
  }

  /**
   * Get default asset for a blockchain
   */
  private getDefaultAssetForBlockchain(blockchain: string): string {
    switch (blockchain.toUpperCase()) {
      case 'BNB_CHAIN':
      case 'BSC':
        return 'BNB';
      case 'ETHEREUM':
      case 'ETH':
        return 'ETH';
      case 'SOLANA':
      case 'SOL':
        return 'SOL';
      default:
        throw new Error(`Unsupported blockchain: ${blockchain}`);
    }
  }

  /**
   * Get status of Binance API
   */
  async getApiStatus(): Promise<{ enabled: boolean; operational: boolean }> {
    const enabled = this.binanceClient.isApiEnabled();

    if (!enabled) {
      return { enabled: false, operational: false };
    }

    const operational = await this.binanceClient.ping();

    return { enabled, operational };
  }
}
