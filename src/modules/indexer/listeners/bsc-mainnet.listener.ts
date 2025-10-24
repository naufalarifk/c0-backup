import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { BSC_MAINNET_KEY } from '../../../shared/constants/blockchain';
import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
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
@Listener(BSC_MAINNET_KEY)
export class BscMainnetIndexerListener extends EthereumIndexerListener {
  readonly logger = new TelemetryLogger(BscMainnetIndexerListener.name);

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    repository: CryptogadaiRepository,
    appConfig: AppConfigService,
  ) {
    const rpcUrl = appConfig.blockchains[BSC_MAINNET_KEY].rpcUrls[0];
    const wsUrl = rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    super(discovery, redis, invoicePaymentQueue, repository, {
      chainName: 'BSC Mainnet',
      nativeTokenId: 'slip44:714',
      tokenPrefix: 'bep20',
      wsUrl,
    });
  }
}
