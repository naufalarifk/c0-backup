import { DiscoveryService } from '@nestjs/core';

import { ethers } from 'ethers';
import { isAddress } from 'viem';

import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { AddressChanged, IndexerListener } from '../indexer-listener.abstract';

type EthereumTokenStrategy =
  | {
      mode: 'native';
      tokenId: string;
      tokenKey: string;
    }
  | {
      mode: 'token';
      tokenId: string;
      tokenKey: string;
      contractAddress: `0x${string}`;
    };

export type EthereumIndexerConfig = {
  nativeTokenId: string;
  tokenPrefix: string;
  chainName: string;
  wsUrl: string;
};

/**
 * Base abstract class for Ethereum-compatible blockchain indexers.
 * Implements common logic for monitoring native and token (ERC20/BEP20) transactions.
 */
export abstract class EthereumIndexerListener extends IndexerListener {
  abstract logger: TelemetryLogger;

  #watchersByToken = new Map<string, Map<string, AddressChanged>>();
  #activeStrategies = new Set<string>();
  #activeSubscriptions = new Map<string, () => void>();
  #provider: ethers.WebSocketProvider;

  #nativeTokenId: string;
  #tokenPrefix: string;
  #chainName: string;
  #wsUrl: string;

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    config: EthereumIndexerConfig,
  ) {
    super(discovery, redis, invoicePaymentQueue);

    this.#nativeTokenId = config.nativeTokenId;
    this.#tokenPrefix = config.tokenPrefix;
    this.#chainName = config.chainName;
    this.#wsUrl = config.wsUrl;
  }

  async start() {
    await super.start();

    this.#provider = new ethers.WebSocketProvider(this.#wsUrl);

    this.#provider.on('error', (error: Error) => {
      this.logger.error(`${this.#chainName} provider error`, error);
    });

    // Add error handler to underlying WebSocket to prevent unhandled errors
    const ws = this.#provider.websocket as unknown as {
      addEventListener: (event: string, listener: (event: unknown) => void) => void;
    };

    ws.addEventListener('error', (event: unknown) => {
      // this.logger.error(`${this.#chainName} WebSocket error`, event);
    });

    ws.addEventListener('close', () => {
      // this.logger.log(`${this.#chainName} WebSocket connection closed`);
    });
  }

  async stop() {
    await super.stop();

    for (const [key, cleanup] of this.#activeSubscriptions.entries()) {
      this.logger.debug(`Cleaning up ${this.#chainName} subscription: ${key}`);
      cleanup();
    }
    this.#activeSubscriptions.clear();

    await this.#provider.destroy();
  }

  async onAddressAdded(change: AddressChanged): Promise<void> {
    if (isAddress(change.address) === false) {
      this.logger.error(`Invalid ${this.#chainName} address`, { address: change.address });
      return;
    }

    const strategy = this.#resolveTokenStrategy(change);
    if (!strategy) {
      this.logger.warn(`Unsupported token id received for ${this.#chainName} indexer`, {
        tokenId: change.tokenId,
        address: change.address,
      });
      return;
    }

    const tokenWatchers =
      this.#watchersByToken.get(strategy.tokenKey) || new Map<string, AddressChanged>();
    const watchKey = this.#buildWatchKey(change);
    tokenWatchers.set(watchKey, { ...change, tokenId: strategy.tokenId });
    this.#watchersByToken.set(strategy.tokenKey, tokenWatchers);

    await this.#ensureStrategyRunner(strategy);
  }

  async onAddressRemoved(change: AddressChanged): Promise<void> {
    const strategy = this.#resolveTokenStrategy(change);
    if (!strategy) {
      this.logger.warn(`Attempted to remove unsupported ${this.#chainName} token watcher`, {
        tokenId: change.tokenId,
        address: change.address,
      });
      return;
    }

    const tokenWatchers = this.#watchersByToken.get(strategy.tokenKey);
    if (!tokenWatchers) {
      return;
    }

    tokenWatchers.delete(this.#buildWatchKey(change));

    if (tokenWatchers.size === 0) {
      this.#watchersByToken.delete(strategy.tokenKey);
      this.#activeStrategies.delete(strategy.tokenKey);

      const cleanup = this.#activeSubscriptions.get(strategy.tokenKey);
      if (cleanup) {
        cleanup();
        this.#activeSubscriptions.delete(strategy.tokenKey);
      }

      this.logger.log(
        `No more wallets tracked for ${this.#chainName} token, stopped strategy runner`,
        {
          tokenId: strategy.tokenId,
        },
      );
    }
  }

  #resolveTokenStrategy(change: AddressChanged): EthereumTokenStrategy | undefined {
    const normalizedTokenId = change.tokenId.toLowerCase();

    if (normalizedTokenId === this.#nativeTokenId.toLowerCase()) {
      return {
        mode: 'native',
        tokenId: this.#nativeTokenId,
        tokenKey: `native:${this.#nativeTokenId}`,
      };
    }

    if (normalizedTokenId.startsWith(`${this.#tokenPrefix}:`)) {
      const contract = normalizedTokenId.split(':')[1];
      if (isAddress(contract)) {
        const contractAddress = contract as `0x${string}`;
        return {
          mode: 'token',
          tokenId: `${this.#tokenPrefix}:${contractAddress}`,
          tokenKey: `${this.#tokenPrefix}:${contractAddress}`,
          contractAddress,
        };
      }
    }

    return undefined;
  }

  #buildWatchKey(change: AddressChanged) {
    return `${change.address.toLowerCase()}::${change.derivedPath}`;
  }

  async #ensureStrategyRunner(strategy: EthereumTokenStrategy) {
    if (this.#activeStrategies.has(strategy.tokenKey)) {
      return;
    }

    this.#activeStrategies.add(strategy.tokenKey);
    this.logger.log(`Starting ${this.#chainName} indexer strategy`, {
      mode: strategy.mode,
      tokenId: strategy.tokenId,
    });

    if (strategy.mode === 'native') {
      await this.#startNativeListener(strategy);
    } else if (strategy.mode === 'token') {
      await this.#startTokenListener(strategy);
    }
  }

  async #startNativeListener(strategy: EthereumTokenStrategy) {
    const blockchainKey = this.getBlockchainKey();
    if (!blockchainKey) {
      throw new Error('Blockchain key not found');
    }

    const handler = async (blockNumber: number) => {
      try {
        const block = await this.#provider.getBlock(blockNumber, true);
        if (!block) return;

        const watchers = this.#watchersByToken.get(strategy.tokenKey);
        if (!watchers || watchers.size === 0) return;

        const transactions = block.prefetchedTransactions || [];

        for (const tx of transactions) {
          if (!tx.to) continue;

          const watchKey = this.#findWatchKey(watchers, tx.to);
          if (!watchKey) continue;

          const watcher = watchers.get(watchKey);
          if (!watcher) continue;

          const amount = tx.value.toString();
          if (amount === '0') continue;

          this.logger.log(`Detected native ${this.#chainName} transaction`, {
            txHash: tx.hash,
            to: tx.to,
            amount: ethers.formatEther(tx.value),
            blockNumber: block.number,
          });

          await this.dispatchDetectedTransaction({
            blockchainKey,
            tokenId: strategy.tokenId,
            derivedPath: watcher.derivedPath,
            address: watcher.address,
            txHash: tx.hash,
            sender: tx.from,
            amount,
            timestamp: block.timestamp,
          });
        }
      } catch (error) {
        this.logger.error(`Error processing ${this.#chainName} block`, error);
      }
    };

    this.#provider.on('block', handler);

    this.#activeSubscriptions.set(strategy.tokenKey, () => {
      this.#provider.off('block', handler);
    });

    this.logger.log(`Native ${this.#chainName} listener started`);
  }

  async #startTokenListener(strategy: EthereumTokenStrategy & { mode: 'token' }) {
    const blockchainKey = this.getBlockchainKey();
    if (!blockchainKey) {
      throw new Error('Blockchain key not found');
    }

    const transferTopic = ethers.id('Transfer(address,address,uint256)');

    const getFilter = () => {
      const watchers = this.#watchersByToken.get(strategy.tokenKey);
      if (!watchers || watchers.size === 0) return null;

      const addresses = Array.from(watchers.values()).map(w => w.address);

      return {
        address: strategy.contractAddress,
        topics: [transferTopic, null, addresses.map(addr => ethers.zeroPadValue(addr, 32))],
      };
    };

    const handler = async (log: ethers.Log) => {
      try {
        const watchers = this.#watchersByToken.get(strategy.tokenKey);
        if (!watchers || watchers.size === 0) return;

        const iface = new ethers.Interface([
          'event Transfer(address indexed from, address indexed to, uint256 value)',
        ]);
        const decoded = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!decoded) return;

        const to = decoded.args.to as string;
        const watchKey = this.#findWatchKey(watchers, to);
        if (!watchKey) return;

        const watcher = watchers.get(watchKey);
        if (!watcher) return;

        const amount = (decoded.args.value as bigint).toString();
        const from = decoded.args.from as string;

        const block = await this.#provider.getBlock(log.blockNumber);
        if (!block) return;

        this.logger.log(`Detected ${this.#tokenPrefix.toUpperCase()} transfer`, {
          txHash: log.transactionHash,
          contract: strategy.contractAddress,
          to,
          amount,
          blockNumber: log.blockNumber,
        });

        await this.dispatchDetectedTransaction({
          blockchainKey,
          tokenId: strategy.tokenId,
          derivedPath: watcher.derivedPath,
          address: watcher.address,
          txHash: log.transactionHash,
          sender: from,
          amount,
          timestamp: block.timestamp,
        });
      } catch (error) {
        this.logger.error(
          `Error processing ${this.#tokenPrefix.toUpperCase()} transfer event`,
          error,
        );
      }
    };

    const filter = getFilter();
    if (filter) {
      this.#provider.on(filter, handler);

      this.#activeSubscriptions.set(strategy.tokenKey, () => {
        const currentFilter = getFilter();
        if (currentFilter) {
          this.#provider.off(currentFilter, handler);
        }
      });

      this.logger.log(`${this.#tokenPrefix.toUpperCase()} listener started`, {
        contract: strategy.contractAddress,
      });
    }
  }

  #findWatchKey(watchers: Map<string, AddressChanged>, address: string): string | undefined {
    const normalized = address.toLowerCase();
    for (const [key, watcher] of watchers.entries()) {
      if (watcher.address.toLowerCase() === normalized) {
        return key;
      }
    }
    return undefined;
  }
}
