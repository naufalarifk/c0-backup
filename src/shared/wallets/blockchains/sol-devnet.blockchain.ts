import { Injectable } from '@nestjs/common';

import { WalletConfig } from '../wallet.config';
import { WalletProvider } from '../wallet.factory';
import { SolMainnetBlockchain } from './sol-mainnet.blockchain';

@Injectable()
@WalletProvider('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1')
export class SolDevnetBlockchain extends SolMainnetBlockchain {
  constructor(walletConfig: WalletConfig) {
    super(walletConfig);
  }

  rpcUrl = 'https://api.devnet.solana.com';
}
