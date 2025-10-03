import { Injectable } from '@nestjs/common';

import { WalletProvider } from '../wallet.factory';
import { EthMainnetBlockchain } from './eth-mainnet.blockchain';

@Injectable()
@WalletProvider('eip155:56')
export class BscMainnetBlockchain extends EthMainnetBlockchain {
  rpcUrl = 'https://bsc-dataseed1.binance.org/';
}
