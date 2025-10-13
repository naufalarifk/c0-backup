import type { HotWallet } from '../../../shared/wallets/wallet.service';
import type { BlockchainBalance } from '../settlement.types';

import { Injectable, Logger } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { WalletService } from '../../../shared/wallets/wallet.service';

/**
 * Settlement Wallet Service
 *
 * Provides balance query methods with logging and error handling for settlement operations.
 * For direct hot wallet access, inject WalletService directly.
 */
@Injectable()
export class SettlementWalletService {
  private readonly logger = new Logger(SettlementWalletService.name);

  constructor(private readonly walletService: WalletService) {}

  /**
   * Get actual blockchain balance for a specific hot wallet
   * Queries the blockchain directly using wallet.getBalance()
   * @param blockchainKey - Blockchain key
   * @returns Balance as string
   */
  async getHotWalletBalance(blockchainKey: string): Promise<string> {
    try {
      const hotWallet = await this.walletService.getHotWallet(blockchainKey);
      const balance = await hotWallet.wallet.getBalance(hotWallet.address);
      this.logger.debug(
        `Blockchain balance for ${blockchainKey} (${hotWallet.address}): ${balance}`,
      );
      return balance.toString();
    } catch (error) {
      this.logger.error(
        `Failed to get blockchain balance for ${blockchainKey}:`,
        error instanceof Error ? error.message : error,
      );
      return '0';
    }
  }

  /**
   * Get actual blockchain balances for multiple hot wallets
   * Queries blockchains directly instead of using database
   * @param blockchainKeys - Array of blockchain keys
   * @returns Array of balances with blockchain keys
   */
  async getHotWalletBalances(
    blockchainKeys: string[],
  ): Promise<Array<{ blockchainKey: string; balance: string; address: string }>> {
    const results = await Promise.allSettled(
      blockchainKeys.map(async key => {
        const hotWallet = await this.walletService.getHotWallet(key);
        const balance = await hotWallet.wallet.getBalance(hotWallet.address);
        return {
          blockchainKey: key,
          balance: balance.toString(),
          address: hotWallet.address,
        };
      }),
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      this.logger.error(`Failed to get balance for ${blockchainKeys[index]}: ${result.reason}`);
      return {
        blockchainKey: blockchainKeys[index],
        balance: '0',
        address: '',
      };
    });
  }
}
