import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import * as bitcoin from 'bitcoinjs-lib';

import { BaseBitcoinWallet } from './BaseBitcoinWallet';
import { IWallet, IWalletService } from './Iwallet.types';

@Injectable()
export class BtcTestnetWallet extends BaseBitcoinWallet {
  protected network = bitcoin.networks.testnet;
}

@Injectable()
export class BtcTestnetWalletService implements IWalletService {
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
        resolve(new BtcTestnetWallet(privateKey));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
