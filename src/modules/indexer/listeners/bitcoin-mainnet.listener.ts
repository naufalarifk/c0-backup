import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { BitcoinService } from '../btc.service';
import { AddressChanged, IndexerListener, Listener } from '../indexer-listener.abstract';

@Injectable()
@Listener('bip122:000000000019d6689c085ae165831e93')
export class BitcoinMainnetIndexerListener extends IndexerListener {
  readonly logger = new TelemetryLogger(BitcoinMainnetIndexerListener.name);
  #watchers = new Map<string, AddressChanged>();
  #isRunning = false;
  #pollInterval?: NodeJS.Timeout;
  #lastProcessedBlock = 0;
  #pollIntervalMs: number;

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    private readonly btcService: BitcoinService,
    pollIntervalMs = 60_000,
  ) {
    super(discovery, redis, invoicePaymentQueue);
    this.#pollIntervalMs = pollIntervalMs;
  }

  async stop() {
    await super.stop();

    if (this.#pollInterval) {
      clearInterval(this.#pollInterval);
    }
  }

  async onAddressAdded(change: AddressChanged): Promise<void> {
    if (change.tokenId.toLowerCase() !== 'slip:0') {
      this.logger.warn('Bitcoin only supports native BTC (slip:0)', {
        tokenId: change.tokenId,
      });
      return;
    }

    const watchKey = this.#buildWatchKey(change);
    this.#watchers.set(watchKey, change);

    this.logger.log('Added Bitcoin address to watch list', {
      address: change.address,
      watchersCount: this.#watchers.size,
    });

    await this.#ensurePolling();
  }

  async onAddressRemoved(change: AddressChanged): Promise<void> {
    const watchKey = this.#buildWatchKey(change);
    this.#watchers.delete(watchKey);

    if (this.#watchers.size === 0 && this.#pollInterval) {
      clearInterval(this.#pollInterval);
      this.#isRunning = false;
      this.logger.log('Stopped Bitcoin polling - no more addresses to watch');
    }
  }

  #buildWatchKey(change: AddressChanged) {
    return `${change.address}::${change.derivedPath}`;
  }

  async #ensurePolling() {
    if (this.#isRunning) return;

    this.#isRunning = true;

    try {
      this.#lastProcessedBlock = await this.btcService.getCurrentBlockHeight();
      this.logger.log('Starting Bitcoin polling', { fromBlock: this.#lastProcessedBlock });
    } catch (error) {
      this.logger.error('Failed to get current Bitcoin block height', error);
      this.#isRunning = false;
      return;
    }

    this.#pollInterval = setInterval(async () => {
      await this.#pollForTransactions();
    }, this.#pollIntervalMs);
  }

  async #pollForTransactions() {
    try {
      const currentHeight = await this.btcService.getCurrentBlockHeight();

      if (currentHeight <= this.#lastProcessedBlock) {
        return;
      }

      const blockchainKey = this.getBlockchainKey();
      if (!blockchainKey) {
        throw new Error('Blockchain key not found');
      }

      for (let height = this.#lastProcessedBlock + 1; height <= currentHeight; height++) {
        const blockHash = await this.btcService.getBlockHash(height);
        const block = await this.btcService.getBlock(blockHash);

        for (const txid of block.tx || []) {
          await this.#processTransaction(blockchainKey, txid, block.time);
        }
      }

      this.#lastProcessedBlock = currentHeight;

      this.logger.debug('Processed Bitcoin blocks', {
        from: this.#lastProcessedBlock + 1,
        to: currentHeight,
      });
    } catch (error) {
      this.logger.error('Error polling for Bitcoin transactions', error);
    }
  }

  async #processTransaction(blockchainKey: string, txid: string, blockTimestamp: number) {
    try {
      const tx = await this.btcService.getTransaction(txid);

      for (const output of tx.vout || []) {
        // Handle both old (addresses array) and new (address string) formats
        const addresses: string[] = output.scriptPubKey?.addresses
          ? output.scriptPubKey.addresses
          : output.scriptPubKey?.address
            ? [output.scriptPubKey.address]
            : [];

        for (const address of addresses) {
          const watcher = this.#findWatcher(address);
          if (!watcher) continue;

          const amount = this.#btcToSatoshis(output.value).toString();
          if (amount === '0') continue;

          this.logger.log('Detected Bitcoin transaction', {
            txHash: txid,
            address,
            amount: output.value,
          });

          await this.dispatchDetectedTransaction({
            blockchainKey,
            tokenId: 'slip:0',
            derivedPath: watcher.derivedPath,
            address: watcher.address,
            txHash: txid,
            sender: '',
            amount,
            timestamp: blockTimestamp,
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to process Bitcoin transaction ${txid}`, error);
    }
  }

  #findWatcher(address: string): AddressChanged | undefined {
    for (const watcher of this.#watchers.values()) {
      if (watcher.address === address) {
        return watcher;
      }
    }
    return undefined;
  }

  #btcToSatoshis(btc: number): bigint {
    return BigInt(Math.round(btc * 1e8));
  }
}
