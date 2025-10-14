import type {
  BlockchainBalance,
  ReconciliationReport,
  SettlementResult,
} from '../../types/settlement.types';
import type { SettlementBlockchainService } from '../blockchain/wallet.abstract';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CryptogadaiRepository } from '../../../../shared/repositories/cryptogadai.repository';
import { WalletService } from '../../../../shared/wallets/wallet.service';
import { defaultSettlementConfig } from '../../settlement.config';
import { BinanceAssetMapperService } from '../binance/binance-asset-mapper.service';
import { BinanceClientService } from '../binance/binance-client.service';
import { SolService } from '../blockchain/sol.service';
import { TransactionMatchingService } from '../matching/transaction-matching.service';
import { SettlementAlertService } from './settlement-alert.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
    private readonly binanceClient: BinanceClientService,
    private readonly binanceMapper: BinanceAssetMapperService,
    private readonly transactionMatcher: TransactionMatchingService,
    private readonly alertService: SettlementAlertService,
    private readonly solService: SolService,
  ) {}

  /**
   * Get Binance balance for a specific currency
   * Uses Binance API if enabled, falls back to blockchain balance (BSC) if not
   */
  async getBinanceBalance(currencyTokenId: string): Promise<string> {
    try {
      // If Binance API is enabled, fetch from exchange
      if (this.binanceClient.isApiEnabled()) {
        const assetMapping = this.binanceMapper.tokenToBinanceAsset(currencyTokenId);

        if (!assetMapping) {
          this.logger.warn(
            `No Binance asset mapping for ${currencyTokenId}, using blockchain balance`,
          );
          return await this.repository.platformGetsTargetNetworkBalance(currencyTokenId);
        }

        const balance = await this.binanceClient.getAssetBalance(assetMapping.asset);

        if (!balance) {
          this.logger.debug(`No Binance balance for ${assetMapping.asset}`);
          return '0';
        }

        // Return free + locked balance
        const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
        this.logger.debug(
          `Binance API balance for ${assetMapping.asset}: ${total} (free: ${balance.free}, locked: ${balance.locked})`,
        );

        return total.toString();
      }

      // Fallback to blockchain balance (treats Binance as BSC address)
      this.logger.debug('Binance API disabled, using blockchain balance');
      return await this.repository.platformGetsTargetNetworkBalance(currencyTokenId);
    } catch (error) {
      this.logger.error(`Failed to fetch Binance balance for ${currencyTokenId}:`, error);
      return '0';
    }
  }

  /**
   * Get actual blockchain balances for all configured hot wallets
   * Returns native token balances (BNB, ETH, SOL) by querying blockchain directly
   */
  private async getActualBlockchainBalances(): Promise<
    Array<{
      blockchainKey: string;
      balance: string;
      address: string;
      symbol: string;
    }>
  > {
    this.logger.log('Fetching actual blockchain balances...');

    // Define blockchains to check
    const blockchains = [
      { key: 'eip155:56', name: 'BSC Mainnet', symbol: 'BNB' },
      { key: 'eip155:1', name: 'Ethereum Mainnet', symbol: 'ETH' },
      { key: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', name: 'Solana Mainnet', symbol: 'SOL' },
    ];

    const balances: Array<{
      blockchainKey: string;
      balance: string;
      address: string;
      symbol: string;
    }> = [];

    for (const blockchain of blockchains) {
      try {
        const hotWallet = await this.walletService.getHotWallet(blockchain.key);
        const address = hotWallet.address;
        const balanceNum = await hotWallet.wallet.getBalance(address);
        const balance = balanceNum.toString();

        this.logger.log(`✓ ${blockchain.name}: ${balance} ${blockchain.symbol} (${address})`);

        // Only include if balance > 0
        if (parseFloat(balance) > 0) {
          balances.push({
            blockchainKey: blockchain.key,
            balance,
            address,
            symbol: blockchain.symbol,
          });
        }
      } catch (error) {
        this.logger.error(`✗ Failed to get balance for ${blockchain.name}:`, error);
      }
    }

    return balances;
  }

  /**
   * Calculate required Binance balance based on 1:1 equal distribution
   * Formula: Each side should have Total / 2
   *
   * Example:
   * - Hot wallets: 1 BNB, Binance: 0 BNB
   * - Total: 1 BNB
   * - Target: Hot wallets = 0.5 BNB, Binance = 0.5 BNB
   *
   * Example 2:
   * - Hot wallets: 0.5 BNB, Binance: 0.3 BNB
   * - Total: 0.8 BNB
   * - Target: Hot wallets = 0.4 BNB, Binance = 0.4 BNB
   */
  calculateRequiredBinanceBalance(hotWalletTotal: string, ratio: number): string {
    const hotWalletNum = Number.parseFloat(hotWalletTotal);

    // For 1:1 distribution, we need to know current Binance balance
    // But this method only has hotWalletTotal, so we return half of hot wallet
    // The actual calculation is done in calculateSettlementAmount where we have both values

    // Legacy ratio-based formula (kept for backward compatibility with ratio parameter)
    // But for 1:1, this will be overridden in calculateSettlementAmount
    const binanceTarget = hotWalletNum * (ratio / (1 - ratio));

    return binanceTarget.toString();
  }

  /**
   * Calculate settlement amount needed for 1:1 equal distribution
   * Returns positive if need to transfer TO Binance, negative if need to withdraw FROM Binance
   *
   * Formula:
   * - Total = hotWalletTotal + currentBinance
   * - Target for each side = Total / 2
   * - Settlement amount = targetBinance - currentBinance
   *
   * Example 1: Hot wallet = 1 BNB, Binance = 0
   * - Total = 1 + 0 = 1 BNB
   * - Target Binance = 1 / 2 = 0.5 BNB
   * - Settlement = 0.5 - 0 = +0.5 (transfer 0.5 BNB TO Binance)
   *
   * Example 2: Hot wallet = 0.3 BNB, Binance = 0.7 BNB
   * - Total = 0.3 + 0.7 = 1 BNB
   * - Target Binance = 1 / 2 = 0.5 BNB
   * - Settlement = 0.5 - 0.7 = -0.2 (withdraw 0.2 BNB FROM Binance)
   */
  calculateSettlementAmount(hotWalletTotal: string, currentBinance: string, ratio: number): string {
    const hotWalletNum = Number.parseFloat(hotWalletTotal);
    const currentBinanceNum = Number.parseFloat(currentBinance);

    // Calculate total across both hot wallets and Binance
    const total = hotWalletNum + currentBinanceNum;

    // For 1:1 distribution, each side should have exactly half
    const targetBinance = total / 2;

    // Positive = need to transfer TO Binance
    // Negative = need to withdraw FROM Binance
    const difference = targetBinance - currentBinanceNum;

    this.logger.debug(
      `Settlement calculation: Total=${total.toFixed(8)}, ` +
        `Current: HW=${hotWalletNum.toFixed(8)} + Binance=${currentBinanceNum.toFixed(8)}, ` +
        `Target: HW=${(total / 2).toFixed(8)} + Binance=${targetBinance.toFixed(8)}, ` +
        `Settlement=${difference > 0 ? '+' : ''}${difference.toFixed(8)}`,
    );

    return difference.toString();
  }

  /**
   * Process settlement for a specific currency across all blockchains
   * Balances hot wallets with Binance according to configured ratio
   */
  async settleCurrency(currencyTokenId: string): Promise<SettlementResult[]> {
    const targetNetwork = this.configService.get<string>(
      'SETTLEMENT_TARGET_NETWORK',
      defaultSettlementConfig.targetNetwork,
    );

    const ratio =
      this.configService.get<number>(
        'SETTLEMENT_PERCENTAGE',
        defaultSettlementConfig.targetPercentage,
      ) / 100;

    this.logger.log(`Processing settlement for currency: ${currencyTokenId}`);
    this.logger.log(`Target distribution: 1:1 (Equal split between Hot Wallets and Binance)`);

    const results: SettlementResult[] = [];

    try {
      // 1. Get blockchain keys that should have this currency (from DB to know which blockchains to check)
      const blockchainKeysFromDb =
        await this.repository.platformGetsHotWalletBalancesForCurrency(currencyTokenId);

      if (blockchainKeysFromDb.length === 0) {
        this.logger.debug(`No blockchain keys configured for ${currencyTokenId}`);
        return [];
      }

      const blockchainKeys = blockchainKeysFromDb.map(hw => hw.blockchainKey);
      this.logger.debug(
        `Checking ${blockchainKeys.length} blockchains for ${currencyTokenId}: ${blockchainKeys.join(', ')}`,
      );

      // 2. Get ACTUAL blockchain balances (not from DB)
      const hotWallets = await Promise.allSettled(
        blockchainKeys.map(async blockchainKey => {
          try {
            const hotWallet = await this.walletService.getHotWallet(blockchainKey);
            const address = await hotWallet.wallet.getAddress();
            const balance = await hotWallet.wallet.getBalance(address);
            return { blockchainKey, balance: balance.toString(), address };
          } catch (error) {
            this.logger.error(`Failed to get balance for ${blockchainKey}: ${error}`);
            return null;
          }
        }),
      ).then(results =>
        results
          .filter(
            (
              r,
            ): r is PromiseFulfilledResult<{
              blockchainKey: string;
              balance: string;
              address: string;
            } | null> => r.status === 'fulfilled',
          )
          .map(r => r.value)
          .filter(
            (v): v is { blockchainKey: string; balance: string; address: string } => v !== null,
          ),
      );

      if (hotWallets.length === 0) {
        this.logger.debug(`No actual balances found on blockchains for ${currencyTokenId}`);
        return [];
      }

      // 3. Calculate total hot wallet balance from actual blockchain data
      const totalHotWallet = hotWallets.reduce((sum, hw) => sum + Number.parseFloat(hw.balance), 0);

      this.logger.log(
        `Total hot wallet balance (from blockchain): ${totalHotWallet.toFixed(2)} ${currencyTokenId}`,
      );
      hotWallets.forEach(hw => {
        this.logger.debug(`  ${hw.blockchainKey}: ${hw.balance} (${hw.address})`);
      });

      // 4. Get current Binance balance
      const currentBinance = await this.getBinanceBalance(currencyTokenId);
      const currentBinanceNum = Number.parseFloat(currentBinance);

      this.logger.log(
        `Current Binance balance: ${currentBinanceNum.toFixed(2)} ${currencyTokenId}`,
      );

      // 5. Calculate required settlement amount
      const settlementAmount = this.calculateSettlementAmount(
        totalHotWallet.toString(),
        currentBinance,
        ratio,
      );
      const settlementNum = Number.parseFloat(settlementAmount);

      if (Math.abs(settlementNum) < 0.01) {
        this.logger.log(`Settlement not needed for ${currencyTokenId} (difference < 0.01)`);
        return [];
      }

      this.logger.log(
        `Settlement needed: ${settlementNum > 0 ? 'Transfer TO' : 'Withdraw FROM'} Binance: ${Math.abs(settlementNum).toFixed(2)} ${currencyTokenId}`,
      );

      // 6. Execute settlement transfers
      if (settlementNum > 0) {
        // Need to transfer TO Binance - deposit from hot wallets to Binance
        results.push(
          ...(await this.depositToBinance(
            currencyTokenId,
            hotWallets,
            totalHotWallet,
            settlementNum,
          )),
        );
      } else {
        // Need to withdraw FROM Binance - distribute to hot wallets
        results.push(
          ...(await this.withdrawFromBinance(
            currencyTokenId,
            hotWallets,
            totalHotWallet,
            Math.abs(settlementNum),
          )),
        );
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to settle currency ${currencyTokenId}:`, error);
      throw error;
    }
  }

  /**
   * Group currency token IDs by their Binance asset
   *
   * Binance groups balances by ASSET (e.g., USDT), not by network.
   * This means USDT on ETH, BSC, Polygon, etc. all share ONE balance on Binance.
   *
   * Example:
   * Input: ['eip155:1/erc20:0xdac17...', 'eip155:56/bep20:0x55d3...']
   * Output: Map { 'USDT' => ['eip155:1/erc20:0xdac17...', 'eip155:56/bep20:0x55d3...'] }
   */
  private groupCurrenciesByAsset(currencyTokenIds: string[]): Map<string, string[]> {
    const assetGroups = new Map<string, string[]>();

    for (const tokenId of currencyTokenIds) {
      const mapping = this.binanceMapper.tokenToBinanceAsset(tokenId);

      if (!mapping) {
        this.logger.warn(`No Binance mapping for ${tokenId}, will skip in settlement`);
        continue;
      }

      const asset = mapping.asset; // e.g., 'USDT', 'BTC', 'USDC'

      if (!assetGroups.has(asset)) {
        assetGroups.set(asset, []);
      }

      assetGroups.get(asset)!.push(tokenId);
    }

    return assetGroups;
  }

  /**
   * Settle all hot wallets for a specific Binance asset across multiple networks
   *
   * This handles the fact that Binance has ONE balance per asset (e.g., USDT)
   * regardless of which network it's on (ETH, BSC, Polygon, etc.)
   *
   * @param asset - Binance asset symbol (e.g., 'USDT', 'BTC')
   * @param tokenIds - Array of currency token IDs that map to this asset
   * @param ratio - Settlement ratio (percentage of balance to maintain on Binance)
   */
  async settleAsset(asset: string, tokenIds: string[], ratio: number): Promise<SettlementResult[]> {
    this.logger.log(`Settling asset: ${asset} across ${tokenIds.length} network(s)`);
    this.logger.log(`Networks: ${tokenIds.join(', ')}`);

    const results: SettlementResult[] = [];

    try {
      // 1. Get hot wallet balances across ALL networks for this asset
      const allHotWallets: Array<{
        blockchainKey: string;
        balance: string;
        currencyTokenId: string;
      }> = [];

      for (const tokenId of tokenIds) {
        const wallets = await this.repository.platformGetsHotWalletBalancesForCurrency(tokenId);

        // Tag each wallet with its currency token ID for later reference
        for (const wallet of wallets) {
          allHotWallets.push({
            ...wallet,
            currencyTokenId: tokenId,
          });
        }
      }

      if (allHotWallets.length === 0) {
        this.logger.debug(`No hot wallet balances found for ${asset}`);
        return [];
      }

      // 2. Calculate total across all networks
      const totalHotWallet = allHotWallets.reduce(
        (sum, hw) => sum + Number.parseFloat(hw.balance),
        0,
      );

      this.logger.log(`Total ${asset} in hot wallets: ${totalHotWallet.toFixed(2)}`);

      // 3. Get Binance balance (single balance covering all networks)
      let currentBinanceNum = 0;

      if (this.binanceClient.isApiEnabled()) {
        const binanceBalance = await this.binanceClient.getAssetBalance(asset);

        if (binanceBalance) {
          currentBinanceNum =
            Number.parseFloat(binanceBalance.free) + Number.parseFloat(binanceBalance.locked);
          this.logger.log(`Binance ${asset} balance (API): ${currentBinanceNum.toFixed(2)}`);
        } else {
          this.logger.log(`No Binance balance found for ${asset} (API)`);
        }
      } else {
        // Fallback: try to get blockchain balance (BSC only)
        this.logger.debug('Binance API disabled, using blockchain balance fallback');
        // Use first token ID as representative
        const currentBinance = await this.getBinanceBalance(tokenIds[0]);
        currentBinanceNum = Number.parseFloat(currentBinance);
        this.logger.log(`Binance ${asset} balance (blockchain): ${currentBinanceNum.toFixed(2)}`);
      }

      // 4. Calculate required settlement amount
      const settlementAmount = this.calculateSettlementAmount(
        totalHotWallet.toString(),
        currentBinanceNum.toString(),
        ratio,
      );
      const settlementNum = Number.parseFloat(settlementAmount);

      if (Math.abs(settlementNum) < 0.01) {
        this.logger.log(`Settlement not needed for ${asset} (difference < 0.01)`);
        return [];
      }

      this.logger.log(
        `Settlement needed: ${settlementNum > 0 ? 'Transfer TO' : 'Withdraw FROM'} Binance: ${Math.abs(settlementNum).toFixed(2)} ${asset}`,
      );

      // 5. Execute settlement transfers
      if (settlementNum > 0) {
        // Need to transfer TO Binance - deposit from hot wallets
        results.push(
          ...(await this.depositToBinanceByAsset(
            asset,
            allHotWallets,
            totalHotWallet,
            settlementNum,
          )),
        );
      } else {
        // Need to withdraw FROM Binance - distribute to hot wallets
        results.push(
          ...(await this.withdrawFromBinanceByAsset(
            asset,
            allHotWallets,
            totalHotWallet,
            Math.abs(settlementNum),
          )),
        );
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to settle asset ${asset}:`, error);
      throw error;
    }
  }

  /**
   * Execute settlement for all currencies using ACTUAL blockchain balances
   * Groups by Binance asset (USDT, BTC, etc.) since Binance maintains one balance per asset
   * regardless of which network the tokens are on (ETH, BSC, Polygon, etc.)
   */
  async executeSettlement(): Promise<SettlementResult[]> {
    const isEnabled = this.configService.get<boolean>(
      'SETTLEMENT_ENABLED',
      defaultSettlementConfig.enabled,
    );

    if (!isEnabled) {
      this.logger.warn('Settlement is disabled via configuration');
      return [];
    }

    this.logger.log('=== Starting Settlement Process (Using Actual Balances) ===');

    try {
      // Get ACTUAL blockchain balances (not from database)
      const actualBalances = await this.getActualBlockchainBalances();

      if (actualBalances.length === 0) {
        this.logger.log('No balances found in hot wallets (checked actual blockchain balances)');
        return [];
      }

      this.logger.log(`Found actual balances in ${actualBalances.length} hot wallet(s)`);

      const allResults: SettlementResult[] = [];

      // Process each blockchain with balance
      for (const hotWallet of actualBalances) {
        this.logger.log(`\n--- Settling ${hotWallet.symbol} on ${hotWallet.blockchainKey} ---`);

        const asset = hotWallet.symbol; // BNB, ETH, SOL

        try {
          // Get Binance balance for this asset
          const currentBinanceNum = await this.getBinanceBalance(asset);

          this.logger.log(`Hot Wallet: ${hotWallet.balance} ${asset}`);
          this.logger.log(`Binance: ${currentBinanceNum} ${asset}`);

          // Calculate settlement amount using 1:1 logic
          const settlementAmount = this.calculateSettlementAmount(
            hotWallet.balance,
            currentBinanceNum.toString(),
            0.5, // ratio parameter (ignored in 1:1 calculation)
          );

          const settlementNum = Number.parseFloat(settlementAmount);
          const minAmount = this.configService.get<number>(
            'SETTLEMENT_MIN_AMOUNT',
            0.001, // default min amount
          );

          if (Math.abs(settlementNum) < minAmount) {
            this.logger.log(
              `Settlement not needed (difference ${Math.abs(settlementNum).toFixed(8)} < ${minAmount})`,
            );
            continue;
          }

          this.logger.log(
            `Settlement needed: ${settlementNum > 0 ? 'Transfer TO' : 'Withdraw FROM'} Binance: ${Math.abs(settlementNum).toFixed(8)} ${asset}`,
          );

          if (settlementNum > 0) {
            // Transfer TO Binance
            // Create a token ID from blockchain and asset
            const tokenId = `${hotWallet.blockchainKey}:native`;

            // Call depositToBinance with correct parameters
            const results = await this.depositToBinance(
              tokenId,
              [{ blockchainKey: hotWallet.blockchainKey, balance: hotWallet.balance }],
              Number.parseFloat(hotWallet.balance),
              settlementNum,
            );
            allResults.push(...results);
          } else {
            // Withdraw FROM Binance (not implemented yet, log warning)
            this.logger.warn('Withdraw from Binance not yet implemented in this version');
          }
        } catch (error) {
          this.logger.error(`Failed to settle ${asset}:`, error);
          allResults.push({
            success: false,
            blockchainKey: hotWallet.blockchainKey,
            originalBalance: hotWallet.balance,
            settlementAmount: '0',
            remainingBalance: hotWallet.balance,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }

      const successCount = allResults.filter(r => r.success).length;
      const failCount = allResults.filter(r => !r.success).length;

      this.logger.log(
        `\n=== Settlement Complete: ${successCount} succeeded, ${failCount} failed ===`,
      );

      // Store settlement results in database
      if (allResults.length > 0) {
        await this.storeSettlementResults(allResults);
      }

      // Run immediate reconciliation
      if (allResults.length > 0) {
        this.logger.log('\n=== Running Immediate Reconciliation ===');
        const report = this.generateReconciliationReport(allResults);
        await this.processReconciliationReport(report);
      }

      return allResults;
    } catch (error) {
      this.logger.error('Settlement process failed:', error);
      throw error;
    }
  }

  /**
   * Deposit funds TO Binance from hot wallets (asset-based)
   * Handles deposits across multiple networks for the same asset
   *
   * @param asset - Binance asset (e.g., 'USDT')
   * @param hotWallets - All hot wallets across all networks for this asset
   * @param totalHotWallet - Total balance across all networks
   * @param settlementAmount - Amount to deposit
   */
  private async depositToBinanceByAsset(
    asset: string,
    hotWallets: Array<{ blockchainKey: string; balance: string; currencyTokenId: string }>,
    totalHotWallet: number,
    settlementAmount: number,
  ): Promise<SettlementResult[]> {
    const results: SettlementResult[] = [];

    // Transfer from each hot wallet proportionally
    for (const hw of hotWallets) {
      const hwBalance = Number.parseFloat(hw.balance);
      const proportion = hwBalance / totalHotWallet;
      const transferAmount = settlementAmount * proportion;

      if (transferAmount < 0.01) {
        this.logger.debug(`Skipping ${hw.blockchainKey}: transfer amount too small`);
        continue;
      }

      // Get asset mapping for this specific token
      const assetMapping = this.binanceMapper.tokenToBinanceAsset(hw.currencyTokenId);

      if (!assetMapping) {
        this.logger.error(`Cannot deposit: no asset mapping for ${hw.currencyTokenId}`);
        continue;
      }

      // Get Binance deposit address for this specific network
      let depositAddress: string;
      try {
        if (this.binanceClient.isApiEnabled()) {
          const depositInfo = await this.binanceClient.getDepositAddress(
            assetMapping.asset,
            assetMapping.network,
          );
          depositAddress = depositInfo.address;
          this.logger.log(
            `Binance deposit address for ${assetMapping.asset} (${assetMapping.network}): ${depositAddress}`,
          );
        } else {
          // Fallback to configured target network address
          const targetNetwork = this.configService.get<string>(
            'SETTLEMENT_TARGET_NETWORK',
            defaultSettlementConfig.targetNetwork,
          );
          const binanceHotWallet = await this.walletService.getHotWallet(targetNetwork);
          depositAddress = binanceHotWallet.address;
          this.logger.warn('Binance API disabled, using BSC hot wallet address');
        }
      } catch (error) {
        this.logger.error(
          `Failed to get Binance deposit address for ${assetMapping.network}:`,
          error,
        );
        continue;
      }

      // Execute transfer
      try {
        const sourceHotWallet = await this.walletService.getHotWallet(hw.blockchainKey);

        this.logger.log(
          `Depositing ${transferAmount.toFixed(2)} ${asset} from ${hw.blockchainKey} to Binance (${depositAddress})...`,
        );

        const txResult = await sourceHotWallet.wallet.transfer({
          tokenId: hw.currencyTokenId,
          from: sourceHotWallet.address,
          to: depositAddress,
          value: transferAmount.toString(),
        });

        const result: SettlementResult = {
          success: true,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: transferAmount.toString(),
          remainingBalance: (hwBalance - transferAmount).toString(),
          transactionHash: txResult.txHash,
          timestamp: new Date(),
        };

        this.logger.log(`✓ Deposit completed (tx: ${txResult.txHash})`);

        // Verify deposit appears in Binance
        await this.verifyDeposit(result, asset, depositAddress, hw.blockchainKey);

        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to deposit from ${hw.blockchainKey}:`, error);
        results.push({
          success: false,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: '0',
          remainingBalance: hw.balance,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Deposit funds TO Binance from hot wallets (legacy single-currency method)
   * Kept for backward compatibility with settleCurrency()
   * Gets Binance deposit address and sends blockchain transfers
   */
  private async depositToBinance(
    currencyTokenId: string,
    hotWallets: Array<{ blockchainKey: string; balance: string }>,
    totalHotWallet: number,
    settlementAmount: number,
  ): Promise<SettlementResult[]> {
    const results: SettlementResult[] = [];

    // Get Binance asset mapping
    const assetMapping = this.binanceMapper.tokenToBinanceAsset(currencyTokenId);

    if (!assetMapping) {
      this.logger.error(`Cannot deposit to Binance: no asset mapping for ${currencyTokenId}`);
      return [];
    }

    // Get Binance deposit address
    let depositAddress: string;
    try {
      if (this.binanceClient.isApiEnabled()) {
        const depositInfo = await this.binanceClient.getDepositAddress(
          assetMapping.asset,
          assetMapping.network,
        );
        depositAddress = depositInfo.address;
        this.logger.log(
          `Binance deposit address for ${assetMapping.asset} (${assetMapping.network}): ${depositAddress}`,
        );
      } else {
        // Fallback to configured target network address
        const targetNetwork = this.configService.get<string>(
          'SETTLEMENT_TARGET_NETWORK',
          defaultSettlementConfig.targetNetwork,
        );
        const binanceHotWallet = await this.walletService.getHotWallet(targetNetwork);
        depositAddress = binanceHotWallet.address;
        this.logger.warn('Binance API disabled, using BSC hot wallet address');
      }
    } catch (error) {
      this.logger.error('Failed to get Binance deposit address:', error);
      return [];
    }

    // Transfer from each hot wallet proportionally
    for (const hw of hotWallets) {
      const hwBalance = Number.parseFloat(hw.balance);
      const proportion = hwBalance / totalHotWallet;
      const transferAmount = settlementAmount * proportion;

      const minTransferAmount = this.configService.get<number>(
        'SETTLEMENT_MIN_TRANSFER',
        0.0001, // Lower default for testing with small amounts
      );

      if (transferAmount < minTransferAmount) {
        this.logger.warn(
          `⊘ Skipping ${hw.blockchainKey}: transfer amount ${transferAmount.toFixed(8)} < minimum ${minTransferAmount}`,
        );
        continue;
      }

      try {
        const sourceHotWallet = await this.walletService.getHotWallet(hw.blockchainKey);

        this.logger.log(
          `Depositing ${transferAmount.toFixed(2)} ${currencyTokenId} from ${hw.blockchainKey} to Binance (${depositAddress})...`,
        );

        const txResult = await sourceHotWallet.wallet.transfer({
          tokenId: currencyTokenId,
          from: sourceHotWallet.address,
          to: depositAddress,
          value: transferAmount.toString(),
        });

        results.push({
          success: true,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: transferAmount.toString(),
          remainingBalance: (hwBalance - transferAmount).toString(),
          transactionHash: txResult.txHash,
          timestamp: new Date(),
        });

        this.logger.log(`✓ Deposit completed (tx: ${txResult.txHash})`);
      } catch (error) {
        this.logger.error(`Failed to deposit from ${hw.blockchainKey}:`, error);
        results.push({
          success: false,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: '0',
          remainingBalance: hw.balance,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Withdraw funds FROM Binance to hot wallets (asset-based)
   * Handles withdrawals across multiple networks for the same asset
   *
   * @param asset - Binance asset (e.g., 'USDT')
   * @param hotWallets - All hot wallets across all networks for this asset
   * @param totalHotWallet - Total balance across all networks
   * @param withdrawalAmount - Amount to withdraw
   */
  private async withdrawFromBinanceByAsset(
    asset: string,
    hotWallets: Array<{ blockchainKey: string; balance: string; currencyTokenId: string }>,
    totalHotWallet: number,
    withdrawalAmount: number,
  ): Promise<SettlementResult[]> {
    const results: SettlementResult[] = [];

    if (!this.binanceClient.isApiEnabled()) {
      this.logger.error('Binance API is disabled - cannot perform withdrawals');
      this.logger.warn('Manual intervention required to withdraw from Binance');
      return [];
    }

    // Withdraw to each hot wallet proportionally
    for (const hw of hotWallets) {
      const hwBalance = Number.parseFloat(hw.balance);
      const proportion = hwBalance / totalHotWallet;
      const transferAmount = withdrawalAmount * proportion;

      if (transferAmount < 0.01) {
        this.logger.debug(`Skipping ${hw.blockchainKey}: withdrawal amount too small`);
        continue;
      }

      try {
        const targetHotWallet = await this.walletService.getHotWallet(hw.blockchainKey);

        this.logger.log(
          `Withdrawing ${transferAmount.toFixed(2)} ${asset} from Binance to ${hw.blockchainKey} (${targetHotWallet.address})...`,
        );

        // Get network for withdrawal
        const network = this.binanceMapper.blockchainKeyToBinanceNetwork(hw.blockchainKey);

        if (!network) {
          throw new Error(`Cannot map blockchain ${hw.blockchainKey} to Binance network`);
        }

        const withdrawalResult = await this.binanceClient.withdraw(
          asset,
          targetHotWallet.address,
          transferAmount.toString(),
          network,
        );

        const result: SettlementResult = {
          success: true,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: transferAmount.toString(),
          remainingBalance: (hwBalance + transferAmount).toString(),
          transactionHash: withdrawalResult.id, // Store withdrawal ID as txHash
          timestamp: new Date(),
        };

        this.logger.log(`✓ Withdrawal initiated (ID: ${withdrawalResult.id})`);

        // Verify withdrawal lands on blockchain
        const targetHotWalletAddress = targetHotWallet.address;
        await this.verifyWithdrawal(result, asset, targetHotWalletAddress, hw.blockchainKey);

        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to withdraw to ${hw.blockchainKey}:`, error);
        results.push({
          success: false,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: '0',
          remainingBalance: hw.balance,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Withdraw funds FROM Binance to hot wallets (legacy single-currency method)
   * Kept for backward compatibility with settleCurrency()
   * Uses Binance withdrawal API to send to blockchain addresses
   */
  private async withdrawFromBinance(
    currencyTokenId: string,
    hotWallets: Array<{ blockchainKey: string; balance: string }>,
    totalHotWallet: number,
    withdrawalAmount: number,
  ): Promise<SettlementResult[]> {
    const results: SettlementResult[] = [];

    // Get Binance asset mapping
    const assetMapping = this.binanceMapper.tokenToBinanceAsset(currencyTokenId);

    if (!assetMapping) {
      this.logger.error(`Cannot withdraw from Binance: no asset mapping for ${currencyTokenId}`);
      return [];
    }

    if (!this.binanceClient.isApiEnabled()) {
      this.logger.error('Binance API is disabled - cannot perform withdrawals');
      this.logger.warn('Manual intervention required to withdraw from Binance');
      return [];
    }

    // Withdraw to each hot wallet proportionally
    for (const hw of hotWallets) {
      const hwBalance = Number.parseFloat(hw.balance);
      const proportion = hwBalance / totalHotWallet;
      const transferAmount = withdrawalAmount * proportion;

      if (transferAmount < 0.01) {
        this.logger.debug(`Skipping ${hw.blockchainKey}: withdrawal amount too small`);
        continue;
      }

      try {
        const targetHotWallet = await this.walletService.getHotWallet(hw.blockchainKey);

        this.logger.log(
          `Withdrawing ${transferAmount.toFixed(2)} ${assetMapping.asset} from Binance to ${hw.blockchainKey} (${targetHotWallet.address})...`,
        );

        // Get network for withdrawal
        const network = this.binanceMapper.blockchainKeyToBinanceNetwork(hw.blockchainKey);

        if (!network) {
          throw new Error(`Cannot map blockchain ${hw.blockchainKey} to Binance network`);
        }

        const withdrawalResult = await this.binanceClient.withdraw(
          assetMapping.asset,
          targetHotWallet.address,
          transferAmount.toString(),
          network,
        );

        results.push({
          success: true,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: transferAmount.toString(),
          remainingBalance: (hwBalance + transferAmount).toString(),
          transactionHash: withdrawalResult.id, // Store withdrawal ID as txHash
          timestamp: new Date(),
        });

        this.logger.log(`✓ Withdrawal initiated (ID: ${withdrawalResult.id})`);
      } catch (error) {
        this.logger.error(`Failed to withdraw to ${hw.blockchainKey}:`, error);
        results.push({
          success: false,
          blockchainKey: hw.blockchainKey,
          originalBalance: hw.balance,
          settlementAmount: '0',
          remainingBalance: hw.balance,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Store settlement results in the database for audit trail
   */
  private async storeSettlementResults(results: SettlementResult[]): Promise<void> {
    try {
      for (const result of results) {
        await this.repository.platformStoresSettlementResult({
          blockchainKey: result.blockchainKey,
          originalBalance: result.originalBalance,
          settlementAmount: result.settlementAmount,
          remainingBalance: result.remainingBalance,
          transactionHash: result.transactionHash ?? null,
          success: result.success,
          errorMessage: result.error ?? null,
          settledAt: result.timestamp,
        });
      }

      this.logger.debug(`Stored ${results.length} settlement results in database`);
    } catch (error) {
      this.logger.error('Failed to store settlement results:', error);
      // Don't throw - settlement was already done, this is just logging
    }
  }

  /**
   * Get settlement history
   */
  async getSettlementHistory(limit = 100): Promise<SettlementResult[]> {
    try {
      const logs = await this.repository.platformGetsSettlementHistory(limit);

      return logs.map(log => ({
        success: log.success,
        blockchainKey: log.blockchainKey,
        originalBalance: log.originalBalance,
        settlementAmount: log.settlementAmount,
        remainingBalance: log.remainingBalance,
        transactionHash: log.transactionHash ?? undefined,
        error: log.errorMessage ?? undefined,
        timestamp: log.settledAt,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch settlement history:', error);
      return [];
    }
  }

  /**
   * Get blockchain service for a specific blockchain key
   * Maps blockchain keys to their respective settlement services
   */
  private getBlockchainServiceForKey(blockchainKey: string): SettlementBlockchainService {
    // For now, we only support Solana
    // TODO: Add ETH, BTC services when implemented
    if (blockchainKey.startsWith('solana:')) {
      return this.solService;
    }

    throw new Error(`Unsupported blockchain: ${blockchainKey}`);
  }

  /**
   * Verify deposit appears in Binance after blockchain transfer
   * Uses TransactionMatchingService with timeout
   */
  private async verifyDeposit(
    result: SettlementResult,
    asset: string,
    depositAddress: string,
    blockchainKey: string,
  ): Promise<void> {
    if (!result.transactionHash) {
      this.logger.warn('Cannot verify deposit: no transaction hash');
      return;
    }

    try {
      this.logger.log(`Verifying deposit ${result.transactionHash} appears in Binance...`);

      // Get the appropriate blockchain service
      const blockchainService = this.getBlockchainServiceForKey(blockchainKey);

      const matchResult = await this.transactionMatcher.waitForDepositMatch(
        {
          txHash: result.transactionHash,
          blockchain: blockchainKey,
          coin: asset,
          expectedAddress: depositAddress,
          expectedAmount: result.settlementAmount,
        },
        blockchainService,
        10, // 10 minutes timeout
      );

      if (matchResult.matched) {
        result.verified = true;
        result.verificationTimestamp = new Date();
        result.verificationDetails = {
          blockchainConfirmed: matchResult.blockchainData?.confirmed ?? false,
          binanceMatched: matchResult.binanceData?.found ?? false,
          amountMatches: matchResult.amountMatch ?? false,
        };
        this.logger.log(`✓ Deposit verified in Binance`);
      } else {
        throw new Error(matchResult.error || 'Deposit not found in Binance');
      }
    } catch (error) {
      result.verified = false;
      result.verificationError = error instanceof Error ? error.message : 'Unknown error';
      result.verificationTimestamp = new Date();

      this.logger.error(`✗ Deposit verification failed:`, error);
      await this.alertService.alertVerificationFailure(result, 'deposit');
    }
  }

  /**
   * Verify withdrawal lands on blockchain after Binance transfer
   * Uses TransactionMatchingService with timeout
   */
  private async verifyWithdrawal(
    result: SettlementResult,
    asset: string,
    targetAddress: string,
    blockchainKey: string,
  ): Promise<void> {
    if (!result.transactionHash) {
      this.logger.warn('Cannot verify withdrawal: no withdrawal ID');
      return;
    }

    try {
      this.logger.log(`Verifying withdrawal ${result.transactionHash} lands on blockchain...`);

      // Get the appropriate blockchain service
      const blockchainService = this.getBlockchainServiceForKey(blockchainKey);

      const matchResult = await this.transactionMatcher.waitForWithdrawalMatch(
        {
          withdrawalId: result.transactionHash,
          blockchain: blockchainKey,
          coin: asset,
          expectedAddress: targetAddress,
          expectedAmount: result.settlementAmount,
        },
        blockchainService,
        10, // 10 minutes timeout
      );

      if (matchResult.matched) {
        result.verified = true;
        result.verificationTimestamp = new Date();
        result.verificationDetails = {
          blockchainConfirmed: matchResult.blockchainData?.confirmed ?? false,
          binanceMatched: true,
          amountMatches: matchResult.amountMatch ?? false,
        };
        // Update txHash with actual blockchain transaction if available
        if (matchResult.blockchainData?.found) {
          // withdrawal ID is not the same as blockchain txHash
          this.logger.log(`Withdrawal ID: ${result.transactionHash}, blockchain confirmed`);
        }
        this.logger.log(`✓ Withdrawal verified on blockchain`);
      } else {
        throw new Error(matchResult.error || 'Withdrawal not found on blockchain');
      }
    } catch (error) {
      result.verified = false;
      result.verificationError = error instanceof Error ? error.message : 'Unknown error';
      result.verificationTimestamp = new Date();

      this.logger.error(`✗ Withdrawal verification failed:`, error);
      await this.alertService.alertVerificationFailure(result, 'withdrawal');
    }
  }

  /**
   * Generate reconciliation report from settlement results
   * Analyzes verification status and counts successes/failures
   */
  private generateReconciliationReport(results: SettlementResult[]): ReconciliationReport {
    const today = new Date().toISOString().split('T')[0];

    const report: ReconciliationReport = {
      date: today,
      totalDeposits: 0,
      verifiedDeposits: 0,
      failedDeposits: 0,
      totalWithdrawals: 0,
      verifiedWithdrawals: 0,
      failedWithdrawals: 0,
      discrepancies: [],
      timestamp: new Date(),
    };

    // Separate deposits and withdrawals based on txHash length
    // Deposits: long blockchain txHash (>60 chars)
    // Withdrawals: short Binance withdrawal ID (<=60 chars)
    const deposits = results.filter(
      r => r.success && r.transactionHash && r.transactionHash.length > 60,
    );
    const withdrawals = results.filter(
      r => r.success && r.transactionHash && r.transactionHash.length <= 60,
    );

    report.totalDeposits = deposits.length;
    report.totalWithdrawals = withdrawals.length;

    // Analyze deposits
    for (const deposit of deposits) {
      if (deposit.verified) {
        report.verifiedDeposits++;
      } else {
        report.failedDeposits++;
        report.discrepancies.push({
          transactionHash: deposit.transactionHash!,
          blockchainKey: deposit.blockchainKey,
          type: 'deposit',
          issue: deposit.verificationError || 'Verification failed',
          details: { deposit },
          timestamp: new Date(),
        });
      }
    }

    // Analyze withdrawals
    for (const withdrawal of withdrawals) {
      if (withdrawal.verified) {
        report.verifiedWithdrawals++;
      } else {
        report.failedWithdrawals++;
        report.discrepancies.push({
          transactionHash: withdrawal.transactionHash!,
          blockchainKey: withdrawal.blockchainKey,
          type: 'withdrawal',
          issue: withdrawal.verificationError || 'Verification failed',
          details: { withdrawal },
          timestamp: new Date(),
        });
      }
    }

    return report;
  }

  /**
   * Process reconciliation report - send alerts and summaries
   */
  private async processReconciliationReport(report: ReconciliationReport): Promise<void> {
    // Log summary
    this.logger.log(
      `Reconciliation: ${report.verifiedDeposits}/${report.totalDeposits} deposits verified, ` +
        `${report.verifiedWithdrawals}/${report.totalWithdrawals} withdrawals verified`,
    );

    if (report.discrepancies.length > 0) {
      this.logger.warn(`Found ${report.discrepancies.length} discrepancy(ies)`);
      await this.alertService.alertReconciliationDiscrepancies(report.discrepancies);
    }

    // Send daily summary
    await this.alertService.sendDailySummary(
      report.date,
      report.totalDeposits,
      report.verifiedDeposits,
      report.totalWithdrawals,
      report.verifiedWithdrawals,
    );
  }
}
