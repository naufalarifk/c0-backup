import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { ETHEREUM_HOODI_KEY } from '../../../shared/constants/blockchain';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
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
@Listener(ETHEREUM_HOODI_KEY)
export class EthereumHoodiIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(EthereumHoodiIndexerListener.name);

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    repository: CryptogadaiRepository,
    appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue, repository, {
      chainName: 'Ethereum Hoodi',
      nativeTokenId: 'slip44:60',
      tokenPrefix: 'erc20',
      wsUrl: appConfig.blockchains[ETHEREUM_HOODI_KEY].rpcUrls[0]
        .replace('https://', 'wss://')
        .replace('http://', 'ws://'),
    });
  }
}
