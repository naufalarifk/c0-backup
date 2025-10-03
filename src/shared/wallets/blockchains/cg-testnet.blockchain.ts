import { Injectable } from '@nestjs/common';

import { Blockchain } from '../blockchain.abstract';
import { Wallet, WalletError } from '../wallet.abstract';
import { WalletConfig } from '../wallet.config';
import { WalletProvider } from '../wallet.factory';
import { CgtWallet } from '../wallets/cgt.wallet';

@Injectable()
@WalletProvider('cg:testnet')
export class CgTestnetBlockchain extends Blockchain {
  constructor(private readonly walletConfig: WalletConfig) {
    super();
  }

  get bip44CoinType(): number {
    return 1;
  }

  async derivedPathToWallet(derivationPath: string): Promise<Wallet> {
    const masterKey = await this.walletConfig.getMasterKey();
    const derivedKey = masterKey.derive(derivationPath);
    const privateKey = derivedKey.privateKey;

    if (!privateKey) {
      throw new WalletError(
        `Mock blockchain derivation failed, private key is undefined for path ${derivationPath}`,
      );
    }

    return new CgtWallet(privateKey);
  }
}
