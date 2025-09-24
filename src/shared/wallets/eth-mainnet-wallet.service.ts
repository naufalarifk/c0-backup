import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { ethers } from 'ethers';

import { BaseEthereumWallet } from './base-ethereum-wallet';
import { WalletProvider } from './Iwallet.service';
import { IWallet, IWalletService } from './Iwallet.types';

class EthereumMainnetWallet extends BaseEthereumWallet {
  protected provider: ethers.JsonRpcProvider;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, provider: ethers.JsonRpcProvider) {
    super(privateKey);
    this.provider = provider;
  }
}

@Injectable()
@WalletProvider('eip155:1')
export class EthMainnetWalletService extends IWalletService {
  rpcUrl = 'https://eth.llamarpc.com';

  private _provider?: ethers.JsonRpcProvider;
  protected get provider(): ethers.JsonRpcProvider {
    if (!this._provider) {
      this._provider = new ethers.JsonRpcProvider(this.rpcUrl);
    }
    return this._provider;
  }

  getHotWallet(masterKey: HDKey): Promise<IWallet> {
    return this.derivedPathToWallet({
      masterKey,
      derivationPath: `m/44'/${this.bip44CoinType}'/0'/10/0`,
    });
  }

  get bip44CoinType(): number {
    return 60;
  }

  derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<EthereumMainnetWallet> {
    return new Promise((resolve, reject) => {
      try {
        const { privateKey } = masterKey.derive(derivationPath);
        if (!privateKey) {
          throw new Error('Private key is undefined');
        }
        resolve(new EthereumMainnetWallet(privateKey, this.provider));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
