import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
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

  protected override getRpcUrl(): string {
    /** @TODO support round-robin rpc client mechanism */
    return this.appConfig.blockchains[BlockchainNetworkEnum.BSCMainnet].rpcUrls[0];
  }
}
