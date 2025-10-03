import { Injectable } from '@nestjs/common';

import { WalletProvider } from '../wallet.factory';
import { SolMainnetBlockchain } from './sol-mainnet.blockchain';

@Injectable()
@WalletProvider('solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z')
export class SolTestnetBlockchain extends SolMainnetBlockchain {
  rpcUrl = 'https://api.testnet.solana.com';
}
