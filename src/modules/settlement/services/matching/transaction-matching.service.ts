/**
 * Transaction Matching Service
 *
 * Verifies that transactions exist and match on both Binance (centralized exchange)
 * and blockchain (Solana, Ethereum, etc.). This ensures settlement integrity by
 * cross-referencing transaction hashes from both sources.
 *
 * Use Cases:
 * 1. Verify Binance withdrawal appears on blockchain
 * 2. Verify blockchain deposit appears on Binance
 * 3. Match transaction amounts and addresses between systems
 * 4. Detect discrepancies for reconciliation
 */

import type { BinanceWithdrawalResult } from '../binance/binance-client.service';
import type { BinanceDepositRecord } from '../binance/binance-deposit-verification.service';
import type { SettlementBlockchainService } from '../blockchain/wallet.abstract';

import { Injectable, Logger } from '@nestjs/common';

import { BinanceClientService } from '../binance/binance-client.service';
import { BinanceDepositVerificationService } from '../binance/binance-deposit-verification.service';

/**
 * Result of transaction matching between Binance and blockchain
 */
export interface TransactionMatchResult {
  success: boolean;
  matched: boolean;
  txHash: string;
  blockchain: string;

  binanceData?: {
    found: boolean;
    type: 'deposit' | 'withdrawal';
    amount: string;
    coin: string;
    address: string;
    network: string;
    status: string;
    confirmations?: string;
    record?: BinanceDepositRecord | BinanceWithdrawalResult;
  };

  blockchainData?: {
    found: boolean;
    confirmed: boolean;
    success: boolean;
    amount?: string;
    from?: string;
    to?: string;
    blockTime?: number;
    slot?: number;
    details?: any;
  };

  amountMatch?: boolean;
  addressMatch?: boolean;
  discrepancies?: string[];
  message?: string;
  error?: string;
}

/**
 * Criteria for matching a deposit transaction
 */
export interface DepositMatchCriteria {
  txHash: string;
  blockchain: string;
  coin: string;
  expectedAddress: string;
  expectedAmount?: string;
  network?: string;
  startTime?: number;
  endTime?: number;
}

/**
 * Criteria for matching a withdrawal transaction
 */
export interface WithdrawalMatchCriteria {
  withdrawalId?: string;
  txHash?: string;
  blockchain: string;
  coin: string;
  expectedAddress: string;
  expectedAmount?: string;
  network?: string;
  startTime?: number;
  endTime?: number;
}

@Injectable()
export class TransactionMatchingService {
  private readonly logger = new Logger(TransactionMatchingService.name);

  constructor(
    private readonly binanceClient: BinanceClientService,
    private readonly binanceDepositService: BinanceDepositVerificationService,
  ) {}

