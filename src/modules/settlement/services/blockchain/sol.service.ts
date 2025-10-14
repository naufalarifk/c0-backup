import { Injectable } from '@nestjs/common';

import { Connection, PublicKey } from '@solana/web3.js';

import { WalletFactory } from '../../../../shared/wallets/wallet.factory';
import { SettlementBlockchainService } from './wallet.abstract';
import { SettlementWalletService } from './wallet.service';

// Solana blockchain keys (CAIP-2 format)
const SOLANA_MAINNET_KEY = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_TESTNET_KEY = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';
const SOLANA_DEVNET_KEY = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

// Use devnet/testnet for testing, mainnet for production
const SOLANA_BLOCKCHAIN_KEY =
  process.env.SOLANA_USE_DEVNET === 'true'
    ? SOLANA_DEVNET_KEY
    : process.env.SOLANA_USE_TESTNET === 'true'
      ? SOLANA_TESTNET_KEY
      : SOLANA_MAINNET_KEY;

/**
 * Solana Settlement Service
 *
 * Implements settlement operations for Solana blockchain.
 * Extends SettlementBlockchainService to provide Solana-specific implementations
 * of balance queries, transaction verification, and network management.
 *
 * Supports multiple networks: mainnet, testnet, devnet
 * Configured via environment variables:
 * - SOLANA_USE_DEVNET=true -> devnet
 * - SOLANA_USE_TESTNET=true -> testnet
 * - default -> mainnet
 */
@Injectable()
export class SolService extends SettlementBlockchainService {
  private _connection?: Connection;
  protected get connection(): Connection {
    if (!this._connection) {
      // Auto-detect RPC URL based on blockchain key if not explicitly set
      let rpcUrl = process.env.SOLANA_RPC_URL;
      if (!rpcUrl) {
        if (SOLANA_BLOCKCHAIN_KEY === SOLANA_DEVNET_KEY) {
          rpcUrl = 'https://api.devnet.solana.com';
        } else if (SOLANA_BLOCKCHAIN_KEY === SOLANA_TESTNET_KEY) {
          rpcUrl = 'https://api.testnet.solana.com';
        } else {
          rpcUrl = 'https://api.mainnet-beta.solana.com';
        }
      }
      this._connection = new Connection(rpcUrl);
    }
    return this._connection;
  }

  constructor(
    private readonly walletFactory: WalletFactory,
    private readonly walletService: SettlementWalletService,
  ) {
    super();
  }

  /**
   * Get Solana hot wallet balance
   * Uses the same approach as solana-balance.collector.ts line 82-88
   */
  async getBalance(): Promise<number> {
    // Get hot wallet using WalletFactory.getBlockchain() - same as solana-balance.collector.ts
    const blockchain = this.walletFactory.getBlockchain(SOLANA_BLOCKCHAIN_KEY);
    if (!blockchain) {
      throw new Error(`Unsupported blockchain: ${SOLANA_BLOCKCHAIN_KEY}`);
    }
    const hotWallet = await blockchain.getHotWallet();
    const address = await hotWallet.getAddress();

    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return balance;
  }

  /**
   * Get the current Solana blockchain key being used (mainnet, testnet, or devnet)
   */
  getBlockchainKey(): string {
    return SOLANA_BLOCKCHAIN_KEY;
  }

  /**
   * Get the current network name based on blockchain key
   */
  getNetworkName(): 'mainnet' | 'testnet' | 'devnet' {
    if (SOLANA_BLOCKCHAIN_KEY === SOLANA_DEVNET_KEY) {
      return 'devnet';
    } else if (SOLANA_BLOCKCHAIN_KEY === SOLANA_TESTNET_KEY) {
      return 'testnet';
    } else {
      return 'mainnet';
    }
  }

  /**
   * Get the current RPC URL being used
   */
  getRpcUrl(): string {
    return this.connection.rpcEndpoint;
  }

