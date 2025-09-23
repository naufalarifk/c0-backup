import { Injectable } from '@nestjs/common';

import { Connection } from '@solana/web3.js';

import { WalletProvider } from './Iwallet.service';
import { SolMainnetWalletService } from './sol-mainnet-wallet.service';

@Injectable()
@WalletProvider('solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z')
export class SolTestnetWalletService extends SolMainnetWalletService {
  readonly connection: Connection;

  constructor() {
    super();
    this.connection = new Connection('https://api.testnet.solana.com');
  }
}
