import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { BtcMainnetWalletService } from './btc-mainnet-wallet.service';
import { BtcTestnetWalletService } from './btc-testnet-wallet.service';
import { EthMainnetWalletService } from './eth-mainnet-wallet.service';
import { EthTestnetWalletService } from './eth-testnet-wallet.service';
import { WalletFactory } from './Iwallet.service';
import { SolMainnetWalletService } from './sol-mainnet-wallet.service';
import { SolTestnetWalletService } from './sol-testnet-wallet.service';

@Module({
  imports: [DiscoveryModule],
  providers: [
    WalletFactory,
    BtcMainnetWalletService,
    BtcTestnetWalletService,
    EthMainnetWalletService,
    EthTestnetWalletService,
    SolMainnetWalletService,
    SolTestnetWalletService,
  ],
  exports: [
    WalletFactory,
    BtcMainnetWalletService,
    BtcTestnetWalletService,
    EthMainnetWalletService,
    EthTestnetWalletService,
    SolMainnetWalletService,
    SolTestnetWalletService,
  ],
})
export class WalletsModule {}