  /**
   * Check if a transaction was successful by signature
   * @param signature - Transaction signature to check
   * @returns Transaction confirmation status and details
   */
  async getTransactionStatus(signature: string): Promise<{
    confirmed: boolean;
    success: boolean;
    slot?: number;
    blockTime?: number;
    err?: any;
    confirmations?: number | null;
  }> {
    try {
      // Get transaction confirmation status
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      if (!status || !status.value) {
        return {
          confirmed: false,
          success: false,
        };
      }

      const confirmationStatus = status.value.confirmationStatus;
      const isConfirmed = confirmationStatus === 'confirmed' || confirmationStatus === 'finalized';

      return {
        confirmed: isConfirmed,
        success: isConfirmed && status.value.err === null,
        slot: status.value.slot,
        confirmations: status.value.confirmations,
        err: status.value.err,
      };
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  /**
   * Get detailed transaction information
   * @param signature - Transaction signature
   * @returns Full transaction details including accounts, amounts, and fees
   */
  async getTransactionDetails(signature: string): Promise<{
    success: boolean;
    blockTime?: number;
    slot?: number;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    accountKeys?: string[];
    err?: any;
    meta?: any;
  }> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        return {
          success: false,
        };
      }

      return {
        success: transaction.meta?.err === null,
        blockTime: transaction.blockTime || undefined,
        slot: transaction.slot,
        fee: transaction.meta?.fee,
        preBalances: transaction.meta?.preBalances,
        postBalances: transaction.meta?.postBalances,
        accountKeys: transaction.transaction.message.staticAccountKeys.map(key => key.toString()),
        err: transaction.meta?.err,
        meta: transaction.meta,
      };
    } catch (error) {
      throw new Error(`Failed to get transaction details: ${error.message}`);
    }
  }

  /**
   * Wait for transaction confirmation with timeout
   * @param signature - Transaction signature to wait for
   * @param commitment - Confirmation level ('processed', 'confirmed', 'finalized')
   * @param timeoutSeconds - Maximum time to wait
   * @returns Confirmation status
   */
  async waitForConfirmation(
    signature: string,
    commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
    timeoutSeconds: number = 30,
  ): Promise<{
    confirmed: boolean;
    success: boolean;
    slot?: number;
    err?: any;
  }> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.getTransactionStatus(signature);

        if (status.confirmed) {
          return status;
        }

        // Wait 500ms before next check
        await new Promise(resolve => setTimeout(resolve, 500));
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
   * @param signature - Transaction signature
   * @param expectedFrom - Expected sender address
   * @param expectedTo - Expected recipient address
   * @param expectedAmount - Expected amount in lamports
   * @returns Verification result with details
   */
  async verifyTransfer(
    signature: string,
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
      // Get transaction details
      const txDetails = await this.getTransactionDetails(signature);

      if (!txDetails.success) {
        errors.push('Transaction failed or not found');
        return { verified: false, success: false, errors };
      }

      // Verify accounts
      if (!txDetails.accountKeys || txDetails.accountKeys.length < 2) {
        errors.push('Invalid transaction structure');
        return { verified: false, success: true, errors };
      }

      const actualFrom = txDetails.accountKeys[0];
      const actualTo = txDetails.accountKeys[1];

      if (actualFrom !== expectedFrom) {
        errors.push(`From address mismatch: expected ${expectedFrom}, got ${actualFrom}`);
      }

      if (actualTo !== expectedTo) {
        errors.push(`To address mismatch: expected ${expectedTo}, got ${actualTo}`);
      }

      // Calculate actual transfer amount
      if (txDetails.preBalances && txDetails.postBalances) {
        // Sender balance change (index 0)
        const senderBalanceChange =
          txDetails.postBalances[0] - txDetails.preBalances[0] + (txDetails.fee || 0);

        const actualAmount = Math.abs(senderBalanceChange);

        // Allow small difference due to fees
        const tolerance = 10000; // 0.00001 SOL tolerance
        if (Math.abs(actualAmount - expectedAmount) > tolerance) {
          errors.push(
            `Amount mismatch: expected ${expectedAmount} lamports, got ${actualAmount} lamports`,
          );
        }

        return {
          verified: errors.length === 0,
          success: true,
          actualAmount,
          fee: txDetails.fee,
          from: actualFrom,
          to: actualTo,
          errors: errors.length > 0 ? errors : undefined,
        };
      }

      errors.push('Could not verify transfer amounts');
      return { verified: false, success: true, errors };
    } catch (error) {
      errors.push(`Verification failed: ${error.message}`);
      return { verified: false, success: false, errors };
    }
  }

  /**
   * Get comprehensive transaction information for settlement matching
   * This is a higher-level method that provides all details needed for
   * cross-platform transaction matching (e.g., Binance vs blockchain).
   *
   * @param signature - Transaction signature
   * @returns Comprehensive transaction info including confirmation, amounts, addresses
   */
  async getTransactionForMatching(signature: string): Promise<{
    found: boolean;
    confirmed: boolean;
    success: boolean;
    amount?: string;
    from?: string;
    to?: string;
    fee?: string;
    blockTime?: number;
    slot?: number;
    confirmations?: number;
    raw?: any;
  }> {
    try {
      // Get transaction status first
      const status = await this.getTransactionStatus(signature);
      const details = await this.getTransactionDetails(signature);

      if (!details || !details.success) {
        return {
          found: false,
          confirmed: false,
          success: false,
        };
      }

      // Extract from/to addresses
      const from = details.accountKeys?.[0];
      const to = details.accountKeys?.[1];

      // Calculate transfer amount (from sender's balance change minus fee)
      let amount: string | undefined;
      if (details.preBalances && details.postBalances && details.preBalances.length > 0) {
        const senderBalanceChange = details.preBalances[0] - details.postBalances[0];
        const transferAmount = senderBalanceChange - (details.fee || 0);
        amount = (transferAmount / 1e9).toString(); // Convert lamports to SOL
      }

      return {
        found: true,
        confirmed: status.confirmed,
        success: details.success,
        amount,
        from,
        to,
        fee: details.fee ? (details.fee / 1e9).toString() : undefined,
        blockTime: details.blockTime,
        slot: details.slot,
        confirmations: status.confirmations ?? undefined,
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
   * @param address - Solana address to check
   * @returns Balance in lamports
   */
  async getAddressBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      return await this.connection.getBalance(publicKey);
    } catch (error) {
      throw new Error(`Failed to get balance for ${address}: ${error.message}`);
    }
  }

  /**
   * Check if an address received funds in a specific transaction
   * @param signature - Transaction signature
   * @param address - Address to check
   * @returns Amount received (negative if sent) and transaction details
   */
  async getAddressBalanceChange(
    signature: string,
    address: string,
  ): Promise<{
    balanceChange: number;
    success: boolean;
    found: boolean;
  }> {
    try {
      const txDetails = await this.getTransactionDetails(signature);

      if (!txDetails.success || !txDetails.accountKeys) {
        return { balanceChange: 0, success: false, found: false };
      }

      const addressIndex = txDetails.accountKeys.indexOf(address);
      if (addressIndex === -1) {
        return { balanceChange: 0, success: true, found: false };
      }

      if (txDetails.preBalances && txDetails.postBalances) {
        const balanceChange =
          txDetails.postBalances[addressIndex] - txDetails.preBalances[addressIndex];
        return { balanceChange, success: true, found: true };
      }

      return { balanceChange: 0, success: true, found: false };
    } catch (error) {
      throw new Error(`Failed to get balance change: ${error.message}`);
    }
  }
}
