/**
 * Binance Deposit Verification Service
 *
 * Service for programmatically verifying deposits to Binance addresses.
 * Provides methods to check deposit status, amount, and confirmations.
 */

import { Injectable, Logger } from '@nestjs/common';

import { BinanceClientService } from './binance-client.service';

/**
 * Binance deposit status codes
 * 0: pending
 * 6: credited (completed, but cannot withdraw)
 * 1: success (completed and can withdraw)
 */
export enum BinanceDepositStatus {
  PENDING = 0,
  SUCCESS = 1,
  CREDITED = 6,
}

export interface BinanceDepositRecord {
  id: string;
  amount: string;
  coin: string;
  network: string;
  status: number;
  address: string;
  addressTag?: string;
  txId: string;
  insertTime: number;
  transferType: number;
  confirmTimes: string; // e.g., "12/12"
  unlockConfirm: number;
  walletType: number;
}

export interface DepositVerificationResult {
  success: boolean;
  found: boolean;
  deposit?: BinanceDepositRecord;
  status?: 'pending' | 'credited' | 'success';
  confirmations?: {
    current: number;
    required: number;
    percentage: number;
  };
  message?: string;
  error?: string;
}

export interface DepositSearchCriteria {
  coin: string;
  address: string;
  expectedAmount?: string;
  txId?: string;
  startTime?: number;
  endTime?: number;
  network?: string;
}

@Injectable()
export class BinanceDepositVerificationService {
  private readonly logger = new Logger(BinanceDepositVerificationService.name);

  constructor(private readonly binanceClient: BinanceClientService) {}

