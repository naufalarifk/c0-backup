import { Injectable } from '@nestjs/common';

import { Blockchain } from '../blockchain.abstract';
import { WalletConfig } from '../wallet.config';
import { SolMainnetBlockchain } from './sol-mainnet.blockchain';

@Injectable()
@Blockchain('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1')
export class SolDevnetBlockchain extends SolMainnetBlockchain {
  constructor(walletConfig: WalletConfig) {
    super(walletConfig);
  }

  rpcUrl = 'https://api.devnet.solana.com';
}