  /**
   * Match a deposit transaction between Binance and blockchain
   *
   * Verifies that a blockchain transaction (identified by txHash) appears
   * in Binance's deposit records with matching amount and address.
   *
   * @param criteria - Deposit matching criteria
   * @param blockchainService - The blockchain service (e.g., SolService, EthService)
   * @returns Match result with details from both systems
   *
   * @example
   * ```typescript
   * const result = await transactionMatching.matchDeposit({
   *   txHash: '5x7...abc',
   *   blockchain: 'solana:5eykt4...',
   *   coin: 'SOL',
   *   expectedAddress: 'binance-deposit-address',
   *   expectedAmount: '10.5'
   * }, solService);
   *
   * if (result.matched) {
   *   console.log('Transaction verified on both systems!');
   * }
   * ```
   */
  async matchDeposit(
    criteria: DepositMatchCriteria,
    blockchainService: SettlementBlockchainService,
  ): Promise<TransactionMatchResult> {
    this.logger.log(`Matching deposit transaction: ${criteria.txHash} on ${criteria.blockchain}`);

    const result: TransactionMatchResult = {
      success: false,
      matched: false,
      txHash: criteria.txHash,
      blockchain: criteria.blockchain,
      discrepancies: [],
    };

    try {
      // 1. Check blockchain transaction
      this.logger.debug('Checking blockchain transaction...');
      const blockchainTx = await blockchainService.getTransactionForMatching(criteria.txHash);

      result.blockchainData = {
        found: blockchainTx.found,
        confirmed: blockchainTx.confirmed,
        success: blockchainTx.success,
        amount: blockchainTx.amount,
        from: blockchainTx.from,
        to: blockchainTx.to,
        blockTime: blockchainTx.blockTime,
        slot: blockchainTx.slot,
        details: blockchainTx,
      };

      if (!blockchainTx.found) {
        result.error = 'Transaction not found on blockchain';
        result.message = `Transaction ${criteria.txHash} does not exist on ${criteria.blockchain}`;
        return result;
      }

      if (!blockchainTx.confirmed) {
        result.error = 'Transaction not confirmed on blockchain';
        result.message = `Transaction ${criteria.txHash} is not yet confirmed`;
        return result;
      }

      // 2. Check Binance deposit records
      this.logger.debug('Checking Binance deposit records...');
      const binanceResult = await this.binanceDepositService.verifyDeposit({
        coin: criteria.coin,
        address: criteria.expectedAddress,
        txId: criteria.txHash,
        expectedAmount: criteria.expectedAmount,
        network: criteria.network,
        startTime: criteria.startTime,
        endTime: criteria.endTime,
      });

      result.binanceData = {
        found: binanceResult.found,
        type: 'deposit',
        amount: binanceResult.deposit?.amount || '0',
        coin: criteria.coin,
        address: criteria.expectedAddress,
        network: binanceResult.deposit?.network || criteria.network || 'unknown',
        status: binanceResult.status || 'unknown',
        confirmations: binanceResult.deposit?.confirmTimes,
        record: binanceResult.deposit,
      };

      if (!binanceResult.found) {
        result.error = 'Deposit not found on Binance';
        result.message = `Deposit with txId ${criteria.txHash} not found in Binance records`;
        return result;
      }

      // 3. Compare amounts
      if (criteria.expectedAmount) {
        const binanceAmount = Number.parseFloat(binanceResult.deposit?.amount || '0');
        const expectedAmount = Number.parseFloat(criteria.expectedAmount);

        result.amountMatch = Math.abs(binanceAmount - expectedAmount) < 0.00000001;

        if (!result.amountMatch) {
          result.discrepancies?.push(
            `Amount mismatch: Binance=${binanceAmount}, Expected=${expectedAmount}`,
          );
        }
      }

      // 4. Compare addresses
      result.addressMatch = binanceResult.deposit?.address === criteria.expectedAddress;
      if (!result.addressMatch) {
        result.discrepancies?.push(
          `Address mismatch: Binance=${binanceResult.deposit?.address}, Expected=${criteria.expectedAddress}`,
        );
      }

      // 5. Determine overall match
      result.matched =
        binanceResult.found &&
        blockchainTx.confirmed &&
        blockchainTx.success &&
        result.amountMatch !== false &&
        result.addressMatch;

      result.success = true;
      result.message = result.matched
        ? 'Transaction matched successfully on both Binance and blockchain'
        : `Transaction found but has discrepancies: ${result.discrepancies?.join(', ')}`;

      return result;
    } catch (error) {
      this.logger.error(`Error matching deposit transaction: ${error.message}`, error.stack);
      result.error = error.message;
      result.message = `Failed to match transaction: ${error.message}`;
      return result;
    }
  }

