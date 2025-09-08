import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { BtcWalletService } from './btc-wallet.service';
import { EthWalletService } from './eth-wallet.service';
import { SolWalletService } from './sol-wallet.service';
import { WalletService } from './wallet.service';
import { WalletConfigService } from './wallet-config.service';
import { WalletInstanceService } from './wallet-instance.service';

@Module({
  imports: [DiscoveryModule],
  controllers: [],
  providers: [
    WalletInstanceService,
    WalletService,
    WalletConfigService,
    {
      provide: BtcWalletService,
      useFactory: (configService: WalletConfigService) => {
        return configService.createBtcWalletService();
      },
      inject: [WalletConfigService],
    },
    {
      provide: EthWalletService,
      useFactory: (configService: WalletConfigService) => {
        return configService.createEthWalletService();
      },
      inject: [WalletConfigService],
    },
    {
      provide: SolWalletService,
      useFactory: (configService: WalletConfigService) => {
        return configService.createSolWalletService();
      },
      inject: [WalletConfigService],
    },
  ],
  exports: [BtcWalletService, EthWalletService, SolWalletService, WalletConfigService],
})
export class WalletModule {}
