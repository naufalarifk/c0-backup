import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { ethers } from 'ethers';

import { BaseEthereumWallet } from './BaseEthereumWallet';
import { IWallet, IWalletService } from './Iwallet.types';

class EthereumTestnetWallet extends BaseEthereumWallet {
  protected provider: ethers.JsonRpcProvider;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, provider: ethers.JsonRpcProvider) {
    super(privateKey);
    this.provider = provider;
  }
}

@Injectable()
export class EthTestnetWalletService implements IWalletService {
  private readonly provider: ethers.JsonRpcProvider;
  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://sepolia.drpc.org');
  }
  derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<IWallet> {
    return new Promise((resolve, reject) => {
      try {
        const { privateKey } = masterKey.derive(derivationPath);
        if (!privateKey) {
          throw new Error('Private key is undefined');
        }
        resolve(new EthereumTestnetWallet(privateKey, this.provider));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
