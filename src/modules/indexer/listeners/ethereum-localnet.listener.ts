import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { Listener } from '../indexer-listener.abstract';
import { EthereumIndexerListener } from './ethereum.listener';

/**
 * Ethereum Localnet indexer listener.
 * Monitors native ETH and ERC-20 token transactions on Ethereum Localnet (chain ID: eip155:11155111).
 */
@Injectable()
@Listener('eip155:11155111')
export class EthereumLocalnetIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(EthereumLocalnetIndexerListener.name);

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue, appConfig.indexerConfigs.ethereum.localnet);
  }
}
