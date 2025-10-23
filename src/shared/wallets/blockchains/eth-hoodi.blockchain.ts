import { Injectable } from '@nestjs/common';

import { AppConfigService } from 'src/shared/services/app-config.service.js';
import { WalletConfig } from 'src/shared/wallets/wallet.config.js';

import { Blockchain } from '../blockchain.abstract';
import { EthMainnetBlockchain } from './eth-mainnet.blockchain';

@Injectable()
@Blockchain('eip155:560048')
export class EthHoodiBlockchain extends EthMainnetBlockchain {
  constructor(walletConfig: WalletConfig, appConfig: AppConfigService) {
    super(walletConfig);
    this.rpcUrl = appConfig.blockchains['eip155:560048'].rpcUrls[0];
  }

  protected get chainId(): number {
    return 560048;
  }
}
