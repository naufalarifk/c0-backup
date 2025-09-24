import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { Connection } from '@solana/web3.js';

import { BaseSolanaWallet } from './base-solana-wallet';
import { WalletProvider } from './Iwallet.service';
import { IWallet, IWalletService } from './Iwallet.types';

class SolanaMainnetWallet extends BaseSolanaWallet {
  protected connection: Connection;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, connection: Connection) {
    super(privateKey);
    this.connection = connection;
  }
}

@Injectable()
@WalletProvider('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpWzVF8mS3uVRG')
export class SolMainnetWalletService extends IWalletService {
  rpcUrl = 'https://api.mainnet-beta.solana.com';

  private _connection?: Connection;
  protected get connection(): Connection {
    if (!this._connection) {
      this._connection = new Connection(this.rpcUrl);
    }
    return this._connection;
  }

  get bip44CoinType(): number {
    return 501;
  }

  async getHotWallet(masterKey: HDKey): Promise<IWallet> {
    // Use the default BIP44 path for Solana: m/44'/501'/0'/0'
    const derivationPath = `m/44'/${this.bip44CoinType}'/0'/0'`;
    const wallet = await this.derivedPathToWallet({ masterKey, derivationPath });
    return wallet;
  }

  derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<SolanaMainnetWallet> {
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
