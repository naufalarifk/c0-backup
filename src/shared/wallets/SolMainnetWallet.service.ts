import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { Connection } from '@solana/web3.js';

import { BaseSolanaWallet } from './BaseSolanaWallet';
import { IWallet, IWalletService } from './Iwallet.types';

class SolanaMainnetWallet extends BaseSolanaWallet {
  protected connection: Connection;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, connection: Connection) {
    super(privateKey);
    this.connection = connection;
  }
}

@Injectable()
export class SolMainnetWalletService implements IWalletService {
  private readonly connection: Connection;

  constructor() {
    this.connection = new Connection('https://api.mainnet-beta.solana.com');
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
        resolve(new SolanaMainnetWallet(privateKey, this.connection));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
