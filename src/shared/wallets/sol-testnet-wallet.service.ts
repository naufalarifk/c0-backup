import { Injectable } from '@nestjs/common';

import { WalletProvider } from './Iwallet.service';
import { SolMainnetWalletService } from './sol-mainnet-wallet.service';

@Injectable()
@WalletProvider('solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z')
export class SolTestnetWalletService extends SolMainnetWalletService {
  rpcUrl = 'https://api.testnet.solana.com';
}
