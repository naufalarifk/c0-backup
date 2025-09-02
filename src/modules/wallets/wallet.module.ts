import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { HdWalletService } from './hdwallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [DiscoveryModule],
  controllers: [WalletController],
  providers: [HdWalletService],
  exports: [HdWalletService],
})
export class WalletModule {}
