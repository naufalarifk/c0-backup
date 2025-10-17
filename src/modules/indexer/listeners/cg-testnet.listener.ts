import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { CG_TESTNET_KEY } from '../../../shared/constants/blockchain';
import {
  CgTestnetBlockchainEventService,
  type CgTestnetBlockchainPaymentEvent,
} from '../../../shared/services/cg-testnet-blockchain-event.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { AddressChanged, IndexerListener, Listener } from '../indexer-listener.abstract';

@Injectable()
@Listener(CG_TESTNET_KEY)
export class CgTestnetIndexerListener extends IndexerListener {
  readonly logger = new TelemetryLogger(CgTestnetIndexerListener.name);
  #watchersByToken = new Map<string, Map<string, AddressChanged>>();
  #unsubscribe?: () => void;

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    private readonly testBlockchainEvents: CgTestnetBlockchainEventService,
  ) {
    super(discovery, redis, invoicePaymentQueue);
  }

  async start() {
    await super.start();
    const blockchainKey = this.getBlockchainKey();
    if (!blockchainKey) {
      throw new Error('Mock blockchain listener cannot determine blockchain key');
    }
    const normalizedKey = blockchainKey.toLowerCase();
    this.#unsubscribe = this.testBlockchainEvents.registerListener(normalizedKey, async event => {
      await this.#handlePayment(event);
    });
    this.logger.log('Mock blockchain indexer ready', { blockchainKey });
  }

  async stop() {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = undefined;
    }
    this.#watchersByToken.clear();
    await super.stop();
  }

  async onAddressAdded(change: AddressChanged): Promise<void> {
    const tokenKey = change.tokenId.toLowerCase();
    const addressKey = change.address.toLowerCase();
    const watchers = this.#watchersByToken.get(tokenKey) ?? new Map<string, AddressChanged>();
    watchers.set(addressKey, change);
    this.#watchersByToken.set(tokenKey, watchers);
    this.logger.debug('Mock indexer tracking address', {
      tokenId: change.tokenId,
      address: change.address,
      derivedPath: change.derivedPath,
    });
  }

  async onAddressRemoved(change: AddressChanged): Promise<void> {
    const tokenKey = change.tokenId.toLowerCase();
    const watchers = this.#watchersByToken.get(tokenKey);
    if (!watchers) {
      return;
    }
    watchers.delete(change.address.toLowerCase());
    if (watchers.size === 0) {
      this.#watchersByToken.delete(tokenKey);
    }
  }

  async #handlePayment(event: CgTestnetBlockchainPaymentEvent): Promise<void> {
    const blockchainKey = this.getBlockchainKey();
    if (!blockchainKey) {
      this.logger.error('Mock blockchain listener invoked without blockchain key');
      return;
    }
    if (event.blockchainKey !== blockchainKey.toLowerCase()) {
      this.logger.warn('Received mock blockchain event for mismatched blockchain', {
        expected: blockchainKey,
        received: event.blockchainKey,
      });
      return;
    }

    const tokenWatchers = this.#watchersByToken.get(event.tokenId.toLowerCase());
    if (!tokenWatchers || tokenWatchers.size === 0) {
      this.logger.warn('No tracked wallets for mock blockchain event', {
        tokenId: event.tokenId,
      });
      return;
    }

    const watcher = tokenWatchers.get(event.address.toLowerCase());
    if (!watcher) {
      this.logger.warn('Mock blockchain event received for untracked address', {
        tokenId: event.tokenId,
        address: event.address,
      });
      return;
    }

    const timestamp =
      typeof event.timestamp === 'number' ? event.timestamp : Math.floor(Date.now() / 1000);
    await this.dispatchDetectedTransaction({
      blockchainKey,
      tokenId: watcher.tokenId,
      derivedPath: watcher.derivedPath,
      address: watcher.address,
      txHash: event.txHash,
      sender: event.sender ?? 'mock-sender',
      amount: event.amount,
      timestamp,
    });

    this.logger.log('Mock blockchain payment dispatched', {
      blockchainKey,
      tokenId: watcher.tokenId,
      address: watcher.address,
      txHash: event.txHash,
    });
  }
}
