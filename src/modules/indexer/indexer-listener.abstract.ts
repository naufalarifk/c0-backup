import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { assertDefined, assertPropString, isString } from 'typeshaper';

import { RedisService } from '../../shared/services/redis.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../invoice-payments/invoice-payment.queue.service';

export type AddressChanged = {
  tokenId: string;
  address: string;
  derivedPath: string;
};

export type DetectedTransaction = {
  blockchainKey: string;
  tokenId: string;
  derivedPath: string;
  address: string;
  txHash: string;
  sender: string;
  amount: string;
  timestamp: number;
};

export const Listener = DiscoveryService.createDecorator<string>();

export abstract class IndexerListener {
  abstract readonly logger: TelemetryLogger;
  abstract onAddressAdded(address: AddressChanged): Promise<void>;
  abstract onAddressRemoved(address: AddressChanged): Promise<void>;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly redis: RedisService,
    private readonly invoicePaymentQueue: InvoicePaymentQueueService,
  ) {}

  getBlockchainKey() {
    const instance = this.discovery.getProviders().find(p => p.instance === this);
    if (instance) {
      const key = this.discovery.getMetadataByDecorator(Listener, instance);
      return key;
    }
    throw new Error('Blockchain key not found for listener');
  }

  #refreshInterval: NodeJS.Timeout;
  #addressAddedListner = async (raw: unknown) => {
    const _blockchainKey = this.getBlockchainKey();
    // RedisService may pass already-parsed objects or strings
    let data: unknown;
    if (isString(raw)) {
      data = JSON.parse(raw);
    } else if (raw instanceof Buffer) {
      data = JSON.parse(raw.toString('utf-8'));
    } else {
      // Already parsed by RedisService
      data = raw;
    }
    assertDefined(data);
    assertPropString(data, 'address');
    assertPropString(data, 'tokenId');
    assertPropString(data, 'derivedPath');
    await this.onAddressAdded(data);
  };
  #addressRemovedListener = async (raw: unknown) => {
    const _blockchainKey = this.getBlockchainKey();
    // RedisService may pass already-parsed objects or strings
    let data: unknown;
    if (isString(raw)) {
      data = JSON.parse(raw);
    } else if (raw instanceof Buffer) {
      data = JSON.parse(raw.toString('utf-8'));
    } else {
      // Already parsed by RedisService
      data = raw;
    }
    assertDefined(data);
    assertPropString(data, 'tokenId');
    assertPropString(data, 'address');
    assertPropString(data, 'derivedPath');
    await this.onAddressRemoved(data);
  };

  async start() {
    const blockchainKey = this.getBlockchainKey();
    const exists = await this.redis.get(`indexer:${blockchainKey}:running`);
    if (exists) {
      this.logger.warn(`Indexer for ${blockchainKey} is already running, skipping duplicate start`);
      return;
    }
    const aMinute = 1 * 60;
    await this.redis.set(`indexer:${blockchainKey}:running`, 1, aMinute);
    this.#refreshInterval = setInterval(async () => {
      await this.redis.set(`indexer:${blockchainKey}:running`, 1, aMinute);
    }, 30 * 1000);
    this.redis.subscribe(`indexer:${blockchainKey}:address:added`, this.#addressAddedListner);
    this.redis.subscribe(`indexer:${blockchainKey}:address:removed`, this.#addressRemovedListener);
  }

  async stop() {
    const blockchainKey = this.getBlockchainKey();
    clearInterval(this.#refreshInterval);
    await Promise.all([
      this.redis.unsubscribe(`indexer:${blockchainKey}:address:added`, this.#addressAddedListner),
      this.redis.unsubscribe(
        `indexer:${blockchainKey}:address:removed`,
        this.#addressRemovedListener,
      ),
      this.redis.del(`indexer:${blockchainKey}:running`),
    ]);
  }

  async dispatchDetectedTransaction(data: DetectedTransaction) {
    await this.invoicePaymentQueue.enqueuePaymentDetection({
      blockchainKey: data.blockchainKey,
      tokenId: data.tokenId,
      walletDerivationPath: data.derivedPath,
      walletAddress: data.address,
      transactionHash: data.txHash,
      amount: data.amount,
      detectedAt: new Date(data.timestamp * 1000).toISOString(),
    });
  }
}
