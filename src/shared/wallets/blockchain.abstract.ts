import { DiscoveryService } from '@nestjs/core';

import { BlockchainKey } from '../constants/blockchain';
import { TelemetryLogger } from '../telemetry.logger';
import { Wallet, WalletError } from './wallet.abstract';

export const Blockchain = DiscoveryService.createDecorator<BlockchainKey>();

export abstract class BlockchainAbstract {
  abstract get bip44CoinType(): number;

  getHotWallet(): Promise<Wallet> {
    // Use default derivation path (account 0) - same as MetaMask default
    // Changed from account 1005 to account 0 for easier wallet management
    return this.derivedPathToWallet(`m/44'/${this.bip44CoinType}'/0'/0/0`);
  }
  abstract derivedPathToWallet(derivationPath: string): Promise<Wallet>;

  getInvoiceDerivationPath(invoiceId: number): string {
    if (invoiceId < 0) {
      throw new WalletError(`Invoice ID must be positive. Received: ${invoiceId}`);
    }
    // Constrain invoice ID to valid BIP32 derivation range (0 to 2^31-1)
    // Use modulo to ensure we don't exceed the maximum index
    const constrainedId = invoiceId % 2147483647; // 2^31 - 1
    return `m/44'/${this.bip44CoinType}'/5'/0/${constrainedId}`;
  }

  async createInvoiceWallet(invoiceId: number): Promise<Wallet> {
    return await this.derivedPathToWallet(this.getInvoiceDerivationPath(invoiceId));
  }
}
