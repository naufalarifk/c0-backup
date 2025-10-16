import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { LoanCalculationService } from '../loans/services/loan-calculation.service';
import { NotificationQueueService } from '../notifications/notification-queue.service';

interface RecordPaymentParams {
  walletAddress: string;
  transactionHash: string;
  amount: string;
  paymentDate: Date;
}

@Injectable()
export class InvoicePaymentService {
  private readonly logger = new TelemetryLogger(InvoicePaymentService.name);

  constructor(
    @Inject(CryptogadaiRepository) private readonly repository: CryptogadaiRepository,
    private readonly notificationQueue: NotificationQueueService,
    private readonly loanCalculationService: LoanCalculationService,
  ) {}

  async recordPayment(params: RecordPaymentParams): Promise<void> {
    try {
      await this.repository.platformRecordInvoicePayment({
        walletAddress: params.walletAddress,
        paymentHash: params.transactionHash,
        amount: params.amount,
        paymentDate: params.paymentDate,
      });

      this.logger.log(
        `Recorded invoice payment ${params.transactionHash} for invoice by wallet ${params.walletAddress}`,
      );

      // Send realtime notification for invoice payment
      await this.#notifyInvoicePayment(params.walletAddress);

      // Check if this payment resulted in publishing a loan offer or loan application
      await this.#checkAndNotifyLoanOfferPublished(params.walletAddress);
      await this.#checkAndNotifyLoanApplicationPublished(params.walletAddress);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key value')) {
        this.logger.warn(
          `Duplicate payment detection ignored for invoice of wallet ${params.walletAddress} with hash ${params.transactionHash}`,
        );
        return;
      }

      this.logger.error(
        `Failed to record payment for invoice of wallet ${params.walletAddress} with hash ${params.transactionHash}:`,
        error,
      );
      throw error;
    }
  }

  async #checkAndNotifyLoanOfferPublished(walletAddress: string): Promise<void> {
    try {
      // Check if wallet address belongs to a loan offer funding invoice
      // that just got fully paid (trigger will update status to Published)
      const rows = await this.repository.sql`
        SELECT
          lo.id,
          lo.lender_user_id,
          lo.status,
          lo.published_date,
          lo.offered_principal_amount,
          lo.interest_rate,
          lo.term_in_months_options,
          c.symbol,
          c.decimals
        FROM loan_offers lo
        INNER JOIN invoices inv ON inv.loan_offer_id = lo.id
        LEFT JOIN currencies c ON c.blockchain_key = lo.principal_currency_blockchain_key
          AND c.token_id = lo.principal_currency_token_id
        WHERE inv.wallet_address = ${walletAddress}
          AND inv.status = 'Paid'
          AND inv.paid_date IS NOT NULL
          AND lo.status = 'Published'
          AND lo.published_date IS NOT NULL
      `;

      if (rows.length === 0) {
        return;
      }

      const loanOffer = rows[0] as Record<string, unknown>;
      assertDefined(loanOffer);
      assertProp(check(isString, isNumber), loanOffer, 'id');
      assertProp(check(isString, isNumber), loanOffer, 'lender_user_id');
      assertPropString(loanOffer, 'status');
      assertProp(check(isString, isNumber), loanOffer, 'decimals');

      // Format amount from smallest units to human-readable format
      const amountFormatted =
        'offered_principal_amount' in loanOffer && loanOffer.offered_principal_amount
          ? this.loanCalculationService.fromSmallestUnit(
              String(loanOffer.offered_principal_amount),
              Number(loanOffer.decimals),
            )
          : undefined;

      // Queue notification for lender
      await this.notificationQueue.queueNotification({
        type: 'LoanOfferPublished',
        userId: String(loanOffer.lender_user_id),
        loanOfferId: String(loanOffer.id),
        amount: amountFormatted,
        interestRate:
          'interest_rate' in loanOffer && loanOffer.interest_rate
            ? String(loanOffer.interest_rate)
            : undefined,
        term:
          'term_in_months_options' in loanOffer && loanOffer.term_in_months_options
            ? String(loanOffer.term_in_months_options)
            : undefined,
      });

      this.logger.log(`Queued LoanOfferPublished notification for loan offer ${loanOffer.id}`);

      // Note: Loan matching will be triggered automatically by the hourly cron scheduler
      // or can be manually triggered via admin API at /admin/loan-matcher/trigger
      this.logger.log(`Loan offer ${loanOffer.id} published - will be matched by scheduler`);
    } catch (error) {
      this.logger.error('Failed to check and notify loan offer published:', error);
      // Don't throw, as this is a notification failure, not a payment processing failure
    }
  }

  async #checkAndNotifyLoanApplicationPublished(walletAddress: string): Promise<void> {
    try {
      this.logger.log(
        `Checking for loan application published notification for wallet ${walletAddress}`,
      );

      // Check if wallet address belongs to a loan application collateral invoice
      // that just got fully paid (trigger will update status to Published)
      const rows = await this.repository.sql`
        SELECT
          la.id,
          la.borrower_user_id,
          la.status,
          la.published_date,
          la.principal_amount,
          la.max_interest_rate,
          la.term_in_months,
          c.symbol
        FROM loan_applications la
        INNER JOIN invoices inv ON inv.loan_application_id = la.id
        LEFT JOIN currencies c ON c.blockchain_key = la.collateral_currency_blockchain_key
          AND c.token_id = la.collateral_currency_token_id
        WHERE inv.wallet_address = ${walletAddress}
          AND inv.status = 'Paid'
          AND inv.paid_date IS NOT NULL
          AND la.status = 'Published'
          AND la.published_date IS NOT NULL
      `;

      this.logger.log(
        `Found ${rows.length} published loan applications for wallet ${walletAddress}`,
      );

      if (rows.length === 0) {
        this.logger.warn(
          `No published loan application found for wallet ${walletAddress} (invoice might not be paid or loan application not published yet)`,
        );
        return;
      }

      const loanApplication = rows[0] as Record<string, unknown>;
      assertDefined(loanApplication);
      assertProp(check(isString, isNumber), loanApplication, 'id');
      assertProp(check(isString, isNumber), loanApplication, 'borrower_user_id');
      assertPropString(loanApplication, 'status');

      // Queue notification for borrower
      await this.notificationQueue.queueNotification({
        type: 'LoanApplicationPublished',
        userId: String(loanApplication.borrower_user_id),
        loanApplicationId: String(loanApplication.id),
        amount:
          'principal_amount' in loanApplication && loanApplication.principal_amount
            ? String(loanApplication.principal_amount)
            : undefined,
        maxInterestRate:
          'max_interest_rate' in loanApplication && loanApplication.max_interest_rate
            ? String(loanApplication.max_interest_rate)
            : undefined,
        term:
          'term_in_months' in loanApplication && loanApplication.term_in_months
            ? String(loanApplication.term_in_months)
            : undefined,
      });

      this.logger.log(
        `Queued LoanApplicationPublished notification for loan application ${loanApplication.id}`,
      );

      // Note: Loan matching will be triggered automatically by the hourly cron scheduler
      // or can be manually triggered via admin API at /admin/loan-matcher/trigger
      this.logger.log(
        `Loan application ${loanApplication.id} published - will be matched by scheduler`,
      );
    } catch (error) {
      this.logger.error('Failed to check and notify loan application published:', error);
      // Don't throw, as this is a notification failure, not a payment processing failure
    }
  }

  async #notifyInvoicePayment(walletAddress: string): Promise<void> {
    try {
      // Query the invoice to get its updated status and type
      const rows = await this.repository.sql`
        SELECT
          inv.id,
          inv.user_id,
          inv.status,
          inv.loan_offer_id,
          inv.loan_application_id,
          inv.invoiced_amount,
          inv.paid_amount,
          inv.currency_blockchain_key,
          inv.currency_token_id,
          c.decimals
        FROM invoices inv
        LEFT JOIN currencies c ON c.blockchain_key = inv.currency_blockchain_key
          AND c.token_id = inv.currency_token_id
        WHERE inv.wallet_address = ${walletAddress}
        ORDER BY inv.id DESC
        LIMIT 1
      `;

      if (rows.length === 0) {
        this.logger.warn(`No invoice found for wallet ${walletAddress}`);
        return;
      }

      const invoice = rows[0] as Record<string, unknown>;
      assertDefined(invoice);
      assertProp(check(isString, isNumber), invoice, 'id');
      assertProp(check(isString, isNumber), invoice, 'user_id');
      assertPropString(invoice, 'status');
      assertProp(check(isNullable, isString, isNumber), invoice, 'loan_offer_id');
      assertProp(check(isNullable, isString, isNumber), invoice, 'loan_application_id');
      assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
      assertProp(check(isString, isNumber), invoice, 'paid_amount');
      assertProp(check(isString, isNumber), invoice, 'decimals');

      const userId = String(invoice.user_id);
      const invoiceId = String(invoice.id);
      const status = invoice.status;
      const isLoanOffer = invoice.loan_offer_id !== null;
      const isLoanApplication = invoice.loan_application_id !== null;
      const decimals = Number(invoice.decimals);

      // Format amounts from smallest units to human-readable format
      const invoicedAmount = this.loanCalculationService.fromSmallestUnit(
        String(invoice.invoiced_amount),
        decimals,
      );
      const paidAmount = this.loanCalculationService.fromSmallestUnit(
        String(invoice.paid_amount),
        decimals,
      );

      // Determine notification type based on invoice type and status
      let notificationType:
        | 'LoanOfferInvoicePartiallyPaid'
        | 'LoanOfferInvoiceFullyPaid'
        | 'LoanApplicationCollateralInvoicePartiallyPaid'
        | 'LoanApplicationCollateralInvoiceFullyPaid'
        | null = null;

      if (isLoanOffer && status === 'PartiallyPaid') {
        notificationType = 'LoanOfferInvoicePartiallyPaid';
      } else if (isLoanOffer && status === 'Paid') {
        notificationType = 'LoanOfferInvoiceFullyPaid';
      } else if (isLoanApplication && status === 'PartiallyPaid') {
        notificationType = 'LoanApplicationCollateralInvoicePartiallyPaid';
      } else if (isLoanApplication && status === 'Paid') {
        notificationType = 'LoanApplicationCollateralInvoiceFullyPaid';
      }

      if (!notificationType) {
        this.logger.log(
          `No realtime notification needed for invoice ${invoiceId} (status: ${status}, isLoanOffer: ${isLoanOffer}, isLoanApplication: ${isLoanApplication})`,
        );
        return;
      }

      // Queue realtime notification
      await this.notificationQueue.queueNotification({
        type: notificationType,
        userId: userId,
        invoiceId: invoiceId,
        invoicedAmount: invoicedAmount,
        paidAmount: paidAmount,
      });

      this.logger.log(
        `Queued ${notificationType} realtime notification for invoice ${invoiceId} (user: ${userId})`,
      );
    } catch (error) {
      this.logger.error('Failed to notify invoice payment:', error);
      // Don't throw, as this is a notification failure, not a payment processing failure
    }
  }
}
