import { Injectable } from '@nestjs/common';

import { ethers } from 'ethers';

import { WalletFactory } from '../../../../shared/wallets/wallet.factory';
import { SettlementBlockchainService } from './wallet.abstract';

// Binance Smart Chain blockchain keys (CAIP-2 format)
const BSC_MAINNET_KEY = 'eip155:56';
const BSC_TESTNET_KEY = 'eip155:97';

// Use testnet for testing, mainnet for production
const BSC_BLOCKCHAIN_KEY =
  process.env.BSC_USE_TESTNET === 'true' ? BSC_TESTNET_KEY : BSC_MAINNET_KEY;

/**
 * Binance Smart Chain Settlement Service
 *
 * Implements settlement operations for Binance Smart Chain (BSC) blockchain.
 * Extends SettlementBlockchainService to provide BSC-specific implementations
 * of balance queries, transaction verification, and network management.
 *
 * BSC is EVM-compatible, so implementation is very similar to Ethereum.
 *
 * Supports multiple networks: mainnet, testnet
 * Configured via environment variables:
 * - BSC_USE_TESTNET=true -> testnet
 * - default -> mainnet
 */
@Injectable()
export class BscService extends SettlementBlockchainService {
  private _provider?: ethers.JsonRpcProvider;
  protected get provider(): ethers.JsonRpcProvider {
    if (!this._provider) {
      // Auto-detect RPC URL based on blockchain key if not explicitly set
      let rpcUrl = process.env.BSC_RPC_URL;
      if (!rpcUrl) {
        if (BSC_BLOCKCHAIN_KEY === BSC_TESTNET_KEY) {
          rpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545';
        } else {
          rpcUrl = 'https://bsc-dataseed1.binance.org';
        }
      }
      this._provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return this._provider;
  }

  constructor(private readonly walletFactory: WalletFactory) {
    super();
  }

  /**
   * Get BSC hot wallet balance
   */
  async getBalance(): Promise<number> {
    const blockchain = this.walletFactory.getBlockchain(BSC_BLOCKCHAIN_KEY);
    if (!blockchain) {
      throw new Error(`Unsupported blockchain: ${BSC_BLOCKCHAIN_KEY}`);
    }
    const hotWallet = await blockchain.getHotWallet();
    const address = await hotWallet.getAddress();

    const balance = await this.provider.getBalance(address);
    return Number(balance); // Returns wei as number
  }

  /**
   * Get the current BSC blockchain key being used
   */
  getBlockchainKey(): string {
    return BSC_BLOCKCHAIN_KEY;
  }

  /**
   * Get the current network name based on blockchain key
   */
  getNetworkName(): 'mainnet' | 'testnet' {
    if (BSC_BLOCKCHAIN_KEY === BSC_TESTNET_KEY) {
      return 'testnet';
    } else {
      return 'mainnet';
    }
  }

  /**
   * Get the current RPC URL being used
   */
  getRpcUrl(): string {
    return this.provider._getConnection().url;
  }

  /**
   * Check if a transaction was successful by hash
   */
  async getTransactionStatus(txHash: string): Promise<{
    confirmed: boolean;
    success: boolean;
    blockNumber?: number;
    blockTime?: number;
    confirmations?: number | null;
    err?: any;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return {
          confirmed: false,
          success: false,
        };
      }

      // Get block details for timestamp
      const block = await this.provider.getBlock(receipt.blockNumber);
      const confirmations = await receipt.confirmations();

      return {
        confirmed: confirmations > 0,
        success: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        blockTime: block?.timestamp,
        confirmations,
        err: receipt.status === 0 ? { revert: true } : null,
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
    blockNumber?: number;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    accountKeys?: string[];
    err?: any;
    meta?: any;
  }> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx || !receipt) {
        return {
          success: false,
        };
      }

      const block = await this.provider.getBlock(receipt.blockNumber);
      const gasUsed = receipt.gasUsed;
      const gasPrice = tx.gasPrice || 0n;
      const fee = Number(gasUsed * gasPrice);

