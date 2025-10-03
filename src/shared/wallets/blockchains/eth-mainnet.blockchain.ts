import { Injectable } from '@nestjs/common';

import { ethers } from 'ethers';

import { TelemetryLogger } from '../../telemetry.logger';
import { Blockchain } from '../blockchain.abstract';
import { WalletConfig } from '../wallet.config';
import { WalletProvider } from '../wallet.factory';
import { EthWallet } from '../wallets/eth.wallet';

@Injectable()
@WalletProvider('eip155:1')
export class EthMainnetBlockchain extends Blockchain {
  constructor(private readonly walletConfig: WalletConfig) {
    super();
  }

  rpcUrl = 'https://eth.llamarpc.com';
  #provider?: ethers.JsonRpcProvider;

  protected get provider(): ethers.JsonRpcProvider {
    if (!this.#provider) {
      this.#provider = new ethers.JsonRpcProvider(this.rpcUrl);
    }
    return this.#provider;
  }

  get bip44CoinType(): number {
    return 60;
  }

  async derivedPathToWallet(derivationPath: string): Promise<EthWallet> {
    const masterKey = await this.walletConfig.getMasterKey();
    const { privateKey } = masterKey.derive(derivationPath);
    if (!privateKey) {
      throw new Error('Private key is undefined');
    }
    return new EthWallet(privateKey, this.provider);
  }
}
