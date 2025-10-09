import type { HotWallet } from '../../../shared/wallets/wallet.service';
import type { BlockchainBalance } from '../settlement.types';

import { Injectable, Logger } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { WalletService } from '../../../shared/wallets/wallet.service';

@Injectable()
export class SettlementWalletService {
  private readonly logger = new Logger(SettlementWalletService.name);

  constructor(private readonly walletService: WalletService) {}

  /**
   * Get hot wallet for a specific blockchain
   * @param blockchainKey - Blockchain key (e.g., 'eip155:1' for Ethereum mainnet)
   * @returns Hot wallet details including address and wallet instance
   */
  async getHotWallet(blockchainKey: string): Promise<HotWallet> {
    return await this.walletService.getHotWallet(blockchainKey);
  }

  /**
   * Get multiple hot wallets for different blockchains
   * @param blockchainKeys - Array of blockchain keys
   * @returns Array of hot wallet details
   */
  async getHotWallets(blockchainKeys: string[]): Promise<HotWallet[]> {
    const wallets = await Promise.all(
      blockchainKeys.map(async key => await this.walletService.getHotWallet(key)),
    );
    return wallets;
  }
}