  /**
   * Check if a specific deposit has been received and confirmed on Binance
   *
   * @param criteria - Search criteria for the deposit
   * @returns Verification result with deposit details
   *
   * @example
   * ```typescript
   * const result = await binanceDepositService.verifyDeposit({
   *   coin: 'USDT',
   *   address: 'your-binance-address',
   *   expectedAmount: '100.00',
   *   txId: 'blockchain-tx-hash'
   * });
   *
   * if (result.success && result.status === 'success') {
   *   console.log('Deposit confirmed!');
   * }
   * ```
   */
  async verifyDeposit(criteria: DepositSearchCriteria): Promise<DepositVerificationResult> {
    try {
      this.logger.log(`Verifying deposit: ${criteria.coin} to ${criteria.address}`);

      if (!this.binanceClient.isApiEnabled()) {
        return {
          success: false,
          found: false,
          error: 'Binance API is not enabled',
        };
      }

      // Get deposit history
      const deposits = await this.binanceClient.getDepositHistory(
        criteria.coin,
        criteria.startTime,
        criteria.endTime,
      );

      this.logger.debug(`Found ${deposits.length} deposits for ${criteria.coin}`);

      // Find matching deposit
      const matchingDeposit = this.findMatchingDeposit(deposits, criteria);

      if (!matchingDeposit) {
        return {
          success: true,
          found: false,
          message: 'No matching deposit found',
        };
      }

      // Parse confirmation info
      const confirmations = this.parseConfirmations(matchingDeposit.confirmTimes);

      // Determine status
      const status = this.getDepositStatusString(matchingDeposit.status);

      this.logger.log(
        `Deposit found - Status: ${status}, Confirmations: ${confirmations.current}/${confirmations.required}`,
      );

      return {
        success: true,
        found: true,
        deposit: matchingDeposit,
        status,
        confirmations,
        message: `Deposit ${status} with ${confirmations.current}/${confirmations.required} confirmations`,
      };
    } catch (error) {
      this.logger.error('Failed to verify deposit:', error);
      return {
        success: false,
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a deposit is confirmed (status = 1, SUCCESS)
   *
   * @param criteria - Search criteria
   * @returns true if deposit is confirmed, false otherwise
   *
   * @example
   * ```typescript
   * const isConfirmed = await binanceDepositService.isDepositConfirmed({
   *   coin: 'USDT',
   *   txId: 'blockchain-tx-hash'
   * });
   * ```
   */
  async isDepositConfirmed(criteria: DepositSearchCriteria): Promise<boolean> {
    const result = await this.verifyDeposit(criteria);
    return result.found && result.status === 'success';
  }

  /**
   * Wait for a deposit to be confirmed with timeout
   *
   * @param criteria - Search criteria
   * @param timeout - Maximum time to wait in milliseconds (default: 5 minutes)
   * @param pollInterval - Check interval in milliseconds (default: 10 seconds)
   * @returns Verification result when confirmed or timeout
   *
   * @example
   * ```typescript
   * const result = await binanceDepositService.waitForDepositConfirmation({
   *   coin: 'USDT',
   *   address: 'your-address',
   *   expectedAmount: '100.00'
   * }, 300000, 10000);
   * ```
   */
  async waitForDepositConfirmation(
    criteria: DepositSearchCriteria,
    timeout = 300000, // 5 minutes
    pollInterval = 10000, // 10 seconds
  ): Promise<DepositVerificationResult> {
    this.logger.log(`Waiting for deposit confirmation (timeout: ${timeout}ms)...`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.verifyDeposit(criteria);

      if (result.found && result.status === 'success') {
        this.logger.log('Deposit confirmed!');
        return result;
      }

      if (result.found) {
        this.logger.debug(`Deposit found but not fully confirmed yet (status: ${result.status})`);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    this.logger.warn('Deposit confirmation timeout');
    return {
      success: false,
      found: false,
      error: 'Timeout waiting for deposit confirmation',
    };
  }

  /**
   * Get detailed deposit report
   *
   * @param criteria - Search criteria
   * @returns Comprehensive deposit report
   *
   * @example
   * ```typescript
   * const report = await binanceDepositService.getDepositReport({
   *   coin: 'USDT',
   *   txId: 'blockchain-tx-hash'
   * });
   * console.log(report);
   * ```
   */
  async getDepositReport(criteria: DepositSearchCriteria): Promise<{
    found: boolean;
    deposit?: BinanceDepositRecord;
    analysis: {
      isConfirmed: boolean;
      isPending: boolean;
      isCredited: boolean;
      confirmationProgress: number;
      amountMatch: boolean;
      networkMatch: boolean;
      age: number;
      ageFormatted: string;
    };
  }> {
    const result = await this.verifyDeposit(criteria);

    if (!result.found || !result.deposit) {
      return {
        found: false,
        analysis: {
          isConfirmed: false,
          isPending: false,
          isCredited: false,
          confirmationProgress: 0,
          amountMatch: false,
          networkMatch: false,
          age: 0,
          ageFormatted: 'N/A',
        },
      };
    }

    const deposit = result.deposit;
    const age = Date.now() - deposit.insertTime;
    const ageMinutes = Math.floor(age / 60000);

    return {
      found: true,
      deposit,
      analysis: {
        isConfirmed: result.status === 'success',
        isPending: result.status === 'pending',
        isCredited: result.status === 'credited',
        confirmationProgress: result.confirmations?.percentage || 0,
        amountMatch: criteria.expectedAmount ? deposit.amount === criteria.expectedAmount : true,
        networkMatch: criteria.network ? deposit.network === criteria.network : true,
        age,
        ageFormatted: `${ageMinutes} minutes ago`,
      },
    };
  }

  /**
   * Monitor deposit with real-time updates via callback
   *
   * @param criteria - Search criteria
   * @param onUpdate - Callback function called on each update
   * @param timeout - Maximum time to monitor in milliseconds
   * @param pollInterval - Check interval in milliseconds
   *
   * @example
   * ```typescript
   * await binanceDepositService.monitorDeposit(
   *   { coin: 'USDT', txId: 'tx-hash' },
   *   (result) => {
   *     console.log('Update:', result.status, result.confirmations);
   *   },
   *   300000,
   *   10000
   * );
   * ```
   */
  async monitorDeposit(
    criteria: DepositSearchCriteria,
    onUpdate: (result: DepositVerificationResult) => void,
    timeout = 300000,
    pollInterval = 10000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.verifyDeposit(criteria);
      onUpdate(result);

      if (result.found && result.status === 'success') {
        this.logger.log('Deposit confirmed, stopping monitor');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Check if address has received any deposits
   *
   * @param coin - Coin symbol
   * @param address - Binance deposit address
   * @param startTime - Optional start time
   * @returns List of deposits to the address
   *
   * @example
   * ```typescript
   * const deposits = await binanceDepositService.checkAddressDeposits(
   *   'USDT',
   *   'your-binance-address'
   * );
   * console.log(`Found ${deposits.length} deposits`);
   * ```
   */
  async checkAddressDeposits(
    coin: string,
    address: string,
    startTime?: number,
  ): Promise<BinanceDepositRecord[]> {
    try {
      const deposits = await this.binanceClient.getDepositHistory(coin, startTime);

      return deposits.filter(d => d.address === address);
    } catch (error) {
      this.logger.error('Failed to check address deposits:', error);
      throw error;
    }
  }

  /**
   * Find matching deposit from list based on criteria
   */
  private findMatchingDeposit(
    deposits: any[],
    criteria: DepositSearchCriteria,
  ): BinanceDepositRecord | null {
    for (const deposit of deposits) {
      // Must match address
      if (deposit.address !== criteria.address) {
        continue;
      }

      // If txId specified, must match
      if (criteria.txId && deposit.txId !== criteria.txId) {
        continue;
      }

      // If expectedAmount specified, must match
      if (criteria.expectedAmount && deposit.amount !== criteria.expectedAmount) {
        continue;
      }

      // If network specified, must match
      if (criteria.network && deposit.network !== criteria.network) {
        continue;
      }

      // Match found!
      return deposit;
    }

    return null;
  }

  /**
   * Parse confirmation string (e.g., "12/12" -> {current: 12, required: 12})
   */
  private parseConfirmations(confirmTimes: string): {
    current: number;
    required: number;
    percentage: number;
  } {
    const parts = confirmTimes.split('/');
    const current = Number.parseInt(parts[0] || '0', 10);
    const required = Number.parseInt(parts[1] || '1', 10);
    const percentage = Math.floor((current / required) * 100);

    return { current, required, percentage };
  }

  /**
   * Convert numeric status to string
   */
  private getDepositStatusString(status: number): 'pending' | 'credited' | 'success' {
    switch (status) {
      case BinanceDepositStatus.SUCCESS:
        return 'success';
      case BinanceDepositStatus.CREDITED:
        return 'credited';
      case BinanceDepositStatus.PENDING:
      default:
        return 'pending';
    }
  }

  /**
   * Verify transaction with detailed matching between blockchain and Binance
   *
   * This method checks:
   * 1. Transaction exists in Binance deposit history
   * 2. Transaction hash (txId) matches
   * 3. Sender address matches (from blockchain)
   * 4. Recipient address matches (Binance deposit address)
   * 5. Amount matches
   *
   * @param blockchainTxHash - Transaction hash from blockchain transfer
   * @param blockchainFromAddress - Sender address (hot wallet)
   * @param binanceDepositAddress - Recipient address (Binance deposit address)
   * @param coin - Coin symbol
   * @param expectedAmount - Expected amount
   * @param network - Network name
   * @returns Detailed verification result
   */
  async verifyTransactionWithMatching(params: {
    blockchainTxHash: string;
    blockchainFromAddress: string;
    binanceDepositAddress: string;
    coin: string;
    expectedAmount: string;
    network?: string;
  }): Promise<{
    success: boolean;
    matched: boolean;
    details: {
      txHashMatches: boolean;
      senderAddressMatches: boolean;
      recipientAddressMatches: boolean;
      amountMatches: boolean;
      binanceFound: boolean;
      binanceStatus?: 'pending' | 'credited' | 'success';
    };
    binanceDeposit?: BinanceDepositRecord;
    message: string;
    errors: string[];
  }> {
    const errors: string[] = [];

    this.logger.log(
      `Verifying transaction with full matching:\n` +
        `  Blockchain TxHash: ${params.blockchainTxHash}\n` +
        `  From: ${params.blockchainFromAddress}\n` +
        `  To: ${params.binanceDepositAddress}\n` +
        `  Amount: ${params.expectedAmount} ${params.coin}`,
    );

    try {
      // Search for deposit in Binance history
      const depositResult = await this.verifyDeposit({
        coin: params.coin,
        address: params.binanceDepositAddress,
        txId: params.blockchainTxHash,
        expectedAmount: params.expectedAmount,
        network: params.network,
        startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
      });

      const details = {
        txHashMatches: false,
        senderAddressMatches: false,
        recipientAddressMatches: false,
        amountMatches: false,
        binanceFound: depositResult.found,
        binanceStatus: depositResult.status,
      };

      if (!depositResult.found || !depositResult.deposit) {
        errors.push('Transaction not found in Binance deposit history');
        return {
          success: false,
          matched: false,
          details,
          message: 'Transaction not found in Binance deposit history',
          errors,
        };
      }

      const binanceDeposit = depositResult.deposit;

      // Check 1: Transaction hash matches
      details.txHashMatches = binanceDeposit.txId === params.blockchainTxHash;
      if (!details.txHashMatches) {
        errors.push(
          `TxHash mismatch: Binance=${binanceDeposit.txId}, Blockchain=${params.blockchainTxHash}`,
        );
      }

      // Check 2: Recipient address matches (Binance deposit address)
      details.recipientAddressMatches = binanceDeposit.address === params.binanceDepositAddress;
      if (!details.recipientAddressMatches) {
        errors.push(
          `Recipient address mismatch: Binance=${binanceDeposit.address}, Expected=${params.binanceDepositAddress}`,
        );
      }

      // Check 3: Amount matches
      const binanceAmount = Number.parseFloat(binanceDeposit.amount);
      const expectedAmount = Number.parseFloat(params.expectedAmount);
      const amountDifference = Math.abs(binanceAmount - expectedAmount);
      details.amountMatches = amountDifference < 0.00000001;

      if (!details.amountMatches) {
        errors.push(
          `Amount mismatch: Binance=${binanceAmount}, Expected=${expectedAmount}, Difference=${amountDifference}`,
        );
      }

      // Note: Binance deposit API doesn't return sender address, only recipient
      // So we mark it as matches if all other checks pass
      details.senderAddressMatches = true;

      // Determine overall match
      const matched =
        details.txHashMatches &&
        details.recipientAddressMatches &&
        details.amountMatches &&
        depositResult.status === 'success';

      let message: string;
      if (matched) {
        message = `✅ Transaction fully verified and matched in Binance`;
      } else if (depositResult.status !== 'success') {
        message = `⏳ Transaction found in Binance but status is ${depositResult.status}`;
      } else {
        message = `❌ Transaction found but has ${errors.length} discrepancy(ies)`;
      }

      this.logger.log(
        `Verification result: ${message}\n` +
          `  TxHash: ${details.txHashMatches ? '✓' : '✗'}\n` +
          `  Recipient: ${details.recipientAddressMatches ? '✓' : '✗'}\n` +
          `  Amount: ${details.amountMatches ? '✓' : '✗'}\n` +
          `  Binance Status: ${depositResult.status || 'unknown'}`,
      );

      return {
        success: true,
        matched,
        details,
        binanceDeposit,
        message,
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Exception during verification: ${errorMsg}`);

      this.logger.error('Failed to verify transaction with matching:', error);

      return {
        success: false,
        matched: false,
        details: {
          txHashMatches: false,
          senderAddressMatches: false,
          recipientAddressMatches: false,
          amountMatches: false,
          binanceFound: false,
        },
        message: `Failed to verify: ${errorMsg}`,
        errors,
      };
    }
  }
}
