import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { ethers } from 'ethers';

import { BaseEthereumWallet } from './base-ethereum-wallet';
import { WalletProvider } from './Iwallet.service';
import { IWallet, IWalletService } from './Iwallet.types';

class BscMainnetWallet extends BaseEthereumWallet {
  protected provider: ethers.JsonRpcProvider;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, provider: ethers.JsonRpcProvider) {
    super(privateKey);
    this.provider = provider;
  }
}

@Injectable()
@WalletProvider('eip155:56')
export class BscMainnetWalletService extends IWalletService {
  rpcUrl = 'https://bsc-dataseed1.binance.org/';

  private _provider?: ethers.JsonRpcProvider;
  protected get provider(): ethers.JsonRpcProvider {
    if (!this._provider) {
      // Use a more reliable BSC RPC endpoint
      this._provider = new ethers.JsonRpcProvider('https://bsc.publicnode.com');
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
    return 60; // Same as Ethereum since BSC is EVM compatible
  }

  derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<BscMainnetWallet> {
    return new Promise((resolve, reject) => {
      try {
        const { privateKey } = masterKey.derive(derivationPath);
        if (!privateKey) {
          throw new Error('Private key is undefined');
        }
        resolve(new BscMainnetWallet(privateKey, this.provider));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
