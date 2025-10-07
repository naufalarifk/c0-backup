import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
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

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
  ) {
    super(discovery, redis, invoicePaymentQueue, {
      chainName: 'BSC Mainnet',
      wsUrlEnvVar: 'BSC_WS_URL',
      defaultWsUrl: 'wss://bsc-mainnet.infura.io/ws/v3/YOUR_PROJECT_ID',
      nativeTokenId: 'slip44:714',
      tokenPrefix: 'bep20',
    });
  }
}
