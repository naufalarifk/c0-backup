import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { Listener } from '../indexer-listener.abstract';
import { EthereumIndexerListener } from './ethereum.listener';

/**
 * Ethereum Sepolia testnet indexer listener.
 * Monitors native ETH and ERC-20 token transactions on Ethereum Sepolia testnet (chain ID: eip155:11155111).
 */
@Injectable()
@Listener('eip155:11155111')
export class EthereumSepoliaIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(EthereumSepoliaIndexerListener.name);

  constructor(
    appConfig: AppConfigService,
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
  ) {
    super(discovery, redis, invoicePaymentQueue, {
      chainName: 'Ethereum Localnet',
      wsUrlEnvVar: 'ETHEREUM_LOCALNET_WS_URL',
      defaultWsUrl: 'ws://localhost:8545',
      nativeTokenId: 'slip44:60',
      tokenPrefix: 'erc20',
    });
  }
}
