import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import * as bitcoin from 'bitcoinjs-lib';

import { BaseBitcoinWallet } from './base-bitcoin-wallet';
import { WalletProvider } from './Iwallet.service';
import { IWallet, IWalletService } from './Iwallet.types';

@Injectable()
export class BtcTestnetWallet extends BaseBitcoinWallet {
  protected network = bitcoin.networks.testnet;
}

@Injectable()
@WalletProvider('bip122:000000000933ea01ad0ee984209779ba61f8d4362f5cb2f17e5e2c77d0d0dffc')
export class BtcTestnetWalletService extends IWalletService {
  get bip44CoinType(): number {
    return 1;
  }

  derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<BtcTestnetWallet> {
    return new Promise((resolve, reject) => {
      try {
        const { privateKey } = masterKey.derive(derivationPath);
        if (!privateKey) {
          throw new Error('Private key is undefined');
        }
        resolve(new BtcTestnetWallet(privateKey));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
