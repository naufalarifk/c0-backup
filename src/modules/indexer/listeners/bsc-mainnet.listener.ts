import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { Listener } from '../indexer-listener.abstract';
import { EthereumIndexerListener } from './ethereum.listener';

/**
 * Binance Smart Chain (BSC) Mainnet indexer listener.
 * Monitors native BNB and BEP-20 token transactions on BSC mainnet (chain ID: eip155:56).
 */
@Injectable()
@Listener('eip155:56')
export class BscMainnetIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(BscMainnetIndexerListener.name);
  nativeTokenId() {
    return 'slip:714';
  }
  tokenPrefix() {
    return 'bep20';
  }
  wsUrlEnvVar() {
    return 'BSC_WS_URL';
  }
  chainName() {
    return 'BSC';
  }
  defaultWsUrl() {
    return 'wss://bsc-mainnet.infura.io/ws/v3/YOUR_PROJECT_ID';
  }
}
