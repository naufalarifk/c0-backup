import type {
  ActiveLoanForValuation,
  LoanMaturityReminderEvent,
  LtvThresholdBreachedEvent,
  LtvWarningLevel,
  ValuationCalculationResult,
} from './valuation.types';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';

@Injectable()
export class ValuationEventService {
  private readonly logger = new Logger(ValuationEventService.name);

  constructor(
    @InjectQueue('notificationQueue')
    private readonly notificationQueue: Queue,
    @InjectQueue('liquidationQueue')
    private readonly liquidationQueue: Queue,
  ) {}

  /**
   * Emits LTV threshold breach events based on valuation results
   */
  async emitLtvThresholdEvents(
    valuation: ValuationCalculationResult,
    loan: ActiveLoanForValuation,
  ): Promise<void> {
    if (valuation.breachedThresholds.length === 0) {
      return;
    }

    this.logger.log(
      `Loan ${loan.loanId} breached thresholds: ${valuation.breachedThresholds.join(', ')} (LTV: ${valuation.newLtvRatio.toFixed(4)})`,
    );

    for (const threshold of valuation.breachedThresholds) {
      const event: LtvThresholdBreachedEvent = {
        loanId: loan.loanId,
        borrowerUserId: loan.borrowerUserId,
        currentLtvRatio: valuation.newLtvRatio,
        thresholdLevel: threshold,
        collateralValuationAmount: valuation.collateralValuationAmount,
        totalDebtAmount: valuation.totalDebtAmount,
        collateralCurrency: {
          blockchainKey: loan.collateralBlockchainKey,
          tokenId: loan.collateralTokenId,
          symbol: '', // Will be enriched by consumer
        },
        principalCurrency: {
          blockchainKey: loan.principalBlockchainKey,
          tokenId: loan.principalTokenId,
          symbol: '', // Will be enriched by consumer
        },
        breachDate: valuation.valuationDate,
        exchangeRateId: valuation.exchangeRateId,
      };

      try {
        // Route to appropriate queue based on threshold level
        if (threshold === 'liquidation') {
          await this.emitLiquidationEvent(event);
        } else if (threshold === 'riskPremium') {
          await this.emitPendingOrderEvent(event);
        } else {
          await this.emitWarningNotification(event);
        }
      } catch (error) {
        this.logger.error(
          `Failed to emit ${threshold} event for loan ${loan.loanId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Emits liquidation event to liquidation queue
   */
  private async emitLiquidationEvent(event: LtvThresholdBreachedEvent): Promise<void> {
    await this.liquidationQueue.add(
      'ltvLiquidationTriggered',
      {
        loanId: event.loanId,
        borrowerUserId: event.borrowerUserId,
        currentLtvRatio: event.currentLtvRatio,
        collateralValuationAmount: event.collateralValuationAmount,
        totalDebtAmount: event.totalDebtAmount,
        triggeredDate: event.breachDate,
        exchangeRateId: event.exchangeRateId,
        reason: 'LTV_BREACH',
      },
      {
        priority: 1, // Highest priority
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.warn(
      `LIQUIDATION triggered for loan ${event.loanId} - LTV: ${event.currentLtvRatio.toFixed(4)}`,
    );
  }

  /**
   * Emits pending order placement event
   */
  private async emitPendingOrderEvent(event: LtvThresholdBreachedEvent): Promise<void> {
    await this.liquidationQueue.add(
      'placePendingOrder',
      {
        loanId: event.loanId,
        borrowerUserId: event.borrowerUserId,
        currentLtvRatio: event.currentLtvRatio,
        collateralValuationAmount: event.collateralValuationAmount,
        totalDebtAmount: event.totalDebtAmount,
        triggeredDate: event.breachDate,
        exchangeRateId: event.exchangeRateId,
      },
      {
        priority: 2,
        attempts: 3,
      },
    );

    // Also send notification
    await this.notificationQueue.add(
      'ltvRiskPremiumWarning',
      {
        loanId: event.loanId,
        borrowerUserId: event.borrowerUserId,
        warningLevel: 'riskPremium',
        currentLtvRatio: event.currentLtvRatio,
        message:
          'URGENT: Your collateral value has reached the risk premium level. Pending liquidation order placed.',
        channels: ['email', 'sms', 'push'],
      },
      {
        priority: 1,
      },
    );

    this.logger.warn(
      `PENDING ORDER placed for loan ${event.loanId} - Risk Premium reached (LTV: ${event.currentLtvRatio.toFixed(4)})`,
    );
  }

  /**
   * Emits warning notification to notification queue
   */
  private async emitWarningNotification(event: LtvThresholdBreachedEvent): Promise<void> {
    const warningMessages: Record<LtvWarningLevel, string> = {
      warning1:
        'Your collateral value is approaching the threshold. Current valuation is near debt + 15%.',
      warning2:
        'WARNING: Your collateral value has decreased. Current valuation is near debt + 10%.',
      warning3:
        'URGENT WARNING: Your collateral value is critically low. Current valuation is near debt + 5%. Please add collateral or repay loan.',
      riskPremium: 'CRITICAL: Risk premium level reached.',
      liquidation: 'LIQUIDATION: Loan is being liquidated.',
    };

    const channelsByLevel: Record<LtvWarningLevel, string[]> = {
      warning1: ['email'],
      warning2: ['email', 'push'],
      warning3: ['email', 'sms', 'push'],
      riskPremium: ['email', 'sms', 'push'],
      liquidation: ['email', 'sms', 'push'],
    };

    await this.notificationQueue.add(
      'ltvWarning',
      {
        loanId: event.loanId,
        borrowerUserId: event.borrowerUserId,
        warningLevel: event.thresholdLevel,
        currentLtvRatio: event.currentLtvRatio,
        collateralValuationAmount: event.collateralValuationAmount,
        totalDebtAmount: event.totalDebtAmount,
        message: warningMessages[event.thresholdLevel],
        channels: channelsByLevel[event.thresholdLevel],
      },
      {
        priority: event.thresholdLevel === 'warning3' ? 1 : 3,
        attempts: 3,
      },
    );

    this.logger.log(
      `LTV Warning ${event.thresholdLevel} notification sent for loan ${event.loanId}`,
    );
  }

  /**
   * Emits loan maturity reminder notifications
   */
  async emitMaturityReminder(
    loan: ActiveLoanForValuation,
    daysUntilMaturity: number,
  ): Promise<void> {
    const totalRepaymentHuman =
      Number(loan.principalAmount) + Number(loan.interestAmount) + Number(loan.provisionAmount);

    const event: LoanMaturityReminderEvent = {
      loanId: loan.loanId,
      borrowerUserId: loan.borrowerUserId,
      maturityDate: loan.maturityDate,
      daysUntilMaturity,
      totalRepaymentAmount: String(totalRepaymentHuman),
      principalCurrency: {
        blockchainKey: loan.principalBlockchainKey,
        tokenId: loan.principalTokenId,
        symbol: '', // Will be enriched by consumer
      },
    };

    const reminderMessages: Record<number, string> = {
      3: 'Your loan matures in 3 days. Please prepare your repayment.',
      2: 'Your loan matures in 2 days. Repayment is due soon.',
      1: 'URGENT: Your loan matures tomorrow. Please repay to avoid liquidation.',
      0: 'CRITICAL: Your loan matures today. Immediate repayment required to avoid liquidation.',
    };

    const channelsByDays: Record<number, string[]> = {
      3: ['email'],
      2: ['email', 'push'],
      1: ['email', 'sms', 'push'],
      0: ['email', 'sms', 'push'],
    };

    try {
      await this.notificationQueue.add(
        'loanMaturityReminder',
        {
          ...event,
          message: reminderMessages[daysUntilMaturity] || 'Your loan is approaching maturity.',
          channels: channelsByDays[daysUntilMaturity] || ['email'],
        },
        {
          priority: daysUntilMaturity <= 1 ? 1 : 3,
          attempts: 3,
        },
      );

      this.logger.log(`Maturity reminder sent for loan ${loan.loanId} (D-${daysUntilMaturity})`);
    } catch (error) {
      this.logger.error(
        `Failed to emit maturity reminder for loan ${loan.loanId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
