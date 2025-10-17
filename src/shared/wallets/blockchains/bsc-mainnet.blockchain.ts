import { Injectable } from '@nestjs/common';

import { Blockchain } from '../blockchain.abstract';
import { WalletConfig } from '../wallet.config';
import { EthMainnetBlockchain } from './eth-mainnet.blockchain';

@Injectable()
@Blockchain('eip155:56')
export class BscMainnetBlockchain extends EthMainnetBlockchain {
  constructor(walletConfig: WalletConfig) {
    super(walletConfig);
  }

  rpcUrl = 'https://bsc-dataseed1.binance.org/';

  // BSC Mainnet chain ID
  protected get chainId(): number {
    return 56;
  }
}
