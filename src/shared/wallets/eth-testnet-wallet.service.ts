import { Injectable } from '@nestjs/common';

import { EthMainnetWalletService } from './eth-mainnet-wallet.service';
import { WalletProvider } from './Iwallet.service';

@Injectable()
@WalletProvider('eip155:11155111')
export class EthTestnetWalletService extends EthMainnetWalletService {
  rpcUrl = 'https://sepolia.drpc.org';
}
