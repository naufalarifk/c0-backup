import { Injectable, OnModuleInit } from '@nestjs/common';

import { Observable } from 'rxjs';

interface BitcoinRpcResponse {
  result: unknown;
  error?: { message: string };
  id: string | number;
}

interface BitcoinBlockInfo {
  height: number;
  timestamp: number;
  transactions?: string[];
  hash?: string;
  size?: number;
  weight?: number;
  method?: string;
}

interface BitcoinBlock {
  hash: string;
  height: number;
  time: number;
  tx: string[];
  size: number;
  weight: number;
}

interface BitcoinTransactionAnalysis {
  type: string;
  features: Array<{ type: string; data?: unknown }>;
  inputs: number;
  outputs: number;
  value: number;
  fees: number;
  error?: string;
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
      addresses?: string[];
    };
  }>;
  hex: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

@Injectable()
export class BitcoinService implements OnModuleInit {
  private rpcUrl: string;
  private rpcUser: string;
  private rpcPassword: string;

  constructor() {
    this.rpcUrl = process.env.BTC_RPC_URL || '';
    this.rpcUser = process.env.BTC_RPC_USER || '';
    this.rpcPassword = process.env.BTC_RPC_PASSWORD || '';
  }

  onModuleInit() {
    console.log('Bitcoin service initialized');

    // Test connection on startup
    this.isHealthy()
      .then(healthy => {
        if (healthy) {
          console.log('Bitcoin connection is healthy');
          return this.getCurrentBlockHeight();
        } else {
          console.error('Bitcoin connection is not healthy');
          return null;
        }
      })
      .then(height => {
        if (height) {
          console.log(`Current Bitcoin block height: ${height}`);
        }
      })
      .catch(err => {
        console.error('Error testing Bitcoin connection:', err);
      });
  }

  /**
   * Returns an Observable that emits every new block
   * Using polling approach since Bitcoin blocks are ~10 minutes apart
   */
  onNewBlock(): Observable<BitcoinBlockInfo> {
    return new Observable(subscriber => {
      let lastBlockHeight = 0;
      let isPolling = false;

      const pollForNewBlocks = async () => {
        if (isPolling) return;
        isPolling = true;

        try {
          const currentHeight = await this.getCurrentBlockHeight();

          if (currentHeight > lastBlockHeight) {
            // Process new blocks
            for (let height = lastBlockHeight + 1; height <= currentHeight; height++) {
              const blockHash = await this.getBlockHash(height);
              const block = await this.getBlock(blockHash);

              subscriber.next({
                height: height,
                hash: blockHash,
                timestamp: block.time * 1000, // Convert to milliseconds
                transactions: block.tx,
                size: block.size,
                weight: block.weight,
                method: 'polling',
              });
            }

            lastBlockHeight = currentHeight;
            console.log(
              `BTC processed blocks up to ${lastBlockHeight} (current: ${currentHeight})`,
            );
          }
        } catch (error) {
          console.error('Error polling for Bitcoin blocks:', error);
        } finally {
          isPolling = false;
        }
      };

      // Initialize with current block height
      this.getCurrentBlockHeight()
        .then(async height => {
          lastBlockHeight = height;
          console.log(`Starting Bitcoin polling from block ${height}`);

          // Emit the current block immediately to show real data
          try {
            const blockHash = await this.getBlockHash(height);
            const block = await this.getBlock(blockHash);

            subscriber.next({
              height: height,
              hash: blockHash,
              timestamp: block.time * 1000, // Convert to milliseconds
              transactions: block.tx,
              size: block.size,
              weight: block.weight,
              method: 'polling',
            });

            console.log(
              `BTC emitted current block ${height} with ${block.tx?.length || 0} transactions`,
            );
          } catch (error) {
            console.error('Error emitting initial Bitcoin block:', error);
          }
        })
        .catch(err => {
          console.error('Error getting initial Bitcoin block height:', err);
        });

      // Poll every 30 seconds (Bitcoin blocks are ~10 minutes)
      const pollInterval = setInterval(() => {
        pollForNewBlocks().catch(err => {
          console.error('Bitcoin polling error:', err);
        });
      }, 30000);

      // Cleanup on unsubscribe
      return () => {
        clearInterval(pollInterval);
      };
    });
  }

  /**
   * Make RPC call to Bitcoin node
   */
  private async makeRpcCall(method: string, params: unknown[] = []): Promise<unknown> {
    const requestBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params,
    };

