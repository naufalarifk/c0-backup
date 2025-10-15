import { Injectable } from '@nestjs/common';

import * as bitcoin from 'bitcoinjs-lib';

import { WalletFactory } from '../../../../shared/wallets/wallet.factory';
import { SettlementBlockchainService } from './wallet.abstract';

// Bitcoin API response types from Blockstream
interface BlockstreamAddressResponse {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

interface BlockstreamTransactionResponse {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout?: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address?: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    is_coinbase: boolean;
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

// Bitcoin blockchain keys (CAIP-2 format)
const BTC_MAINNET_KEY = 'bip122:000000000019d6689c085ae165831e93';
const BTC_TESTNET_KEY = 'bip122:000000000933ea01ad0ee984209779ba';

// Use testnet for testing, mainnet for production
const BTC_BLOCKCHAIN_KEY =
  process.env.BTC_USE_TESTNET === 'true' ? BTC_TESTNET_KEY : BTC_MAINNET_KEY;

/**
 * Bitcoin Settlement Service
 *
 * Implements settlement operations for Bitcoin blockchain.
 * Extends SettlementBlockchainService to provide Bitcoin-specific implementations
 * of balance queries, transaction verification, and network management.
 *
 * Supports multiple networks: mainnet, testnet
 * Configured via environment variables:
 * - BTC_USE_TESTNET=true -> testnet
 * - default -> mainnet
 */
@Injectable()
export class BtcService extends SettlementBlockchainService {
  private _apiUrl?: string;
  protected get apiUrl(): string {
    if (!this._apiUrl) {
      // Auto-detect API URL based on blockchain key if not explicitly set
      let url = process.env.BTC_API_URL;
      if (!url) {
        if (BTC_BLOCKCHAIN_KEY === BTC_TESTNET_KEY) {
          url = 'https://blockstream.info/testnet/api';
        } else {
          url = 'https://blockstream.info/api';
        }
      }
      this._apiUrl = url;
    }
    return this._apiUrl;
  }

  constructor(private readonly walletFactory: WalletFactory) {
    super();
  }

  /**
   * Get Bitcoin hot wallet balance
   */
  async getBalance(): Promise<number> {
    const blockchain = this.walletFactory.getBlockchain(BTC_BLOCKCHAIN_KEY);
    if (!blockchain) {
      throw new Error(`Unsupported blockchain: ${BTC_BLOCKCHAIN_KEY}`);
    }
    const hotWallet = await blockchain.getHotWallet();
    const address = await hotWallet.getAddress();

    // Query balance from Blockstream API
    const response = await fetch(`${this.apiUrl}/address/${address}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.statusText}`);
    }

    const data = (await response.json()) as BlockstreamAddressResponse;
    const balance =
      data.chain_stats.funded_txo_sum -
      data.chain_stats.spent_txo_sum +
      (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum);

    return balance; // Returns satoshis as number
  }

  /**
   * Get the current Bitcoin blockchain key being used
   */
  getBlockchainKey(): string {
    return BTC_BLOCKCHAIN_KEY;
  }

  /**
   * Get the current network name based on blockchain key
   */
  getNetworkName(): 'mainnet' | 'testnet' {
    if (BTC_BLOCKCHAIN_KEY === BTC_TESTNET_KEY) {
      return 'testnet';
    } else {
      return 'mainnet';
    }
  }

  /**
   * Get the current API URL being used
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Get the RPC URL being used (Bitcoin uses REST API, not RPC)
   * Returns the same as getApiUrl() for consistency with interface
   */
  getRpcUrl(): string {
    return this.apiUrl;
  }

  /**
   * Check if a transaction was confirmed
   */
  async getTransactionStatus(txHash: string): Promise<{
    confirmed: boolean;
    success: boolean;
    blockHeight?: number;
    blockTime?: number;
    confirmations?: number;
    err?: any;
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/tx/${txHash}`);

      if (!response.ok) {
        return {
          confirmed: false,
          success: false,
        };
      }

      const tx = (await response.json()) as BlockstreamTransactionResponse;

      // Bitcoin transactions don't have a "failed" state like Ethereum
      // A transaction is either confirmed or not
      const confirmed = tx.status && tx.status.confirmed;

      return {
        confirmed,
        success: confirmed, // If confirmed, it's successful
        blockHeight: tx.status?.block_height,
        blockTime: tx.status?.block_time,
        confirmations: confirmed ? 1 : 0, // Simplified: 0 or 1+
        err: null,
      };
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  /**
   * Get detailed transaction information
   */
  async getTransactionDetails(txHash: string): Promise<{
    success: boolean;
    blockTime?: number;
    blockHeight?: number;
    fee?: number;
    inputs?: Array<{ address: string; value: number }>;
    outputs?: Array<{ address: string; value: number }>;
    err?: any;
    meta?: any;
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/tx/${txHash}`);

      if (!response.ok) {
        return {
          success: false,
        };
      }

      const tx = (await response.json()) as BlockstreamTransactionResponse;

      // Parse inputs
      const inputs = tx.vin?.map(input => ({
        address: input.prevout?.scriptpubkey_address || '',
        value: input.prevout?.value || 0,
      }));

      // Parse outputs
      const outputs = tx.vout?.map(output => ({
        address: output.scriptpubkey_address || '',
        value: output.value || 0,
      }));

