import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AppConfigService } from '../../../shared/services/app-config.service';
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
    appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue, appConfig.indexerConfigs.ethereum.bscMainnet);
  }
}
