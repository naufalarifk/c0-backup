import { Injectable, OnModuleInit } from '@nestjs/common';

import { ethers } from 'ethers';

import { BitcoinService } from './btc.service';
import { EthereumService } from './eth.service';
import { MemoryStoreService } from './memory-store.service';
import { SolanaService } from './sol.service';

@Injectable()
export class IndexerService implements OnModuleInit {
  private blockchainStats = {
    ETH: { block: 0, txs: 0 },
    SOL: { block: 0, txs: 0 },
    BTC: { block: 0, txs: 0 },
  };

  private startTime = Date.now();
  private totalScannedBlocks = 0;
  private lastLogTime = 0;

  constructor(
    readonly ethService: EthereumService,
    readonly solService: SolanaService,
    readonly btcService: BitcoinService,
    private readonly store: MemoryStoreService,
  ) {}

  private logStats() {
    const now = Date.now();
    const timeSinceLastLog = now - this.lastLogTime;

    // Only log every 10 seconds to avoid spam
    if (timeSinceLastLog < 10000) {
      return;
    }

    const uptime = Math.round((now - this.startTime) / 1000);

    console.log(`\n📊 Indexer Status (${uptime}s uptime, ${this.totalScannedBlocks} blocks):`);
    console.log(
      `   ETH: Block ${this.blockchainStats.ETH.block} (${this.blockchainStats.ETH.txs} txs)`,
    );
    console.log(
      `   SOL: Slot ${this.blockchainStats.SOL.block} (${this.blockchainStats.SOL.txs} txs)`,
    );
    console.log(
      `   BTC: Block ${this.blockchainStats.BTC.block} (${this.blockchainStats.BTC.txs} txs)\n`,
    );

    this.lastLogTime = now;
  }

  onModuleInit() {
    // Start periodic cleanup for memory store
    this.store.startPeriodicCleanup();

    // Ethereum subscription
    this.ethService.onNewBlock().subscribe({
      next: (block: ethers.Block) => {
        // Convert ethers.Block to BlockData format
        const blockData = {
          hash: block.hash,
          number: block.number,
          timestamp: block.timestamp,
          transactions: block.transactions,
          gasUsed: block.gasUsed?.toString(),
          parentHash: block.parentHash,
          miner: block.miner,
        };
        this.store.addBlock('eth', blockData);

        // Update stats
        this.blockchainStats.ETH.block = block.number;
        this.blockchainStats.ETH.txs = block.transactions.length;
        this.totalScannedBlocks++;

        // Only fetch details for a limited number of transactions to avoid rate limits
        const maxTxToFetch = 3;
        const txsToFetch = block.transactions.slice(0, maxTxToFetch);

        let processedCount = 0;
        for (const tx of txsToFetch) {
          setTimeout(() => {
            this.ethService.provider
              .getTransaction(tx)
              .then(fullTx => {
                if (fullTx && block.hash) {
                  // Convert ethers.TransactionResponse to TransactionData format
                  const txData = {
                    hash: fullTx.hash,
                    from: fullTx.from,
                    to: fullTx.to,
                    value: fullTx.value?.toString(),
                    gasLimit: fullTx.gasLimit?.toString(),
                    gasPrice: fullTx.gasPrice?.toString(),
                    nonce: fullTx.nonce,
                    blockNumber: fullTx.blockNumber,
                    blockHash: fullTx.blockHash,
                  };
                  this.store.addTx('eth', block.hash, txData);
                }
              })
              .catch(err => {
                // Suppress rate limit warnings to reduce noise
                if (
                  !err.message?.includes('exceeded') &&
                  !err.message?.includes('concurrent') &&
                  !err.message?.includes('rate') &&
                  err.code !== 1008
                ) {
                  console.error('Error fetching ETH transaction:', err.message);
                }
              });
          }, processedCount * 500); // 500ms delay between each request
          processedCount++;
        }

        // Store basic transaction hashes for all transactions
        if (block.hash) {
          for (const tx of block.transactions) {
            this.store.addTx('eth', block.hash, { hash: tx });
          }
        }

        this.logStats();
      },
      error: err => {
        console.error('Error in ETH block subscription:', err);
      },
    });

    // Solana subscription
    this.solService.onNewSlot().subscribe({
      next: (slotInfo: { slot: number; transactions?: unknown[]; timestamp?: number }) => {
        this.store.addBlock('sol', slotInfo);

        // Update stats
        this.blockchainStats.SOL.block = slotInfo.slot;
        this.blockchainStats.SOL.txs = slotInfo.transactions?.length || 0;
        this.totalScannedBlocks++;

        this.logStats();
      },
      error: err => {
        console.error('Error in SOL slot subscription:', err);
      },
    });

    // Bitcoin subscription
    this.btcService.onNewBlock().subscribe({
      next: (blockInfo: { height: number; transactions?: unknown[]; timestamp?: number }) => {
        this.store.addBlock('btc', blockInfo);

        // Update stats
        this.blockchainStats.BTC.block = blockInfo.height;
        this.blockchainStats.BTC.txs = blockInfo.transactions?.length || 0;
        this.totalScannedBlocks++;

        this.logStats();
      },
      error: err => {
        console.error('Error in BTC block subscription:', err);
      },
    });
  }
}
