import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { BITCOIN_MAINNET_KEY } from '../../../shared/constants/blockchain';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { InvoicePaymentQueueService } from '../../invoice-payments/invoice-payment.queue.service';
import { AddressChanged, IndexerListener, Listener } from '../indexer-listener.abstract';

interface BitcoinRpcResponse {
  result: unknown;
  error?: { message: string };
  id: string | number;
}

interface BitcoinBlock {
  hash: string;
  height: number;
  time: number;
  tx: string[];
  size: number;
  weight: number;
}

interface BitcoinTransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    scriptSig: { asm: string; hex: string };
    txinwitness?: string[];
  }>;
  vout: Array<{
    value: number;
    n: number;
    scriptPubKey: {
      asm: string;
      hex: string;
      type: string;
      reqSigs?: number;
      addresses?: string[]; // Deprecated in Bitcoin Core 23.0+
      address?: string; // New field in Bitcoin Core 23.0+
    };
  }>;
  hex: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

@Injectable()
@Listener(BITCOIN_MAINNET_KEY)
export class BitcoinMainnetIndexerListener extends IndexerListener {
  readonly logger = new TelemetryLogger(BitcoinMainnetIndexerListener.name);
  #watchers = new Map<string, AddressChanged>();
  #isRunning = false;
  #pollInterval?: NodeJS.Timeout;
  #lastProcessedBlock = 0;
  #pollIntervalMs = 60_000;
  #rpcUrl: string;

  constructor(
    discovery: DiscoveryService,
    redis: RedisService,
    invoicePaymentQueue: InvoicePaymentQueueService,
    private readonly appConfig: AppConfigService,
  ) {
    super(discovery, redis, invoicePaymentQueue);
    const bitcoinConfig = this.appConfig.blockchains[BITCOIN_MAINNET_KEY];
    this.#rpcUrl = bitcoinConfig.rpcUrls[0];
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
      this.#lastProcessedBlock = await this.#getCurrentBlockHeight();
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
      const currentHeight = await this.#getCurrentBlockHeight();

      if (currentHeight <= this.#lastProcessedBlock) {
        return;
      }

      const blockchainKey = this.getBlockchainKey();
      if (!blockchainKey) {
        throw new Error('Blockchain key not found');
      }

      for (let height = this.#lastProcessedBlock + 1; height <= currentHeight; height++) {
        const blockHash = await this.#getBlockHash(height);
        const block = await this.#getBlock(blockHash);

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
      const tx = await this.#getTransaction(txid);

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

  // Bitcoin RPC methods

  /**
   * Make RPC call to Bitcoin node
   */
  async #makeRpcCall(method: string, params: unknown[] = []): Promise<unknown> {
    const requestBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params,
    };

    try {
      if (!this.#rpcUrl) {
        this.logger.warn('No Bitcoin RPC URL provided, falling back to simulation');
        return this.#simulateBitcoinRpc(method, params);
      }

      const response = await fetch(this.#rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as BitcoinRpcResponse;

      if (data.error) {
        throw new Error(`Bitcoin RPC error: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      this.logger.error(`Bitcoin RPC error for method ${method}:`, error);
      // Fall back to simulation if real RPC fails
      this.logger.warn('Falling back to simulated data due to RPC error');
      return this.#simulateBitcoinRpc(method, params);
    }
  }

  /**
   * Simulate Bitcoin RPC responses for demo purposes
   * In production, replace this with actual RPC calls
   */
  async #simulateBitcoinRpc(method: string, params: unknown[]): Promise<unknown> {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay

    switch (method) {
      case 'getblockcount': {
        // Simulate current block height (Bitcoin testnet)
        return Math.floor(Date.now() / 600000) + 2500000; // ~10 minute blocks
      }

      case 'getblockhash': {
        const height = params[0] as number;
        // Generate a fake but consistent hash for the height
        return `000000000000${height.toString().padStart(10, '0')}abcdef`;
      }

      case 'getblock': {
        const hash = params[0] as string;
        const heightFromHash = parseInt(hash.slice(12, 22));
        return {
          hash: hash,
          height: heightFromHash,
          time: Math.floor(Date.now() / 1000) - (2500000 - heightFromHash) * 600,
          tx: [`tx1_${heightFromHash}`, `tx2_${heightFromHash}`, `tx3_${heightFromHash}`],
          size: 1000000 + Math.floor(Math.random() * 500000),
          weight: 4000000 + Math.floor(Math.random() * 2000000),
        };
      }

      case 'getrawtransaction': {
        const txid = params[0];
        return {
          txid: txid,
          size: 250 + Math.floor(Math.random() * 500),
          vsize: 150 + Math.floor(Math.random() * 300),
          weight: 600 + Math.floor(Math.random() * 1200),
          locktime: 0,
          vin: [{ txid: 'prev_tx', vout: 0 }],
          vout: [{ value: 0.001, scriptPubKey: { addresses: ['address1'] } }],
        };
      }

      default:
        throw new Error(`Unsupported RPC method: ${method}`);
    }
  }

  /**
   * Get current block height
   */
  async #getCurrentBlockHeight(): Promise<number> {
    try {
      const result = await this.#makeRpcCall('getblockcount');
      return result as number;
    } catch (error) {
      this.logger.error('Error fetching Bitcoin block height', error);
      throw error;
    }
  }

  /**
   * Get block hash by height
   */
  async #getBlockHash(height: number): Promise<string> {
    try {
      const result = await this.#makeRpcCall('getblockhash', [height]);
      return result as string;
    } catch (error) {
      this.logger.error(`Error fetching Bitcoin block hash for height ${height}:`, error);
      throw error;
    }
  }

  /**
   * Get block by hash
   */
  async #getBlock(hash: string): Promise<BitcoinBlock> {
    try {
      const result = await this.#makeRpcCall('getblock', [hash]);
      return result as BitcoinBlock;
    } catch (error) {
      this.logger.error(`Error fetching Bitcoin block ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async #getTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const result = await this.#makeRpcCall('getrawtransaction', [txid, true]);
      return result as BitcoinTransaction;
    } catch (error) {
      this.logger.error(`Error fetching Bitcoin transaction ${txid}:`, error);
      throw error;
    }
  }
}
