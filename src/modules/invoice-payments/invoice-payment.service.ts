import { Inject, Injectable, Logger } from '@nestjs/common';

import { assertDefined, assertProp, assertPropString, check, isNumber, isString } from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { LoanMatcherQueueService } from '../loan-matcher/loan-matcher-queue.service';
import { NotificationQueueService } from '../notifications/notification-queue.service';

interface RecordPaymentParams {
  walletAddress: string;
  transactionHash: string;
  amount: string;
  paymentDate: Date;
}

@Injectable()
export class InvoicePaymentService {
  private readonly logger = new Logger(InvoicePaymentService.name);

  constructor(
    @Inject(CryptogadaiRepository) private readonly repository: CryptogadaiRepository,
    private readonly notificationQueue: NotificationQueueService,
    private readonly loanMatcherQueue: LoanMatcherQueueService,
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
          c.symbol
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

      // Queue notification for lender
      await this.notificationQueue.queueNotification({
        type: 'LoanOfferPublished',
        userId: String(loanOffer.lender_user_id),
        loanOfferId: String(loanOffer.id),
        amount:
          'offered_principal_amount' in loanOffer && loanOffer.offered_principal_amount
            ? String(loanOffer.offered_principal_amount)
            : undefined,
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

      // Queue loan matching for the newly published offer
      await this.loanMatcherQueue.queueMatchingForNewOffer(String(loanOffer.id));
      this.logger.log(`Queued loan matching for newly published loan offer ${loanOffer.id}`);
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

      // Queue loan matching for the newly published application
      await this.loanMatcherQueue.queueMatchingForNewApplication(String(loanApplication.id));
      this.logger.log(
        `Queued loan matching for newly published loan application ${loanApplication.id}`,
      );
    } catch (error) {
      this.logger.error('Failed to check and notify loan application published:', error);
      // Don't throw, as this is a notification failure, not a payment processing failure
    }
  }
}
