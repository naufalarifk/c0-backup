import { Injectable } from '@nestjs/common';

import { ethers } from 'ethers';

import { EthMainnetWalletService } from './eth-mainnet-wallet.service';
import { WalletProvider } from './Iwallet.service';

@Injectable()
@WalletProvider('eip155:11155111')
export class EthTestnetWalletService extends EthMainnetWalletService {
  readonly provider: ethers.JsonRpcProvider;

  constructor() {
    super();
    this.provider = new ethers.JsonRpcProvider('https://sepolia.drpc.org');
  }
}
