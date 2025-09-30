import type { ActiveInvoiceRecord } from '../../shared/repositories/finance.types';
import type { InvoicePaymentJobData } from '../invoice-payments/invoice-payment.types';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ethers } from 'ethers';

import { InvoicePaymentQueueService } from '../invoice-payments/invoice-payment.queue.service';
import { ActiveInvoiceStoreService } from './active-invoice-store.service';
import { BitcoinService } from './btc.service';
import { EthereumService } from './eth.service';
import { MemoryStoreService } from './memory-store.service';
import { SolanaService } from './sol.service';

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private blockchainStats = {
    ETH: { block: 0, txs: 0 },
    SOL: { block: 0, txs: 0 },
    BTC: { block: 0, txs: 0 },
  };

  private startTime = Date.now();
  private totalScannedBlocks = 0;
  private lastLogTime = 0;
  private ethBlockchainKey?: string;
  private btcBlockchainKey?: string;
  private solBlockchainKey?: string;

  constructor(
    readonly ethService: EthereumService,
    readonly solService: SolanaService,
    readonly btcService: BitcoinService,
    private readonly store: MemoryStoreService,
    private readonly activeInvoiceStore: ActiveInvoiceStoreService,
    private readonly invoicePaymentQueue: InvoicePaymentQueueService,
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

  private async initializeBlockchainKeys(): Promise<void> {
    try {
      const network = await this.ethService.provider.getNetwork();
      this.ethBlockchainKey = `eip155:${network.chainId}`;
    } catch (error) {
      this.logger.error('Failed to determine Ethereum blockchain key from provider', error);
      this.ethBlockchainKey = process.env.ETH_BLOCKCHAIN_KEY ?? 'eip155:1';
    }

    this.btcBlockchainKey =
      process.env.BTC_BLOCKCHAIN_KEY ?? 'bip122:000000000019d6689c085ae165831e93';
    this.solBlockchainKey =
      process.env.SOL_BLOCKCHAIN_KEY ?? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

    this.logger.debug(
      `Indexer configured for blockchains: ETH=${this.ethBlockchainKey}, BTC=${this.btcBlockchainKey}, SOL=${this.solBlockchainKey}`,
    );
  }

  private setupEthereumSubscription(): void {
    this.ethService.onNewBlock().subscribe({
      next: block => {
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

        this.blockchainStats.ETH.block = block.number;
        this.blockchainStats.ETH.txs = Array.isArray(block.transactions)
          ? block.transactions.length
          : 0;
        this.totalScannedBlocks++;

        const blockchainKey = this.ethBlockchainKey;
        if (blockchainKey) {
          void this.processEthereumBlock(blockchainKey, block).catch(error => {
            this.logger.error('Failed to process Ethereum block for invoice detection', error);
          });
        }

        this.logStats();
      },
      error: err => {
        this.logger.error('Error in ETH block subscription', err);
      },
    });
  }

  private setupSolanaSubscription(): void {
    this.solService.onNewSlot().subscribe({
      next: slotInfo => {
        this.store.addBlock('sol', slotInfo as unknown as Record<string, unknown>);

        this.blockchainStats.SOL.block = slotInfo.slot;
        this.blockchainStats.SOL.txs = slotInfo.transactions?.length || 0;
        this.totalScannedBlocks++;

        // TODO: Implement Solana invoice payment detection
        this.logStats();
      },
      error: err => {
        this.logger.error('Error in SOL slot subscription', err);
      },
    });
  }

  private setupBitcoinSubscription(): void {
    this.btcService.onNewBlock().subscribe({
      next: blockInfo => {
        this.store.addBlock('btc', blockInfo as unknown as Record<string, unknown>);

        this.blockchainStats.BTC.block = blockInfo.height;
        this.blockchainStats.BTC.txs = blockInfo.transactions?.length || 0;
        this.totalScannedBlocks++;

        const blockchainKey = this.btcBlockchainKey;
        if (blockchainKey) {
          void this.detectBitcoinTransactions(blockchainKey, blockInfo).catch(error => {
            this.logger.error('Failed to process Bitcoin block for invoice detection', error);
          });
        }

        this.logStats();
      },
      error: err => {
        this.logger.error('Error in BTC block subscription', err);
      },
    });
  }

  private async processEthereumBlock(blockchainKey: string, block: ethers.Block): Promise<void> {
    this.captureEthereumTransactions(block);
    await this.detectEthereumTransactions(blockchainKey, block);
  }

  private captureEthereumTransactions(block: ethers.Block): void {
    if (!block.hash) {
      return;
    }

    const transactions = Array.isArray(block.transactions) ? block.transactions : [];

    for (const tx of transactions) {
      if (typeof tx === 'string') {
        this.store.addTx('eth', block.hash, { hash: tx });
        continue;
      }

      this.store.addTx('eth', block.hash, {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value?.toString(),
        nonce: tx.nonce,
        blockNumber: tx.blockNumber,
      });
    }

    const maxDetailedTx = 3;
    const detailed = transactions.slice(0, maxDetailedTx);
    detailed.forEach((tx, index) => {
      if (typeof tx !== 'string') {
        return;
      }

      setTimeout(() => {
        this.ethService.provider
          .getTransaction(tx)
          .then(fullTx => {
            if (fullTx) {
              this.store.addTx('eth', block.hash!, {
                hash: fullTx.hash,
                from: fullTx.from,
                to: fullTx.to,
                value: fullTx.value?.toString(),
                gasLimit: fullTx.gasLimit?.toString(),
                gasPrice: fullTx.gasPrice?.toString(),
                nonce: fullTx.nonce,
                blockNumber: fullTx.blockNumber,
                blockHash: fullTx.blockHash,
              });
            }
          })
          .catch(error => {
            if (!error.message?.includes('rate')) {
              this.logger.warn(`Error fetching ETH transaction ${tx}: ${error.message}`);
            }
          });
      }, index * 500);
    });
  }

  private async detectEthereumTransactions(
    blockchainKey: string,
    block: ethers.Block,
  ): Promise<void> {
    const transactions = Array.isArray(block.transactions) ? block.transactions : [];
    if (transactions.length === 0) {
      return;
    }

    const blockTimestampMs =
      (typeof block.timestamp === 'number' ? block.timestamp : Math.floor(Date.now() / 1000)) *
      1000;

    for (const tx of transactions) {
      if (typeof tx === 'string') {
        continue;
      }

      if (!tx.to) {
        continue;
      }

      const invoice = this.activeInvoiceStore.getInvoice(blockchainKey, tx.to);
      if (!invoice) {
        continue;
      }

      const amount = this.getEthereumValueAsBigInt(tx.value);

      await this.enqueueInvoicePayment({
        invoice,
        blockchainKey,
        walletAddress: tx.to,
        amount,
        transactionHash: tx.hash,
        detectedAtMs: blockTimestampMs,
        sourceAddress: tx.from ?? undefined,
        blockNumber: block.number,
      });
    }
  }

  private getEthereumValueAsBigInt(value: unknown): bigint {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'string') {
      return value ? BigInt(value) : 0n;
    }
    if (typeof value === 'number') {
      return BigInt(Math.trunc(value));
    }
    if (value && typeof value === 'object' && 'toString' in value) {
      try {
        return BigInt((value as { toString(): string }).toString());
      } catch {
        return 0n;
      }
    }
    return 0n;
  }

  private async enqueueInvoicePayment(params: {
    invoice: ActiveInvoiceRecord;
    blockchainKey: string;
    walletAddress: string;
    amount: bigint;
    transactionHash: string;
    detectedAtMs: number;
    sourceAddress?: string;
    tokenStandard?: InvoicePaymentJobData['tokenStandard'];
    tokenIdentifier?: string;
    blockNumber?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (params.amount <= 0n) {
      return;
    }

    if (['Paid', 'Cancelled'].includes(params.invoice.status)) {
      this.logger.debug(
        `Invoice ${params.invoice.id} is ${params.invoice.status}. Skipping detected payment ${params.transactionHash}`,
      );
      return;
    }

    await this.invoicePaymentQueue.enqueuePaymentDetection({
      invoiceId: params.invoice.id,
      blockchainKey: params.blockchainKey,
      walletAddress: params.invoice.walletAddress,
      transactionHash: params.transactionHash,
      amount: params.amount.toString(),
      detectedAt: new Date(params.detectedAtMs).toISOString(),
      sourceAddress: params.sourceAddress,
      tokenStandard: params.tokenStandard ?? 'native',
      tokenIdentifier: params.tokenIdentifier,
      blockNumber: params.blockNumber,
      metadata: params.metadata,
    });

    this.logger.debug(
      `Detected payment candidate for invoice ${params.invoice.id} (${params.blockchainKey}) via tx ${params.transactionHash}`,
    );
  }

  private async detectBitcoinTransactions(
    blockchainKey: string,
    blockInfo: { height: number; transactions?: unknown[]; timestamp?: number },
  ): Promise<void> {
    const txIds = blockInfo.transactions;
    if (!Array.isArray(txIds) || txIds.length === 0) {
      return;
    }

    const detectedAtMs = typeof blockInfo.timestamp === 'number' ? blockInfo.timestamp : Date.now();

    for (const txid of txIds) {
      if (typeof txid !== 'string') {
        continue;
      }

      try {
        const transaction = await this.btcService.getTransaction(txid);

        for (const output of transaction.vout ?? []) {
          const addresses = output.scriptPubKey?.addresses ?? [];
          if (!Array.isArray(addresses)) {
            continue;
          }

          for (const address of addresses) {
            if (!address) {
              continue;
            }

            const invoice = this.activeInvoiceStore.getInvoice(blockchainKey, address);
            if (!invoice) {
              continue;
            }

            const amount = this.bitcoinValueToSatoshis(output.value);

            await this.enqueueInvoicePayment({
              invoice,
              blockchainKey,
              walletAddress: address,
              amount,
              transactionHash: txid,
              detectedAtMs,
              tokenStandard: 'bitcoin',
              metadata: { outputIndex: output.n },
            });
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to analyze Bitcoin transaction ${txid}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  private bitcoinValueToSatoshis(value: unknown): bigint {
    if (typeof value === 'number') {
      return BigInt(Math.round(value * 1e8));
    }

    if (typeof value === 'string') {
      const [whole, fractional = ''] = value.split('.');
      const fractionPadded = (fractional + '00000000').slice(0, 8);
      return BigInt(whole || '0') * 100000000n + BigInt(fractionPadded || '0');
    }

    return 0n;
  }

  async onModuleInit() {
    this.store.startPeriodicCleanup();

    await this.initializeBlockchainKeys();
    await this.activeInvoiceStore.refreshAll();
    this.activeInvoiceStore.startAutoRefresh();

    this.setupEthereumSubscription();
    this.setupSolanaSubscription();
    this.setupBitcoinSubscription();
  }
}
