import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { ETHEREUM_LOCALNET_KEY } from '../../../shared/constants/blockchain';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
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
@Listener(ETHEREUM_LOCALNET_KEY)
export class EthereumLocalnetIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(EthereumLocalnetIndexerListener.name);

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    repository: CryptogadaiRepository,
    appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue, repository, {
      chainName: 'Ethereum Localnet',
      nativeTokenId: 'slip44:60',
      tokenPrefix: 'erc20',
      wsUrl: appConfig.blockchains[ETHEREUM_LOCALNET_KEY].rpcUrls[0]
        .replace('https://', 'wss://')
        .replace('http://', 'ws://'),
    });
  }
}
