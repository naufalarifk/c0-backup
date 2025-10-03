import { Injectable } from '@nestjs/common';

import { WalletProvider } from '../wallet.factory';
import { EthMainnetBlockchain } from './eth-mainnet.blockchain';

@Injectable()
@WalletProvider('eip155:11155111')
export class EthTestnetBlockchain extends EthMainnetBlockchain {
  rpcUrl = 'https://sepolia.drpc.org';
}
