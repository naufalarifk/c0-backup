import type { BlockchainBalance, SettlementResult } from './settlement.types';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { BinanceAssetMapperService } from './binance-asset-mapper.service';
import { BinanceClientService } from './binance-client.service';
import { SettlementWalletService } from './currencies/wallet.service';
import { defaultSettlementConfig } from './settlement.config';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    private readonly configService: ConfigService,
    private readonly walletService: SettlementWalletService,
    private readonly binanceClient: BinanceClientService,
    private readonly binanceMapper: BinanceAssetMapperService,
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
   * Calculate required Binance balance based on configured ratio
   * Formula: binance_target = hot_wallets_total * (ratio / (1 - ratio))
   *
   * Example with 50% ratio (0.5):
   * - Hot wallets: 100 USDT
   * - Binance should have: 100 * (0.5 / 0.5) = 100 USDT
   * - Total system: 200 USDT (50% in hot wallets, 50% in Binance)
   */
  calculateRequiredBinanceBalance(hotWalletTotal: string, ratio: number): string {
    const hotWalletNum = Number.parseFloat(hotWalletTotal);

    // If ratio is 50% (0.5), Binance should equal hot wallets
    // If ratio is 33% (0.33), Binance should have 50% of hot wallets
    // Formula: binance = hot_wallets * (ratio / (1 - ratio))
    const binanceTarget = hotWalletNum * (ratio / (1 - ratio));

    return binanceTarget.toString();
  }

  /**
   * Calculate settlement amount needed to reach target ratio
   * Returns positive if need to transfer TO Binance, negative if need to withdraw FROM Binance
   */
  calculateSettlementAmount(hotWalletTotal: string, currentBinance: string, ratio: number): string {
    const targetBinance = this.calculateRequiredBinanceBalance(hotWalletTotal, ratio);
    const currentBinanceNum = Number.parseFloat(currentBinance);
    const targetBinanceNum = Number.parseFloat(targetBinance);

    // Positive = need to transfer TO Binance
    // Negative = need to withdraw FROM Binance
    const difference = targetBinanceNum - currentBinanceNum;

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
    this.logger.log(`Target ratio: ${(ratio * 100).toFixed(0)}% on Binance`);

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
      const hotWallets = await this.walletService.getHotWalletBalances(blockchainKeys);

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
   * Execute settlement for all currencies
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

    this.logger.log('=== Starting Settlement Process ===');

    try {
      // Get all unique currencies that have balances in hot wallets
      const currencies = await this.repository.platformGetsCurrenciesWithBalances();

      if (currencies.length === 0) {
        this.logger.log('No currencies found to settle');
        return [];
      }

      this.logger.log(`Found ${currencies.length} currency token(s) in hot wallets`);

      // Group currencies by Binance asset (USDT, BTC, etc.)
      const assetGroups = this.groupCurrenciesByAsset(currencies);

      this.logger.log(`Grouped into ${assetGroups.size} Binance asset(s)`);

      const ratio =
        this.configService.get<number>(
          'SETTLEMENT_PERCENTAGE',
          defaultSettlementConfig.targetPercentage,
        ) / 100;

      const allResults: SettlementResult[] = [];

      // Process each asset (not each currency token)
      for (const [asset, tokenIds] of assetGroups) {
        this.logger.log(`\n--- Settling ${asset} ---`);
        const results = await this.settleAsset(asset, tokenIds, ratio);
        allResults.push(...results);
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

      if (transferAmount < 0.01) {
        this.logger.debug(`Skipping ${hw.blockchainKey}: transfer amount too small`);
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
}
