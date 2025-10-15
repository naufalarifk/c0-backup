import { Injectable, Logger } from '@nestjs/common';

import { SolService } from '../blockchain/sol.service';

export interface TransactionVerificationResult {
  signature: string;
  confirmed: boolean;
  success: boolean;
  verified: boolean;
  details: {
    from?: string;
    to?: string;
    amount?: number;
    fee?: number;
    blockTime?: number;
    slot?: number;
  };
  errors?: string[];
  timestamp: Date;
}

export interface TransferValidation {
  signature: string;
  expectedFrom: string;
  expectedTo: string;
  expectedAmount: string; // in SOL
  currency: 'SOL';
}

@Injectable()
export class SettlementTransactionService {
  private readonly logger = new Logger(SettlementTransactionService.name);

  constructor(private readonly solService: SolService) {}

  /**
   * Verify a SOL transfer transaction end-to-end
   * This is the main method you should use to check if a transfer was successful
   *
   * @param validation - Transfer details to validate
   * @param waitForConfirmation - Whether to wait for confirmation (default: true)
   * @param timeoutSeconds - Maximum time to wait for confirmation (default: 30)
   * @returns Complete verification result
   *
   * @example
   * ```typescript
   * const result = await settlementTransactionService.verifyTransfer({
   *   signature: '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ',
   *   expectedFrom: '815tYsAwUqZSDWPfrpYW5Cc4d8BhAib9YPxcUm3AyXHW',
   *   expectedTo: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
   *   expectedAmount: '0.1',
   *   currency: 'SOL'
   * });
   *
   * if (result.verified && result.success) {
   *   console.log('✅ Transfer successful!');
   *   console.log(`Amount: ${result.details.amount} lamports`);
   *   console.log(`Fee: ${result.details.fee} lamports`);
   * } else {
   *   console.log('❌ Transfer failed:', result.errors);
   * }
   * ```
   */
  async verifyTransfer(
    validation: TransferValidation,
    waitForConfirmation: boolean = true,
    timeoutSeconds: number = 30,
  ): Promise<TransactionVerificationResult> {
    const startTime = Date.now();

    this.logger.log(`Verifying transfer: ${validation.signature}`);
    this.logger.debug(`From: ${validation.expectedFrom}`);
    this.logger.debug(`To: ${validation.expectedTo}`);
    this.logger.debug(`Amount: ${validation.expectedAmount} SOL`);

    try {
      // Step 1: Wait for confirmation if requested
      if (waitForConfirmation) {
        this.logger.debug(`Waiting for confirmation (timeout: ${timeoutSeconds}s)...`);

        const confirmation = await this.solService.waitForConfirmation(
          validation.signature,
          'confirmed',
          timeoutSeconds,
        );

        if (!confirmation.confirmed) {
          this.logger.warn(`Transaction not confirmed: ${validation.signature}`);
          return {
            signature: validation.signature,
            confirmed: false,
            success: false,
            verified: false,
            details: {},
            errors: ['Transaction not confirmed within timeout period'],
            timestamp: new Date(),
          };
        }

        if (!confirmation.success) {
          this.logger.error(`Transaction failed: ${validation.signature}`, confirmation.err);
          return {
            signature: validation.signature,
            confirmed: true,
            success: false,
            verified: false,
            details: {
              slot: confirmation.slot,
            },
            errors: [`Transaction failed: ${JSON.stringify(confirmation.err)}`],
            timestamp: new Date(),
          };
        }

        this.logger.log(`✅ Transaction confirmed in slot ${confirmation.slot}`);
      }

      // Step 2: Get transaction details
      const txDetails = await this.solService.getTransactionDetails(validation.signature);

      if (!txDetails.success) {
        this.logger.error(`Failed to retrieve transaction details: ${validation.signature}`);
        return {
          signature: validation.signature,
          confirmed: false,
          success: false,
          verified: false,
          details: {},
          errors: ['Failed to retrieve transaction details'],
          timestamp: new Date(),
        };
      }

      // Step 3: Verify transfer details
      const expectedAmountLamports = Math.floor(
        Number.parseFloat(validation.expectedAmount) * 1_000_000_000,
      );

      const verificationResult = await this.solService.verifyTransfer(
        validation.signature,
        validation.expectedFrom,
        validation.expectedTo,
        expectedAmountLamports,
      );

      const duration = Date.now() - startTime;
      this.logger.log(`Verification completed in ${duration}ms`);

      if (verificationResult.verified) {
        this.logger.log(`✅ Transfer verified successfully`);
        this.logger.log(`   From: ${verificationResult.from}`);
        this.logger.log(`   To: ${verificationResult.to}`);
        this.logger.log(
          `   Amount: ${verificationResult.actualAmount} lamports (${(verificationResult.actualAmount! / 1_000_000_000).toFixed(9)} SOL)`,
        );
        this.logger.log(
          `   Fee: ${verificationResult.fee} lamports (${(verificationResult.fee! / 1_000_000_000).toFixed(9)} SOL)`,
        );
      } else {
        this.logger.warn(
          `⚠️ Transfer verification failed: ${verificationResult.errors?.join(', ')}`,
        );
      }

      return {
        signature: validation.signature,
        confirmed: true,
        success: verificationResult.success,
        verified: verificationResult.verified,
        details: {
          from: verificationResult.from,
          to: verificationResult.to,
          amount: verificationResult.actualAmount,
          fee: verificationResult.fee,
          blockTime: txDetails.blockTime,
          slot: txDetails.slot,
        },
        errors: verificationResult.errors,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error verifying transfer: ${error.message}`, error.stack);
      return {
        signature: validation.signature,
        confirmed: false,
        success: false,
        verified: false,
        details: {},
        errors: [`Verification error: ${error.message}`],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Quick check if a transaction is confirmed and successful
   * Use this for fast status checks without full verification
   *
   * @param signature - Transaction signature
   * @returns Simple boolean result
   *
   * @example
   * ```typescript
   * const isSuccessful = await settlementTransactionService.isTransactionSuccessful(
   *   '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ'
   * );
   * ```
   */
  async isTransactionSuccessful(signature: string): Promise<boolean> {
    try {
      const status = await this.solService.getTransactionStatus(signature);
      return status.confirmed && status.success;
    } catch (error) {
      this.logger.error(`Error checking transaction status: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a specific address received funds in a transaction
   * Useful for verifying Binance deposits
   *
   * @param signature - Transaction signature
   * @param address - Address to check
   * @returns Amount received (in lamports) or null if not found
   *
   * @example
   * ```typescript
   * const received = await settlementTransactionService.checkAddressReceived(
   *   '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ',
   *   '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
   * );
   *
   * if (received && received > 0) {
   *   console.log(`Address received ${received / 1_000_000_000} SOL`);
   * }
   * ```
   */
  async checkAddressReceived(signature: string, address: string): Promise<number | null> {
    try {
      const result = await this.solService.getAddressBalanceChange(signature, address);

      if (!result.success || !result.found) {
        return null;
      }

      return result.balanceChange;
    } catch (error) {
      this.logger.error(`Error checking address balance change: ${error.message}`);
      return null;
    }
  }

  /**
   * Monitor a transaction until it's confirmed or times out
   * Returns updates via callback
   *
   * @param signature - Transaction signature
   * @param onUpdate - Callback for status updates
   * @param timeoutSeconds - Maximum time to wait
   *
   * @example
   * ```typescript
   * await settlementTransactionService.monitorTransaction(
   *   '2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3ZaMmUq6qQBXGbc33D5Z2Si4tJXbLjmywV3kaJXNYyR9nd5UVbQckiJ',
   *   (status) => {
   *     console.log(`Status: ${status.confirmed ? 'Confirmed' : 'Pending'}`);
   *   },
   *   60
   * );
   * ```
   */
  async monitorTransaction(
    signature: string,
    onUpdate: (status: { confirmed: boolean; success: boolean; elapsed: number }) => void,
    timeoutSeconds: number = 60,
  ): Promise<{ confirmed: boolean; success: boolean }> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    this.logger.log(`Monitoring transaction: ${signature}`);

    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.solService.getTransactionStatus(signature);
        const elapsed = Date.now() - startTime;

        onUpdate({
          confirmed: status.confirmed,
          success: status.success,
          elapsed,
        });

        if (status.confirmed) {
          this.logger.log(`Transaction confirmed after ${elapsed}ms`);
          return { confirmed: true, success: status.success };
        }

        // Wait 1 second before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.debug(`Error during monitoring: ${error.message}`);
      }
    }

    this.logger.warn(`Transaction monitoring timeout after ${timeoutSeconds}s`);
    return { confirmed: false, success: false };
  }

