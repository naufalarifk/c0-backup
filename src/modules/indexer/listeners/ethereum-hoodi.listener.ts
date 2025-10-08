import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

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
  ) {
    super(discovery, redis, invoicePaymentQueue, {
      chainName: 'Ethereum Hoodi',
      wsUrlEnvVar: 'ETHEREUM_HOODI_WS_URL',
      defaultWsUrl: 'wss://ethereum-hoodi-rpc.publicnode.com',
      nativeTokenId: 'slip44:60',
      tokenPrefix: 'erc20',
    });
  }
}
