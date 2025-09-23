import { Injectable, Logger } from '@nestjs/common';

interface BlockData {
  hash?: string | null;
  number?: number;
  timestamp?: number;
  transactions?: unknown[] | readonly string[];
  [key: string]: unknown;
}

interface TransactionData {
  hash: string;
  from?: string | null;
  to?: string | null;
  value?: string | number | bigint | null;
  [key: string]: unknown;
}

interface ChainStore {
  blocks: BlockData[];
  txs: Map<string, TransactionData>;
}

@Injectable()
export class MemoryStoreService {
  private store: Record<string, ChainStore> = {};
  private readonly logger = new Logger(MemoryStoreService.name);

  constructor() {
    this.store['eth'] = { blocks: [], txs: new Map() };
    this.store['btc'] = { blocks: [], txs: new Map() };
    this.store['sol'] = { blocks: [], txs: new Map() };
    console.log(this.store['eth']);
  }

  addBlock(chain: 'eth' | 'sol' | 'btc', block: BlockData) {
    this.store[chain].blocks.push(block);
    // keep size bounded for memory safety (simple strategy)
    if (this.store[chain].blocks.length > 500) {
      this.store[chain].blocks.shift();
    }
  }

  addTx(chain: 'eth' | 'sol' | 'btc', hash: string, tx: TransactionData) {
    this.store[chain].txs.set(hash, tx);

    // 🛡️ MEMORY SAFETY: Limit transaction storage to prevent unbounded growth
    if (this.store[chain].txs.size > 1000) {
      // Remove oldest 200 transactions when limit is reached
      const entries = Array.from(this.store[chain].txs.entries());
      const toDelete = entries.slice(0, 200);
      toDelete.forEach(([hash]) => {
        this.store[chain].txs.delete(hash);
      });
      this.logger.warn(
        `Memory cleanup: Removed ${toDelete.length} old transactions from ${chain} store`,
      );
    }
  }

  getBlocks(chain: 'eth' | 'sol' | 'btc') {
    return this.store[chain].blocks;
  }

  getTx(chain: 'eth' | 'sol' | 'btc', hash: string) {
    return this.store[chain].txs.get(hash);
  }

  /**
   * 🛡️ MEMORY SAFETY: Manual cleanup method
   */
  cleanup() {
    // Clear all transactions
    this.store['eth'].txs.clear();
    this.store['btc'].txs.clear();
    this.store['sol'].txs.clear();

    // Keep only recent blocks (last 50 per chain)
    ['eth', 'btc', 'sol'].forEach(chain => {
      if (this.store[chain].blocks.length > 50) {
        this.store[chain].blocks = this.store[chain].blocks.slice(-50);
      }
    });

    this.logger.log('Manual memory cleanup completed');
  }

  /**
   * 🛡️ MEMORY SAFETY: Start periodic cleanup
   */
  startPeriodicCleanup() {
    setInterval(() => {
      const totalTxs =
        this.store['eth'].txs.size + this.store['btc'].txs.size + this.store['sol'].txs.size;

      if (totalTxs > 2000) {
        this.logger.warn(`High transaction count detected: ${totalTxs}. Running cleanup...`);
        this.cleanup();
      }
    }, 300000); // Every 5 minutes
  }
}