  /**
   * Get comprehensive transaction report
   * Returns all available information about a transaction
   *
   * @param signature - Transaction signature
   * @returns Full transaction report
   */
  async getTransactionReport(signature: string): Promise<{
    signature: string;
    status: 'confirmed' | 'failed' | 'not_found';
    details?: {
      from?: string;
      to?: string;
      amount?: number;
      fee?: number;
      blockTime?: Date;
      slot?: number;
      confirmations?: number | null;
    };
    raw?: any;
  }> {
    try {
      const [status, details] = await Promise.all([
        this.solService.getTransactionStatus(signature),
        this.solService.getTransactionDetails(signature),
      ]);

      if (!status.confirmed && !details.success) {
        return {
          signature,
          status: 'not_found',
        };
      }

      if (!status.success || !details.success) {
        return {
          signature,
          status: 'failed',
          details: {
            slot: details.slot,
            blockTime: details.blockTime ? new Date(details.blockTime * 1000) : undefined,
          },
          raw: details,
        };
      }

      // Calculate transfer amount from balance changes
      let transferAmount: number | undefined;
      if (details.preBalances && details.postBalances && details.preBalances.length >= 2) {
        const senderChange = details.postBalances[0] - details.preBalances[0];
        transferAmount = Math.abs(senderChange) - (details.fee || 0);
      }

      return {
        signature,
        status: 'confirmed',
        details: {
          from: details.accountKeys?.[0],
          to: details.accountKeys?.[1],
          amount: transferAmount,
          fee: details.fee,
          blockTime: details.blockTime ? new Date(details.blockTime * 1000) : undefined,
          slot: details.slot,
          confirmations: status.confirmations,
        },
        raw: details,
      };
    } catch (error) {
      this.logger.error(`Error getting transaction report: ${error.message}`);
      return {
        signature,
        status: 'not_found',
      };
    }
  }
}
