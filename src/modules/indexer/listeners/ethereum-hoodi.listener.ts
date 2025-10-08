import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { Listener } from '../indexer-listener.abstract';
import { EthereumIndexerListener } from './ethereum.listener';

/**
 * Ethereum Hoodi testnet indexer listener.
 * Monitors native ETH and ERC-20 token transactions on Ethereum Hoodi testnet (chain ID: eip155:560048).
 */
@Injectable()
@Listener('eip155:560048')
export class EthereumHoodiIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(EthereumHoodiIndexerListener.name);

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue, appConfig.indexerConfigs.ethereum.hoodi);
  }
}
