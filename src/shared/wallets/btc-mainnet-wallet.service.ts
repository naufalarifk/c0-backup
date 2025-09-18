import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import * as bitcoin from 'bitcoinjs-lib';

import { BaseBitcoinWallet } from './base-bitcoin-wallet';
import { WalletProvider } from './Iwallet.service';
import { IWallet, IWalletService } from './Iwallet.types';

class BtcMainnetWallet extends BaseBitcoinWallet {
  protected network = bitcoin.networks.bitcoin;
}

@Injectable()
@WalletProvider('bip122:000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f')
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
