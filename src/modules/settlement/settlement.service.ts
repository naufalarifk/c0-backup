import type { BlockchainBalance, SettlementResult } from './settlement.types';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isBoolean,
  isNullable,
  isString,
} from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { WalletService } from '../../shared/wallets/wallet.service';
import { defaultSettlementConfig } from './settlement.types';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Get all blockchain balances from hot wallets (excluding crosschain and binance)
   * This represents the actual on-chain balances that need to be balanced with Binance
   */
  async getHotWalletBalances(): Promise<BlockchainBalance[]> {
    this.logger.debug('Fetching hot wallet balances...');

    try {
      // Query platform escrow accounts (user_id = 1) for all blockchains
      // Exclude: crosschain currencies, binance (target network), and mock/testnet currencies
      // These represent the actual hot wallet balances on each blockchain
      const balances = await this.repository.sql`
        SELECT 
          a.currency_blockchain_key as blockchain_key,
          SUM(a.balance)::text as total_balance,
          a.currency_token_id
        FROM accounts a
        WHERE a.user_id = 1
          AND a.account_type = 'PlatformEscrow'
          AND a.balance > 0
          AND a.currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
          AND a.currency_blockchain_key NOT LIKE 'bip122:000000000933%'
          AND a.currency_blockchain_key NOT LIKE 'eip155:11155111%'
          AND a.currency_blockchain_key NOT LIKE 'eip155:97%'
          AND a.currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%'
        GROUP BY a.currency_blockchain_key, a.currency_token_id
        ORDER BY a.currency_blockchain_key, a.currency_token_id
      `;

      // Validate and map the results
      assertArrayMapOf(balances, b => {
        assertDefined(b);
        assertPropString(b, 'blockchain_key');
        assertPropString(b, 'total_balance');
        assertPropString(b, 'currency_token_id');
        return b;
      });

      const blockchainBalances: BlockchainBalance[] = balances.map(b => ({
        blockchainKey: b.blockchain_key,
        balance: b.total_balance,
        currency: b.currency_token_id,
      }));

      this.logger.debug(`Found ${blockchainBalances.length} hot wallet balances`);
      return blockchainBalances;
    } catch (error) {
      this.logger.error('Failed to fetch hot wallet balances:', error);
      throw error;
    }
  }

  /**
   * Get Binance balance for a specific currency
   */
  async getBinanceBalance(currencyTokenId: string): Promise<string> {
    try {
      const result = await this.repository.sql`
        SELECT SUM(balance)::text as total_balance
        FROM accounts
        WHERE user_id = 1
          AND account_type = 'PlatformEscrow'
          AND currency_blockchain_key = 'eip155:56'
          AND currency_token_id = ${currencyTokenId}
        GROUP BY currency_token_id
      `;

      if (result.length === 0) {
        return '0';
      }

      assertArrayMapOf(result, r => {
        assertDefined(r);
        assertPropString(r, 'total_balance');
        return r;
      });

      return result[0].total_balance;
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
        defaultSettlementConfig.settlementPercentage,
      ) / 100;

    this.logger.log(`Processing settlement for currency: ${currencyTokenId}`);
    this.logger.log(`Target ratio: ${(ratio * 100).toFixed(0)}% on Binance`);

    const results: SettlementResult[] = [];

    try {
      // 1. Get all hot wallet balances for this currency
      // Exclude: crosschain, binance (target network), and mock/testnet currencies
      const hotWallets = await this.repository.sql`
        SELECT 
          a.currency_blockchain_key as blockchain_key,
          a.balance::text as balance
        FROM accounts a
        WHERE a.user_id = 1
          AND a.account_type = 'PlatformEscrow'
          AND a.currency_token_id = ${currencyTokenId}
          AND a.balance > 0
          AND a.currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
          AND a.currency_blockchain_key NOT LIKE 'bip122:000000000933%'
          AND a.currency_blockchain_key NOT LIKE 'eip155:11155111%'
          AND a.currency_blockchain_key NOT LIKE 'eip155:97%'
          AND a.currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%'
        ORDER BY a.currency_blockchain_key
      `;

      assertArrayMapOf(hotWallets, hw => {
        assertDefined(hw);
        assertPropString(hw, 'blockchain_key');
        assertPropString(hw, 'balance');
        return hw;
      });

      if (hotWallets.length === 0) {
        this.logger.debug(`No hot wallet balances found for ${currencyTokenId}`);
        return [];
      }

      // 2. Calculate total hot wallet balance
      const totalHotWallet = hotWallets.reduce((sum, hw) => sum + Number.parseFloat(hw.balance), 0);

      this.logger.log(`Total hot wallet balance: ${totalHotWallet.toFixed(2)} ${currencyTokenId}`);

      // 3. Get current Binance balance
      const currentBinance = await this.getBinanceBalance(currencyTokenId);
      const currentBinanceNum = Number.parseFloat(currentBinance);

      this.logger.log(
        `Current Binance balance: ${currentBinanceNum.toFixed(2)} ${currencyTokenId}`,
      );

      // 4. Calculate required settlement amount
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

      // 5. Execute settlement transfers
      if (settlementNum > 0) {
        // Need to transfer TO Binance - proportionally from all hot wallets
        const binanceHotWallet = await this.walletService.getHotWallet(targetNetwork);

        for (const hw of hotWallets) {
          const hwBalance = Number.parseFloat(hw.balance);
          const proportion = hwBalance / totalHotWallet;
          const transferAmount = settlementNum * proportion;

          if (transferAmount < 0.01) {
            this.logger.debug(`Skipping ${hw.blockchain_key}: transfer amount too small`);
            continue;
          }

          try {
            const sourceHotWallet = await this.walletService.getHotWallet(hw.blockchain_key);

            this.logger.log(
              `Transferring ${transferAmount.toFixed(2)} ${currencyTokenId} from ${hw.blockchain_key} to Binance...`,
            );

            const txResult = await sourceHotWallet.wallet.transfer({
              tokenId: currencyTokenId,
              from: sourceHotWallet.address,
              to: binanceHotWallet.address,
              value: transferAmount.toString(),
            });

            results.push({
              success: true,
              blockchainKey: hw.blockchain_key,
              originalBalance: hw.balance,
              settlementAmount: transferAmount.toString(),
              remainingBalance: (hwBalance - transferAmount).toString(),
              transactionHash: txResult.txHash,
              timestamp: new Date(),
            });

            this.logger.log(`✓ Transfer completed (tx: ${txResult.txHash})`);
          } catch (error) {
            this.logger.error(`Failed to transfer from ${hw.blockchain_key}:`, error);
            results.push({
              success: false,
              blockchainKey: hw.blockchain_key,
              originalBalance: hw.balance,
              settlementAmount: '0',
              remainingBalance: hw.balance,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
            });
          }
        }
      } else {
        // Need to withdraw FROM Binance - distribute to hot wallets
        // This is less common but included for completeness
        this.logger.warn(
          'Withdrawal from Binance not implemented yet - manual intervention required',
        );
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to settle currency ${currencyTokenId}:`, error);
      throw error;
    }
  }

  /**
   * Execute settlement for all currencies
   * Maintains ratio: (hot_wallets_total) / binance_balance = configured ratio
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
      // Exclude: crosschain, binance (target network), and mock/testnet currencies
      const currencies = await this.repository.sql`
        SELECT DISTINCT a.currency_token_id
        FROM accounts a
        WHERE a.user_id = 1
          AND a.account_type = 'PlatformEscrow'
          AND a.balance > 0
          AND a.currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
          AND a.currency_blockchain_key NOT LIKE 'bip122:000000000933%'
          AND a.currency_blockchain_key NOT LIKE 'eip155:11155111%'
          AND a.currency_blockchain_key NOT LIKE 'eip155:97%'
          AND a.currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%'
        ORDER BY a.currency_token_id
      `;

      assertArrayMapOf(currencies, c => {
        assertDefined(c);
        assertPropString(c, 'currency_token_id');
        return c;
      });

      if (currencies.length === 0) {
        this.logger.log('No currencies found to settle');
        return [];
      }

      this.logger.log(`Processing settlement for ${currencies.length} currency(ies)`);

      const allResults: SettlementResult[] = [];

      // Process each currency separately
      for (const curr of currencies) {
        this.logger.log(`--- Settling ${curr.currency_token_id} ---`);
        const results = await this.settleCurrency(curr.currency_token_id);
        allResults.push(...results);
      }

      const successCount = allResults.filter(r => r.success).length;
      const failCount = allResults.filter(r => !r.success).length;

      this.logger.log(
        `=== Settlement Complete: ${successCount} succeeded, ${failCount} failed ===`,
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
   * Store settlement results in the database for audit trail
   */
  private async storeSettlementResults(results: SettlementResult[]): Promise<void> {
    try {
      for (const result of results) {
        await this.repository.sql`
          INSERT INTO settlement_logs (
            blockchain_key,
            original_balance,
            settlement_amount,
            remaining_balance,
            transaction_hash,
            success,
            error_message,
            settled_at
          ) VALUES (
            ${result.blockchainKey},
            ${result.originalBalance},
            ${result.settlementAmount},
            ${result.remainingBalance},
            ${result.transactionHash ?? null},
            ${result.success},
            ${result.error ?? null},
            ${result.timestamp.toISOString()}
          )
        `;
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
      const rows = await this.repository.sql`
        SELECT 
          blockchain_key,
          original_balance,
          settlement_amount,
          remaining_balance,
          transaction_hash,
          success,
          error_message,
          settled_at
        FROM settlement_logs
        ORDER BY settled_at DESC
        LIMIT ${limit}
      `;

      // Validate and map the results
      assertArrayMapOf(rows, row => {
        assertDefined(row);
        assertPropString(row, 'blockchain_key');
        assertPropString(row, 'original_balance');
        assertPropString(row, 'settlement_amount');
        assertPropString(row, 'remaining_balance');
        assertProp(check(isNullable, isString), row, 'transaction_hash');
        assertProp(isBoolean, row, 'success');
        assertProp(check(isNullable, isString), row, 'error_message');
        assertPropString(row, 'settled_at');
        return row;
      });

      return rows.map(row => ({
        success: row.success,
        blockchainKey: row.blockchain_key,
        originalBalance: row.original_balance,
        settlementAmount: row.settlement_amount,
        remainingBalance: row.remaining_balance,
        transactionHash: row.transaction_hash ?? undefined,
        error: row.error_message ?? undefined,
        timestamp: new Date(row.settled_at),
      }));
    } catch (error) {
      this.logger.error('Failed to fetch settlement history:', error);
      return [];
    }
  }
}
