import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CryptographyModule } from '../cryptography/cryptography.module';
import { BscMainnetBlockchain } from './blockchains/bsc-mainnet.blockchain';
import { BtcMainnetBlockchain } from './blockchains/btc-mainnet.blockchain';
import { BtcTestnetWalletService } from './blockchains/btc-testnet.blockchain';
import { CgTestnetBlockchain } from './blockchains/cg-testnet.blockchain';
import { EthMainnetBlockchain } from './blockchains/eth-mainnet.blockchain';
import { EthTestnetBlockchain } from './blockchains/eth-testnet.blockchain';
import { SolDevnetBlockchain } from './blockchains/sol-devnet.blockchain';
import { SolMainnetBlockchain } from './blockchains/sol-mainnet.blockchain';
import { SolTestnetBlockchain } from './blockchains/sol-testnet.blockchain';
import { WalletConfig } from './wallet.config';
import { WalletFactory } from './wallet.factory';
import { WalletService } from './wallet.service';

@Module({
  imports: [DiscoveryModule, CryptographyModule],
  providers: [
    WalletConfig,
    WalletFactory,
    WalletService,
    BscMainnetBlockchain,
    BtcMainnetBlockchain,
    BtcTestnetWalletService,
    EthMainnetBlockchain,
    EthTestnetBlockchain,
    SolDevnetBlockchain,
    SolMainnetBlockchain,
    SolTestnetBlockchain,
    CgTestnetBlockchain,
  ],
  exports: [
    WalletConfig,
    WalletFactory,
    WalletService,
    BscMainnetBlockchain,
    BtcMainnetBlockchain,
    BtcTestnetWalletService,
    EthMainnetBlockchain,
    EthTestnetBlockchain,
    SolDevnetBlockchain,
    SolMainnetBlockchain,
    SolTestnetBlockchain,
    CgTestnetBlockchain,
  ],
})
export class WalletModule {}