      return {
        success: tx.status?.confirmed || false,
        blockTime: tx.status?.block_time,
        blockHeight: tx.status?.block_height,
        fee: tx.fee,
        inputs,
        outputs,
        err: null,
        meta: tx,
      };
    } catch (error) {
      throw new Error(`Failed to get transaction details: ${error.message}`);
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   */
  async waitForConfirmation(
    txHash: string,
    commitment: string = 'confirmed',
    timeoutSeconds: number = 60,
  ): Promise<{
    confirmed: boolean;
    success: boolean;
    blockHeight?: number;
    err?: any;
  }> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.getTransactionStatus(txHash);

        if (status.confirmed) {
          return {
            confirmed: true,
            success: true,
            blockHeight: status.blockHeight,
          };
        }

        // Wait 10 seconds before next check (Bitcoin ~10 min block time)
        await new Promise(resolve => setTimeout(resolve, 10000));
      } catch (error) {
        // Continue waiting on errors
      }
    }

    // Timeout reached
    return {
      confirmed: false,
      success: false,
      err: { timeout: true, message: `Transaction not confirmed within ${timeoutSeconds}s` },
    };
  }

  /**
   * Verify that a transfer was successful between two addresses
   */
  async verifyTransfer(
    txHash: string,
    expectedFrom: string,
    expectedTo: string,
    expectedAmount: number,
  ): Promise<{
    verified: boolean;
    success: boolean;
    actualAmount?: number;
    fee?: number;
    from?: string;
    to?: string;
    errors?: string[];
  }> {
    const errors: string[] = [];

    try {
      const txDetails = await this.getTransactionDetails(txHash);

      if (!txDetails.success) {
        errors.push('Transaction not confirmed or not found');
        return { verified: false, success: false, errors };
      }

      // Find input from expectedFrom address
      const fromInput = txDetails.inputs?.find(
        input => input.address.toLowerCase() === expectedFrom.toLowerCase(),
      );

      if (!fromInput) {
        errors.push(`From address ${expectedFrom} not found in transaction inputs`);
      }

      // Find output to expectedTo address
      const toOutput = txDetails.outputs?.find(
        output => output.address.toLowerCase() === expectedTo.toLowerCase(),
      );

      if (!toOutput) {
        errors.push(`To address ${expectedTo} not found in transaction outputs`);
        return { verified: false, success: true, errors };
      }

      // Verify amount (with tolerance for Bitcoin dust)
      const actualAmount = toOutput.value;
      const tolerance = 1000; // Allow 1000 satoshi tolerance
      if (Math.abs(actualAmount - expectedAmount) > tolerance) {
        errors.push(
          `Amount mismatch: expected ${expectedAmount} satoshis, got ${actualAmount} satoshis`,
        );
      }

      return {
        verified: errors.length === 0,
        success: true,
        actualAmount,
        fee: txDetails.fee,
        from: fromInput?.address,
        to: toOutput.address,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push(`Verification failed: ${error.message}`);
      return { verified: false, success: false, errors };
    }
  }

  /**
   * Get comprehensive transaction information for settlement matching
   */
  async getTransactionForMatching(txHash: string): Promise<{
    found: boolean;
    confirmed: boolean;
    success: boolean;
    amount?: string;
    from?: string;
    to?: string;
    fee?: string;
    blockTime?: number;
    blockHeight?: number;
    confirmations?: number;
    raw?: any;
  }> {
    try {
      const status = await this.getTransactionStatus(txHash);
      const details = await this.getTransactionDetails(txHash);

      if (!details || !details.success) {
        return {
          found: false,
          confirmed: false,
          success: false,
        };
      }

      // Get primary input and output
      const from = details.inputs?.[0]?.address;
      const to = details.outputs?.[0]?.address;
      const amount = details.outputs?.[0]?.value;

      return {
        found: true,
        confirmed: status.confirmed,
        success: details.success,
        amount: amount ? (amount / 1e8).toString() : undefined, // Convert satoshis to BTC
        from,
        to,
        fee: details.fee ? (details.fee / 1e8).toString() : undefined,
        blockTime: details.blockTime,
        blockHeight: details.blockHeight,
        confirmations: status.confirmations,
        raw: details,
      };
    } catch (error) {
      return {
        found: false,
        confirmed: false,
        success: false,
      };
    }
  }

  /**
   * Get balance for a specific address
   */
  async getAddressBalance(address: string): Promise<number> {
    try {
      const response = await fetch(`${this.apiUrl}/address/${address}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`);
      }

      const data = (await response.json()) as BlockstreamAddressResponse;
      const balance =
        data.chain_stats.funded_txo_sum -
        data.chain_stats.spent_txo_sum +
        (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum);

      return balance;
    } catch (error) {
      throw new Error(`Failed to get balance for ${address}: ${error.message}`);
    }
  }

  /**
   * Check if an address received funds in a specific transaction
   */
  async getAddressBalanceChange(
    txHash: string,
    address: string,
  ): Promise<{
    balanceChange: number;
    success: boolean;
    found: boolean;
  }> {
    try {
      const txDetails = await this.getTransactionDetails(txHash);

      if (!txDetails.success) {
        return { balanceChange: 0, success: false, found: false };
      }

      const normalizedAddress = address.toLowerCase();

      // Calculate balance change for the address
      let balanceChange = 0;
      let found = false;

      // Check inputs (money sent from this address)
      if (txDetails.inputs) {
        for (const input of txDetails.inputs) {
          if (input.address.toLowerCase() === normalizedAddress) {
            balanceChange -= input.value;
            found = true;
          }
        }
      }

      // Check outputs (money received by this address)
      if (txDetails.outputs) {
        for (const output of txDetails.outputs) {
          if (output.address.toLowerCase() === normalizedAddress) {
            balanceChange += output.value;
            found = true;
          }
        }
      }

      // Subtract fee if this address sent the transaction
      if (found && balanceChange < 0 && txDetails.fee) {
        balanceChange -= txDetails.fee;
      }

      return {
        balanceChange,
        success: true,
        found,
      };
    } catch (error) {
      throw new Error(`Failed to get balance change: ${error.message}`);
    }
  }
}
