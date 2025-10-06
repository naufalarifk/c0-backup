import { Injectable } from '@nestjs/common';

import { WalletConfig } from '../wallet.config';
import { WalletProvider } from '../wallet.factory';
import { SolMainnetBlockchain } from './sol-mainnet.blockchain';

@Injectable()
@WalletProvider('solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z')
export class SolTestnetBlockchain extends SolMainnetBlockchain {
  constructor(walletConfig: WalletConfig) {
    super(walletConfig);
  }

  rpcUrl = 'https://api.testnet.solana.com';
}
