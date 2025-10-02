import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { WalletFactory } from '../../../shared/wallets/Iwallet.service';
import { PlatformWalletService } from '../../../shared/wallets/platform-wallet.service';
import { BlockchainNetworkEnum } from '../balance-collection.types';
import { CollectorFlag } from '../balance-collector.factory';
import { EVMBalanceCollector } from './evm-balance.collector';

/**
 * BSC Balance Collector
 * Handles balance collection for BSC Mainnet (eip155:56)
 */
@Injectable()
@CollectorFlag(BlockchainNetworkEnum.BSCMainnet)
export class BSCBalanceCollector extends EVMBalanceCollector {
  protected override readonly logger = new TelemetryLogger(BSCBalanceCollector.name);

  constructor(platformWalletService: PlatformWalletService, walletFactory: WalletFactory) {
    super(platformWalletService, walletFactory);
  }

  protected override getRpcUrl(): string {
    return process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
  }
}
