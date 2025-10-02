import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { WalletFactory } from '../../../shared/wallets/Iwallet.service';
import { PlatformWalletService } from '../../../shared/wallets/platform-wallet.service';
import { BlockchainNetworkEnum } from '../balance-collection.types';
import { CollectorFlag } from '../balance-collector.factory';
import { EVMBalanceCollector } from './evm-balance.collector';

/**
 * Ethereum Sepolia Testnet Balance Collector
 * Handles balance collection for Ethereum Sepolia (eip155:11155111)
 */
@Injectable()
@CollectorFlag(BlockchainNetworkEnum.EthereumSepolia)
export class SepoliaBalanceCollector extends EVMBalanceCollector {
  protected override readonly logger = new TelemetryLogger(SepoliaBalanceCollector.name);

  constructor(platformWalletService: PlatformWalletService, walletFactory: WalletFactory) {
    super(platformWalletService, walletFactory);
  }

  protected override getRpcUrl(): string {
    return process.env.ETHEREUM_TESTNET_RPC_URL || 'https://ethereum-sepolia.publicnode.com';
  }
}