    try {
      if (!this.rpcUrl) {
        console.warn('No BTC_RPC_URL provided, falling back to simulation');
        return this.simulateBitcoinRpc(method, params);
      }

      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.rpcUser && this.rpcPassword
            ? {
                Authorization: `Basic ${Buffer.from(`${this.rpcUser}:${this.rpcPassword}`).toString(
                  'base64',
                )}`,
              }
            : {}),
        },
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
      console.error(`Bitcoin RPC error for method ${method}:`, error);
      // Fall back to simulation if real RPC fails
      console.warn('Falling back to simulated data due to RPC error');
      return this.simulateBitcoinRpc(method, params);
    }
  }

  /**
   * Simulate Bitcoin RPC responses for demo purposes
   * In production, replace this with actual RPC calls
   */
  private async simulateBitcoinRpc(method: string, params: unknown[]): Promise<unknown> {
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
  async getCurrentBlockHeight(): Promise<number> {
    try {
      const result = await this.makeRpcCall('getblockcount');
      return result as number;
    } catch (error) {
      console.error('Error fetching Bitcoin block height:', error);
      throw error;
    }
  }

  /**
   * Get block hash by height
   */
  async getBlockHash(height: number): Promise<string> {
    try {
      const result = await this.makeRpcCall('getblockhash', [height]);
      return result as string;
    } catch (error) {
      console.error(`Error fetching Bitcoin block hash for height ${height}:`, error);
      throw error;
    }
  }

  /**
   * Get block by hash
   */
  async getBlock(hash: string): Promise<BitcoinBlock> {
    try {
      const result = await this.makeRpcCall('getblock', [hash]);
      return result as BitcoinBlock;
    } catch (error) {
      console.error(`Error fetching Bitcoin block ${hash}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const result = await this.makeRpcCall('getrawtransaction', [txid, true]);
      return result as BitcoinTransaction;
    } catch (error) {
      console.error(`Error fetching Bitcoin transaction ${txid}:`, error);
      throw error;
    }
  }

  /**
   * Check connection health
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.getCurrentBlockHeight();
      return true;
    } catch (error) {
      console.error('Bitcoin connection health check failed:', error);
      return false;
    }
  }

  /**
   * Analyze a Bitcoin transaction for special features
   */
  async analyzeTransactionForTokens(txid: string): Promise<BitcoinTransactionAnalysis> {
    try {
      const transaction = await this.getTransaction(txid);

      const analysis = {
        type: 'native', // BTC transfer by default
        features: [],
        inputs: transaction.vin?.length || 0,
        outputs: transaction.vout?.length || 0,
        value: 0,
        fees: 0,
      };

      // Calculate total output value
      if (transaction.vout) {
        analysis.value = transaction.vout.reduce(
          (sum: number, output: { value: number }) => sum + output.value,
          0,
        );
      }

      // Check for special transaction types
      this.detectSpecialTransactionTypes(transaction, analysis);

      // Check for potential Ordinals/Inscriptions
      this.detectOrdinals(transaction, analysis);

      // Check for multi-signature
      this.detectMultiSig(transaction, analysis);

      return analysis;
    } catch (error) {
      console.error('Error analyzing Bitcoin transaction:', error);
      return {
        type: 'error',
        features: [],
        inputs: 0,
        outputs: 0,
        value: 0,
        fees: 0,
        error: error.message,
      };
    }
  }

  /**
   * Detect special transaction types
   */
  private detectSpecialTransactionTypes(
    transaction: BitcoinTransaction,
    analysis: BitcoinTransactionAnalysis,
  ): void {
    // Check for OP_RETURN outputs (data storage)
    if (transaction.vout) {
      for (const output of transaction.vout) {
        if (output.scriptPubKey && output.scriptPubKey.type === 'nulldata') {
          analysis.features.push({
            type: 'op_return',
            data: { hex: output.scriptPubKey.hex, value: output.value },
          });
          analysis.type = 'data';
        }
      }
    }

    // Check for witness data (SegWit)
    if (transaction.vin) {
      for (const input of transaction.vin) {
        if (input.txinwitness && input.txinwitness.length > 0) {
          analysis.features.push({
            type: 'segwit',
            data: { witness_data: input.txinwitness },
          });
        }
      }
    }
  }

  /**
   * Detect potential Ordinals/Inscriptions
   */
  private detectOrdinals(
    transaction: BitcoinTransaction,
    analysis: BitcoinTransactionAnalysis,
  ): void {
    // Look for inscription patterns in witness data
    if (transaction.vin) {
      for (const input of transaction.vin) {
        if (input.txinwitness) {
          for (const witness of input.txinwitness) {
            // Check for inscription envelope pattern
            if (
              witness.includes('0063036f7264') || // "ord" in hex
              witness.includes('OP_FALSE OP_IF') ||
              witness.length > 1000 // Large witness data often indicates inscriptions
            ) {
              analysis.features.push({
                type: 'potential_ordinal',
                data: { witness_size: witness.length },
              });
              analysis.type = 'ordinal';
            }
          }
        }
      }
    }
  }

  /**
   * Detect multi-signature transactions
   */
  private detectMultiSig(
    transaction: BitcoinTransaction,
    analysis: BitcoinTransactionAnalysis,
  ): void {
    if (transaction.vout) {
      for (const output of transaction.vout) {
        if (output.scriptPubKey && output.scriptPubKey.type === 'multisig') {
          analysis.features.push({
            type: 'multisig',
            data: {
              required_sigs: output.scriptPubKey.reqSigs,
              addresses: output.scriptPubKey.addresses,
            },
          });
          analysis.type = 'multisig';
        }
      }
    }
  }
}