      return {
        success: receipt.status === 1,
        blockTime: block?.timestamp,
        blockNumber: receipt.blockNumber,
        fee,
        accountKeys: [tx.from, tx.to || ''],
        err: receipt.status === 0 ? { revert: true } : null,
        meta: {
          receipt,
          transaction: tx,
          gasUsed: Number(gasUsed),
          gasPrice: Number(gasPrice),
        },
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
    timeoutSeconds: number = 30,
  ): Promise<{
    confirmed: boolean;
    success: boolean;
    blockNumber?: number;
    err?: any;
  }> {
    try {
      // BSC has ~3 second block time, require more confirmations for finalized
      const requiredConfirmations = commitment === 'finalized' ? 15 : 3;

      // Wait for transaction with timeout
      const receipt = await this.provider.waitForTransaction(
        txHash,
        requiredConfirmations,
        timeoutSeconds * 1000,
      );

      if (!receipt) {
        return {
          confirmed: false,
          success: false,
          err: { timeout: true, message: `Transaction not confirmed within ${timeoutSeconds}s` },
        };
      }

      return {
        confirmed: true,
        success: receipt.status === 1,
        blockNumber: receipt.blockNumber,
        err: receipt.status === 0 ? { revert: true } : null,
      };
    } catch (error) {
      return {
        confirmed: false,
        success: false,
        err: { timeout: true, message: error.message },
      };
    }
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
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx || !receipt) {
        errors.push('Transaction not found');
        return { verified: false, success: false, errors };
      }

      if (receipt.status === 0) {
        errors.push('Transaction reverted');
        return { verified: false, success: false, errors };
      }

      // Verify addresses (case-insensitive)
      const actualFrom = tx.from.toLowerCase();
      const actualTo = (tx.to || '').toLowerCase();

      if (actualFrom !== expectedFrom.toLowerCase()) {
        errors.push(`From address mismatch: expected ${expectedFrom}, got ${tx.from}`);
      }

      if (actualTo !== expectedTo.toLowerCase()) {
        errors.push(`To address mismatch: expected ${expectedTo}, got ${tx.to}`);
      }

      // Verify amount
      const actualAmount = Number(tx.value);
      const tolerance = 1000; // Allow 1000 wei tolerance
      if (Math.abs(actualAmount - expectedAmount) > tolerance) {
        errors.push(`Amount mismatch: expected ${expectedAmount} wei, got ${actualAmount} wei`);
      }

      // Calculate fee
      const gasUsed = receipt.gasUsed;
      const gasPrice = tx.gasPrice || 0n;
      const fee = Number(gasUsed * gasPrice);

      return {
        verified: errors.length === 0,
        success: true,
        actualAmount,
        fee,
        from: tx.from,
        to: tx.to || undefined,
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
    blockNumber?: number;
    confirmations?: number;
    raw?: any;
  }> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx || !receipt) {
        return {
          found: false,
          confirmed: false,
          success: false,
        };
      }

      const block = await this.provider.getBlock(receipt.blockNumber);
      const gasUsed = receipt.gasUsed;
      const gasPrice = tx.gasPrice || 0n;
      const fee = gasUsed * gasPrice;
      const confirmations = await receipt.confirmations();

      return {
        found: true,
        confirmed: confirmations > 0,
        success: receipt.status === 1,
        amount: ethers.formatEther(tx.value), // Convert wei to BNB
        from: tx.from,
        to: tx.to || undefined,
        fee: ethers.formatEther(fee),
        blockTime: block?.timestamp,
        blockNumber: receipt.blockNumber,
        confirmations,
        raw: { tx, receipt },
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
      const balance = await this.provider.getBalance(address);
      return Number(balance);
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
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!tx || !receipt) {
        return { balanceChange: 0, success: false, found: false };
      }

      const normalizedAddress = address.toLowerCase();
      const txFrom = tx.from.toLowerCase();
      const txTo = (tx.to || '').toLowerCase();

      // Calculate balance change for the address
      let balanceChange = 0;

      if (normalizedAddress === txFrom) {
        // Sender: negative amount + gas fee
        const gasUsed = receipt.gasUsed;
        const gasPrice = tx.gasPrice || 0n;
        const fee = gasUsed * gasPrice;
        balanceChange = -Number(tx.value) - Number(fee);
      } else if (normalizedAddress === txTo) {
        // Receiver: positive amount
        balanceChange = Number(tx.value);
      } else {
        // Address not involved in transaction
        return { balanceChange: 0, success: true, found: false };
      }

      return {
        balanceChange,
        success: receipt.status === 1,
        found: true,
      };
    } catch (error) {
      throw new Error(`Failed to get balance change: ${error.message}`);
    }
  }
}
