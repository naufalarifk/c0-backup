import type { SettlementDiscrepancy, SettlementResult } from '../../types/settlement.types';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Settlement Alert Service
 * Handles alerting for settlement verification failures and discrepancies
 */
@Injectable()
export class SettlementAlertService {
  private readonly logger = new Logger(SettlementAlertService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Alert on verification failure immediately after transfer
   */
  async alertVerificationFailure(
    result: SettlementResult,
    type: 'deposit' | 'withdrawal',
  ): Promise<void> {
    const message =
      `🚨 Settlement ${type} verification FAILED\n` +
      `Blockchain: ${result.blockchainKey}\n` +
      `Transaction: ${result.transactionHash}\n` +
      `Amount: ${result.settlementAmount}\n` +
      `Error: ${result.verificationError}\n` +
      `Timestamp: ${result.verificationTimestamp?.toISOString()}`;

    this.logger.error(message);

    // TODO: Integrate with notification system
    // - Send email to finance team
    // - Send Slack/Discord webhook
    // - Create database alert record
    // - Trigger PagerDuty if critical

    await this.logAlertToDatabase({
      transactionHash: result.transactionHash || 'unknown',
      blockchainKey: result.blockchainKey,
      type,
      issue: result.verificationError || 'Verification failed',
      details: {
        result,
        verificationDetails: result.verificationDetails,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Alert on reconciliation discrepancies (batch verification)
   */
  async alertReconciliationDiscrepancies(discrepancies: SettlementDiscrepancy[]): Promise<void> {
    if (discrepancies.length === 0) {
      return;
    }

    const message =
      `🔍 Daily reconciliation found ${discrepancies.length} discrepancy(ies)\n` +
      discrepancies
        .map(
          d =>
            `- ${d.type.toUpperCase()}: ${d.transactionHash} on ${d.blockchainKey}\n  Issue: ${d.issue}`,
        )
        .join('\n');

    this.logger.warn(message);

    // TODO: Integrate with notification system
    // - Send daily summary email
    // - Create Jira tickets for unresolved discrepancies
    // - Update dashboard metrics

    for (const discrepancy of discrepancies) {
      await this.logAlertToDatabase(discrepancy);
    }
  }

  /**
   * Alert when verification timeout occurs
   */
  async alertVerificationTimeout(
    txHash: string,
    blockchainKey: string,
    type: 'deposit' | 'withdrawal',
    timeoutMinutes: number,
  ): Promise<void> {
    const message =
      `⏱️ Settlement ${type} verification TIMEOUT\n` +
      `Transaction: ${txHash}\n` +
      `Blockchain: ${blockchainKey}\n` +
      `Timeout: ${timeoutMinutes} minutes\n` +
      `Status: Transaction sent but not yet confirmed or matched`;

    this.logger.warn(message);

    await this.logAlertToDatabase({
      transactionHash: txHash,
      blockchainKey,
      type,
      issue: `Verification timeout after ${timeoutMinutes} minutes`,
      details: { timeoutMinutes },
      timestamp: new Date(),
    });
  }

  /**
   * Log alert to database for audit trail
   * TODO: Implement database storage using CryptogadaiRepository
   */
  private async logAlertToDatabase(discrepancy: SettlementDiscrepancy): Promise<void> {
    try {
      // TODO: Add to repository:
      // await this.repository.createSettlementAlert({
      //   transactionHash: discrepancy.transactionHash,
      //   blockchainKey: discrepancy.blockchainKey,
      //   type: discrepancy.type,
      //   issue: discrepancy.issue,
      //   details: discrepancy.details,
      //   timestamp: discrepancy.timestamp,
      // });

      this.logger.debug(`Alert logged for ${discrepancy.transactionHash}`);
    } catch (error) {
      this.logger.error('Failed to log alert to database:', error);
    }
  }

  /**
   * Send daily reconciliation summary
   */
  async sendDailySummary(
    date: string,
    totalDeposits: number,
    verifiedDeposits: number,
    totalWithdrawals: number,
    verifiedWithdrawals: number,
  ): Promise<void> {
    const depositRate =
      totalDeposits > 0 ? ((verifiedDeposits / totalDeposits) * 100).toFixed(1) : '100.0';
    const withdrawalRate =
      totalWithdrawals > 0 ? ((verifiedWithdrawals / totalWithdrawals) * 100).toFixed(1) : '100.0';

    const message =
      `📊 Daily Settlement Reconciliation Report - ${date}\n` +
      `Deposits: ${verifiedDeposits}/${totalDeposits} verified (${depositRate}%)\n` +
      `Withdrawals: ${verifiedWithdrawals}/${totalWithdrawals} verified (${withdrawalRate}%)`;

    this.logger.log(message);

    // TODO: Send email report to finance team
  }
}
