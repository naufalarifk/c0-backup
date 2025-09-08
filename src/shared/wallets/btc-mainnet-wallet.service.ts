import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import * as bitcoin from 'bitcoinjs-lib';

import { BaseBitcoinWallet } from './base-bitcoin-wallet';
import { IWallet, IWalletService } from './Iwallet.types';

class BtcMainnetWallet extends BaseBitcoinWallet {
  protected network = bitcoin.networks.bitcoin;
}

@Injectable()
export class BtcMainnetWalletService extends IWalletService {
  get bip44CoinType(): number {
    return 0;
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
        resolve(new BtcMainnetWallet(privateKey));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
