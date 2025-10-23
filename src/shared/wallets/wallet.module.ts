import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CryptographyModule } from '../cryptography/cryptography.module';
import { BscMainnetBlockchain } from './blockchains/bsc-mainnet.blockchain';
import { BtcMainnetBlockchain } from './blockchains/btc-mainnet.blockchain';
import { BtcTestnetWalletService } from './blockchains/btc-testnet.blockchain';
import { CgTestnetBlockchain } from './blockchains/cg-testnet.blockchain';
import { EthHoodiBlockchain } from './blockchains/eth-hoodi.blockchain.js';
import { EthMainnetBlockchain } from './blockchains/eth-mainnet.blockchain';
import { SolDevnetBlockchain } from './blockchains/sol-devnet.blockchain';
import { SolMainnetBlockchain } from './blockchains/sol-mainnet.blockchain';
import { WalletConfig } from './wallet.config';
import { WalletFactory } from './wallet.factory';
import { WalletService } from './wallet.service';

@Module({
  imports: [DiscoveryModule, CryptographyModule],
  providers: [
    WalletConfig,
    WalletFactory,
    WalletService,
    BtcTestnetWalletService,

    // Blockchains
    BscMainnetBlockchain,
    BtcMainnetBlockchain,
    CgTestnetBlockchain,
    EthHoodiBlockchain,
    EthMainnetBlockchain,
    SolDevnetBlockchain,
    SolMainnetBlockchain,
  ],
  exports: [
    WalletConfig,
    WalletFactory,
    WalletService,
    BtcTestnetWalletService,

    // Blockchains
    BscMainnetBlockchain,
    BtcMainnetBlockchain,
    CgTestnetBlockchain,
    EthHoodiBlockchain,
    EthMainnetBlockchain,
    SolDevnetBlockchain,
    SolMainnetBlockchain,
  ],
})
export class WalletModule {}