  /**
   * Match a withdrawal transaction between Binance and blockchain
   *
   * Verifies that a Binance withdrawal appears on the blockchain with
   * matching amount and destination address.
   *
   * @param criteria - Withdrawal matching criteria
   * @param blockchainService - The blockchain service (e.g., SolService, EthService)
   * @returns Match result with details from both systems
   *
   * @example
   * ```typescript
   * const result = await transactionMatching.matchWithdrawal({
   *   withdrawalId: 'binance-withdrawal-id',
   *   blockchain: 'solana:5eykt4...',
   *   coin: 'SOL',
   *   expectedAddress: 'destination-wallet-address',
   *   expectedAmount: '5.25'
   * }, solService);
   *
   * if (result.matched) {
   *   console.log('Withdrawal verified on blockchain!');
   * }
   * ```
   */
  async matchWithdrawal(
    criteria: WithdrawalMatchCriteria,
    blockchainService: SettlementBlockchainService,
  ): Promise<TransactionMatchResult> {
    this.logger.log(
      `Matching withdrawal transaction: ${criteria.withdrawalId || criteria.txHash} on ${criteria.blockchain}`,
    );

    const result: TransactionMatchResult = {
      success: false,
      matched: false,
      txHash: criteria.txHash || 'unknown',
      blockchain: criteria.blockchain,
      discrepancies: [],
    };

    try {
      // 1. Get Binance withdrawal record
      this.logger.debug('Fetching Binance withdrawal record...');
      const withdrawalHistory = await this.binanceClient.getWithdrawalHistory(
        criteria.coin,
        criteria.startTime,
        criteria.endTime,
      );

      let withdrawal: any = null;

      if (criteria.withdrawalId) {
        withdrawal = withdrawalHistory.find((w: any) => w.id === criteria.withdrawalId);
      } else if (criteria.txHash) {
        withdrawal = withdrawalHistory.find((w: any) => w.txId === criteria.txHash);
      }

      if (!withdrawal) {
        result.error = 'Withdrawal not found on Binance';
        result.message = `Withdrawal ${criteria.withdrawalId || criteria.txHash} not found in Binance records`;
        return result;
      }

      result.txHash = withdrawal.txId || criteria.txHash || 'unknown';

      result.binanceData = {
        found: true,
        type: 'withdrawal',
        amount: withdrawal.amount,
        coin: withdrawal.coin,
        address: withdrawal.address,
        network: withdrawal.network || criteria.network || 'unknown',
        status: this.getWithdrawalStatusText(withdrawal.status),
        record: withdrawal,
      };

      // 2. Check if withdrawal has blockchain txId
      if (!withdrawal.txId) {
        result.error = 'Withdrawal does not have blockchain transaction hash yet';
        result.message = 'Withdrawal is still pending blockchain broadcast';
        return result;
      }

      // 3. Check blockchain transaction
      this.logger.debug(`Checking blockchain transaction: ${withdrawal.txId}...`);
      const blockchainTx = await blockchainService.getTransactionForMatching(withdrawal.txId);

      result.blockchainData = {
        found: blockchainTx.found,
        confirmed: blockchainTx.confirmed,
        success: blockchainTx.success,
        amount: blockchainTx.amount,
        from: blockchainTx.from,
        to: blockchainTx.to,
        blockTime: blockchainTx.blockTime,
        slot: blockchainTx.slot,
        details: blockchainTx,
      };

      if (!blockchainTx.found) {
        result.error = 'Transaction not found on blockchain';
        result.message = `Transaction ${withdrawal.txId} does not exist on ${criteria.blockchain}`;
        return result;
      }

      // 4. Compare amounts (accounting for network fees)
      if (criteria.expectedAmount && blockchainTx.amount) {
        const blockchainAmount = Number.parseFloat(blockchainTx.amount);
        const expectedAmount = Number.parseFloat(criteria.expectedAmount);

        // Allow for small fee discrepancies (within 1%)
        const percentDiff = Math.abs((blockchainAmount - expectedAmount) / expectedAmount) * 100;
        result.amountMatch = percentDiff < 1;

        if (!result.amountMatch) {
          result.discrepancies?.push(
            `Amount mismatch: Blockchain=${blockchainAmount}, Expected=${expectedAmount} (${percentDiff.toFixed(2)}% difference)`,
          );
        }
      }

      // 5. Compare destination addresses
      result.addressMatch = blockchainTx.to === criteria.expectedAddress;
      if (!result.addressMatch) {
        result.discrepancies?.push(
          `Address mismatch: Blockchain=${blockchainTx.to}, Expected=${criteria.expectedAddress}`,
        );
      }

      // 6. Determine overall match
      result.matched =
        blockchainTx.confirmed &&
        blockchainTx.success &&
        result.amountMatch !== false &&
        result.addressMatch;

      result.success = true;
      result.message = result.matched
        ? 'Withdrawal matched successfully on both Binance and blockchain'
        : `Withdrawal found but has discrepancies: ${result.discrepancies?.join(', ')}`;

      return result;
    } catch (error) {
      this.logger.error(`Error matching withdrawal transaction: ${error.message}`, error.stack);
      result.error = error.message;
      result.message = `Failed to match withdrawal: ${error.message}`;
      return result;
    }
  }

