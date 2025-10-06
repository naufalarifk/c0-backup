import { Injectable } from '@nestjs/common';

import { WalletConfig } from '../wallet.config';
import { WalletProvider } from '../wallet.factory';
import { EthMainnetBlockchain } from './eth-mainnet.blockchain';

@Injectable()
@WalletProvider('eip155:11155111')
export class EthTestnetBlockchain extends EthMainnetBlockchain {
  constructor(walletConfig: WalletConfig) {
    super(walletConfig);
  }

  rpcUrl = 'https://sepolia.drpc.org';
}
