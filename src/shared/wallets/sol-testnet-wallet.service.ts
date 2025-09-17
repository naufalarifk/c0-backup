import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { Connection } from '@solana/web3.js';

import { BaseSolanaWallet } from './base-solana-wallet';
import { WalletProvider } from './Iwallet.service';
import { IWallet, IWalletService } from './Iwallet.types';

class SolanaTestnetWallet extends BaseSolanaWallet {
  protected connection: Connection;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, connection: Connection) {
    super(privateKey);
    this.connection = connection;
  }
}

@Injectable()
@WalletProvider('solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z')
export class SolTestnetWalletService extends IWalletService {
  private readonly connection: Connection;
  get bip44CoinType(): number {
    return 501;
  }
  constructor() {
    super();
    this.connection = new Connection('https://api.testnet.solana.com');
  }

  derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<SolanaTestnetWallet> {
    return new Promise((resolve, reject) => {
      try {
        const { privateKey } = masterKey.derive(derivationPath);
        if (!privateKey) {
          throw new Error('Private key is undefined');
        }
        resolve(new SolanaTestnetWallet(privateKey, this.connection));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