  /**
   * Wait for a deposit to appear and match on both systems
   *
   * @param criteria - Deposit matching criteria
   * @param blockchainService - Blockchain service
   * @param timeout - Maximum wait time in milliseconds (default: 5 minutes)
   * @param pollInterval - Check interval in milliseconds (default: 10 seconds)
   * @returns Match result when found or timeout
   */
  async waitForDepositMatch(
    criteria: DepositMatchCriteria,
    blockchainService: SettlementBlockchainService,
    timeout = 300000, // 5 minutes
    pollInterval = 10000, // 10 seconds
  ): Promise<TransactionMatchResult> {
    this.logger.log(`Waiting for deposit match: ${criteria.txHash} (timeout: ${timeout}ms)...`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.matchDeposit(criteria, blockchainService);

      if (result.matched) {
        this.logger.log('Deposit matched successfully!');
        return result;
      }

      if (result.success) {
        this.logger.debug(
          `Deposit found but not fully matched yet: ${result.discrepancies?.join(', ')}`,
        );
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    this.logger.warn('Deposit match timeout');
    return {
      success: false,
      matched: false,
      txHash: criteria.txHash,
      blockchain: criteria.blockchain,
      error: 'Timeout waiting for deposit to match on both systems',
    };
  }

  /**
   * Wait for a withdrawal to appear and match on both systems
   *
   * @param criteria - Withdrawal matching criteria
   * @param blockchainService - Blockchain service
   * @param timeout - Maximum wait time in milliseconds (default: 10 minutes)
   * @param pollInterval - Check interval in milliseconds (default: 15 seconds)
   * @returns Match result when found or timeout
   */
  async waitForWithdrawalMatch(
    criteria: WithdrawalMatchCriteria,
    blockchainService: SettlementBlockchainService,
    timeout = 600000, // 10 minutes
    pollInterval = 15000, // 15 seconds
  ): Promise<TransactionMatchResult> {
    this.logger.log(
      `Waiting for withdrawal match: ${criteria.withdrawalId || criteria.txHash} (timeout: ${timeout}ms)...`,
    );

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.matchWithdrawal(criteria, blockchainService);

      if (result.matched) {
        this.logger.log('Withdrawal matched successfully!');
        return result;
      }

      if (result.success) {
        this.logger.debug(
          `Withdrawal found but not fully matched yet: ${result.discrepancies?.join(', ')}`,
        );
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    this.logger.warn('Withdrawal match timeout');
    return {
      success: false,
      matched: false,
      txHash: criteria.txHash || 'unknown',
      blockchain: criteria.blockchain,
      error: 'Timeout waiting for withdrawal to match on both systems',
    };
  }

  /**
   * Get human-readable withdrawal status text
   */
  private getWithdrawalStatusText(status: number): string {
    const statusMap: Record<number, string> = {
      0: 'pending',
      1: 'cancelled',
      2: 'awaiting_approval',
      3: 'rejected',
      4: 'processing',
      5: 'failure',
      6: 'completed',
    };
    return statusMap[status] || `unknown(${status})`;
  }

  /**
   * Batch match multiple deposits
   *
   * @param criteriaList - Array of deposit matching criteria
   * @param blockchainService - Blockchain service
   * @returns Array of match results
   */
  async batchMatchDeposits(
    criteriaList: DepositMatchCriteria[],
    blockchainService: SettlementBlockchainService,
  ): Promise<TransactionMatchResult[]> {
    this.logger.log(`Batch matching ${criteriaList.length} deposits...`);

    const results = await Promise.all(
      criteriaList.map(criteria => this.matchDeposit(criteria, blockchainService)),
    );

    const matched = results.filter(r => r.matched).length;
    this.logger.log(`Batch match complete: ${matched}/${criteriaList.length} matched`);

    return results;
  }

  /**
   * Batch match multiple withdrawals
   *
   * @param criteriaList - Array of withdrawal matching criteria
   * @param blockchainService - Blockchain service
   * @returns Array of match results
   */
  async batchMatchWithdrawals(
    criteriaList: WithdrawalMatchCriteria[],
    blockchainService: SettlementBlockchainService,
  ): Promise<TransactionMatchResult[]> {
    this.logger.log(`Batch matching ${criteriaList.length} withdrawals...`);

    const results = await Promise.all(
      criteriaList.map(criteria => this.matchWithdrawal(criteria, blockchainService)),
    );

    const matched = results.filter(r => r.matched).length;
    this.logger.log(`Batch match complete: ${matched}/${criteriaList.length} matched`);

    return results;
  }
}
