import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { ETHEREUM_MAINNET_KEY } from '../../../shared/constants/blockchain';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { Listener } from '../indexer-listener.abstract';
import { EthereumIndexerListener } from './ethereum.listener';

/**
 * Ethereum Mainnet indexer listener.
 * Monitors native ETH and ERC-20 token transactions on Ethereum mainnet (chain ID: eip155:1).
 */
@Injectable()
@Listener(ETHEREUM_MAINNET_KEY)
export class EthereumMainnetIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(EthereumMainnetIndexerListener.name);

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue, {
      chainName: 'Ethereum Mainnet',
      nativeTokenId: 'slip44:60',
      tokenPrefix: 'erc20',
      wsUrl: appConfig.blockchains[ETHEREUM_MAINNET_KEY].rpcUrls[0]
        .replace('https://', 'wss://')
        .replace('http://', 'ws://'),
    });
  }
}
