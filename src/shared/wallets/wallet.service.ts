import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';

import { CryptographyService } from '../cryptography/cryptography.service';
import { AppConfigService } from '../services/app-config.service';
import { Wallet } from './wallet.abstract';
import { WalletFactory } from './wallet.factory';

export interface HotWallet {
  blockchainKey: string;
  address: string;
  bip44CoinType: number;
  wallet: Wallet;
}

@Injectable()
export class WalletService {
  constructor(private readonly walletFactory: WalletFactory) {}

  async deriveInvoiceWallet(
    blockchainKey: string,
    invoiceId: number,
  ): Promise<{
    wallet: Wallet;
    address: string;
    derivationPath: string;
  }> {
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new Error(`Invoice ID must be positive integer. Received: ${invoiceId}`);
    }

    const walletService = this.walletFactory.getBlockchain(blockchainKey);
    const derivationPath = walletService.getInvoiceDerivationPath(invoiceId);
    const wallet = await walletService.derivedPathToWallet(derivationPath);
    const address = await wallet.getAddress();

    return { wallet, address, derivationPath };
  }

  async getHotWallet(blockchainKey: string): Promise<HotWallet> {
    const blockchain = this.walletFactory.getBlockchain(blockchainKey);
    if (!blockchain) {
      throw new Error(`Unsupported blockchain key: ${blockchainKey}`);
    }
    const hotWallet = await blockchain.getHotWallet();
    return {
      blockchainKey,
      address: await hotWallet.getAddress(),
      bip44CoinType: blockchain.bip44CoinType,
      wallet: hotWallet,
    };
  }
}
