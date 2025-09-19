import {
  assertDefined,
  assertPropDate,
  assertPropNullableDate,
  assertPropNullableString,
  assertPropString,
  assertPropStringOrNumber,
} from '../utils/assertions';
import {
  AdminApprovesWithdrawalRefundParams,
  AdminApprovesWithdrawalRefundResult,
  AdminRejectsWithdrawalRefundParams,
  AdminRejectsWithdrawalRefundResult,
  BlockchainDetectsInvoicePaymentParams,
  BlockchainDetectsInvoicePaymentResult,
  PlatformConfirmsWithdrawalParams,
  PlatformConfirmsWithdrawalResult,
  PlatformCreatesInvoiceParams,
  PlatformCreatesInvoiceResult,
  PlatformCreatesUserAccountParams,
  PlatformCreatesUserAccountResult,
  PlatformFailsWithdrawalParams,
  PlatformFailsWithdrawalResult,
  PlatformRetrievesProvisionRateResult,
  PlatformSendsWithdrawalParams,
  PlatformSendsWithdrawalResult,
  PlatformSetActiveButExpiredInvoiceAsExpiredParams,
  PlatformSetActiveButExpiredInvoiceAsExpiredResult,
  PlatformUpdatesInvoiceStatusParams,
  PlatformUpdatesInvoiceStatusResult,
  PlatformViewsActiveButExpiredInvoicesParams,
  PlatformViewsActiveButExpiredInvoicesResult,
  UserRegistersWithdrawalBeneficiaryParams,
  UserRegistersWithdrawalBeneficiaryResult,
  UserRequestsWithdrawalParams,
  UserRequestsWithdrawalResult,
  UserRetrievesAccountBalancesParams,
  UserRetrievesAccountBalancesResult,
  UserViewsAccountTransactionHistoryParams,
  UserViewsAccountTransactionHistoryResult,
  UserViewsCurrenciesParams,
  UserViewsCurrenciesResult,
  UserViewsInvoiceDetailsParams,
  UserViewsInvoiceDetailsResult,
  UserViewsWithdrawalBeneficiariesParams,
  UserViewsWithdrawalBeneficiariesResult,
} from './finance.types';
import { UserRepository } from './user.repository';

/**
 * FinanceRepository <- UserRepository <- BaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as balance calculations, exchange rate validations, etc.
 * should be handled by services that use this repository.
 */
export abstract class FinanceRepository extends UserRepository {
  // Account & Balance Management Methods
  async userRetrievesAccountBalances(
    params: UserRetrievesAccountBalancesParams,
  ): Promise<UserRetrievesAccountBalancesResult> {
    const { userId } = params;

    const rows = await this.sql`
      SELECT
        id,
        user_id,
        currency_blockchain_key,
        currency_token_id,
        balance,
        account_type
      FROM accounts
      WHERE user_id = ${userId}
      ORDER BY currency_blockchain_key, currency_token_id
    `;

    const accounts = rows;

    return {
      accounts: accounts.map(function (account: unknown) {
        assertDefined(account, 'Account is undefined');
        assertPropStringOrNumber(account, 'id');
        assertPropStringOrNumber(account, 'user_id');
        assertPropString(account, 'currency_blockchain_key');
        assertPropString(account, 'currency_token_id');
        assertPropStringOrNumber(account, 'balance');
        assertPropString(account, 'account_type');
        return {
          id: String(account.id),
          userId: String(account.user_id),
          currencyBlockchainKey: account.currency_blockchain_key,
          currencyTokenId: account.currency_token_id,
          balance: String(account.balance),
          accountType: account.account_type,
        };
      }),
    };
  }

  async userViewsAccountTransactionHistory(
    params: UserViewsAccountTransactionHistoryParams,
  ): Promise<UserViewsAccountTransactionHistoryResult> {
    const { accountId, mutationType, fromDate, toDate, limit = 50, offset = 0 } = params;

    // Get total count first
    const countResult = await this.sql`
      SELECT COUNT(*) as total
      FROM account_mutations
      WHERE account_id = ${accountId}
        AND (${mutationType}::text IS NULL OR mutation_type = ${mutationType})
        AND (${fromDate}::timestamp IS NULL OR mutation_date >= ${fromDate})
        AND (${toDate}::timestamp IS NULL OR mutation_date <= ${toDate})
    `;

    const countRow = Array.isArray(countResult) ? countResult[0] : countResult;
    assertDefined(countRow, 'Count query failed');
    assertPropStringOrNumber(countRow, 'total');
    const totalCount = Number(countRow.total);

    const rows = await this.sql`
      SELECT
        id,
        account_id,
        mutation_type,
        mutation_date,
        amount,
        invoice_id,
        withdrawal_id,
        invoice_payment_id
      FROM account_mutations
      WHERE account_id = ${accountId}
        AND (${mutationType}::text IS NULL OR mutation_type = ${mutationType})
        AND (${fromDate}::timestamp IS NULL OR mutation_date >= ${fromDate})
        AND (${toDate}::timestamp IS NULL OR mutation_date <= ${toDate})
      ORDER BY mutation_date DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const mutations = rows;
    const hasMore = offset + mutations.length < totalCount;

    return {
      mutations: mutations.map(function (mutation: unknown) {
        assertDefined(mutation, 'Mutation is undefined');
        assertPropStringOrNumber(mutation, 'id');
        assertPropStringOrNumber(mutation, 'account_id');
        assertPropString(mutation, 'mutation_type');
        assertPropDate(mutation, 'mutation_date');
        assertPropStringOrNumber(mutation, 'amount');
        assertPropNullableString(mutation, 'invoice_id');
        assertPropNullableString(mutation, 'withdrawal_id');
        assertPropNullableString(mutation, 'invoice_payment_id');
        return {
          id: String(mutation.id),
          accountId: String(mutation.account_id),
          mutationType: mutation.mutation_type,
          mutationDate: mutation.mutation_date,
          amount: String(mutation.amount),
          invoiceId: mutation.invoice_id ? String(mutation.invoice_id) : undefined,
          withdrawalId: mutation.withdrawal_id ? String(mutation.withdrawal_id) : undefined,
          invoicePaymentId: mutation.invoice_payment_id
            ? String(mutation.invoice_payment_id)
            : undefined,
        };
      }),
      totalCount,
      hasMore,
    };
  }

  async testCreatesUserAccount(
    params: PlatformCreatesUserAccountParams,
  ): Promise<PlatformCreatesUserAccountResult> {
    const { userId, currencyBlockchainKey, currencyTokenId, accountType = 'User' } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO accounts (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          balance,
          account_type
        )
        VALUES (
          ${userId},
          ${currencyBlockchainKey},
          ${currencyTokenId},
          0,
          ${accountType}
        )
        ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type)
        DO UPDATE SET account_type = EXCLUDED.account_type
        RETURNING id, user_id, currency_blockchain_key, currency_token_id, balance, account_type
      `;

      const account = rows[0];
      assertDefined(account, 'Account creation failed');
      assertPropStringOrNumber(account, 'id');
      assertPropStringOrNumber(account, 'user_id');
      assertPropString(account, 'currency_blockchain_key');
      assertPropString(account, 'currency_token_id');
      assertPropStringOrNumber(account, 'balance');
      assertPropString(account, 'account_type');

      await tx.commitTransaction();

      return {
        id: String(account.id),
        userId: String(account.user_id),
        currencyBlockchainKey: account.currency_blockchain_key,
        currencyTokenId: account.currency_token_id,
        balance: String(account.balance),
        accountType: account.account_type,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Invoice Management Methods
  async testCreatesInvoice(
    params: PlatformCreatesInvoiceParams,
  ): Promise<PlatformCreatesInvoiceResult> {
    const {
      userId,
      currencyBlockchainKey,
      currencyTokenId,
      invoicedAmount,
      walletDerivationPath,
      walletAddress,
      invoiceType,
      invoiceDate,
      dueDate,
    } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO invoices (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          invoiced_amount,
          wallet_derivation_path,
          wallet_address,
          invoice_type,
          draft_date,
          invoice_date,
          due_date
        )
        VALUES (
          ${userId},
          ${currencyBlockchainKey},
          ${currencyTokenId},
          ${invoicedAmount},
          ${walletDerivationPath},
          ${walletAddress},
          ${invoiceType},
          ${invoiceDate.toISOString()},
          ${invoiceDate.toISOString()},
          ${dueDate?.toISOString()}
        )
        RETURNING id, user_id, wallet_address, invoice_type, status, invoiced_amount, paid_amount, invoice_date, due_date
      `;

      const invoice = rows[0];
      assertDefined(invoice, 'Invoice creation failed');
      assertPropStringOrNumber(invoice, 'id');
      assertPropStringOrNumber(invoice, 'user_id');
      assertPropString(invoice, 'wallet_address');
      assertPropString(invoice, 'invoice_type');
      assertPropString(invoice, 'status');
      assertPropStringOrNumber(invoice, 'invoiced_amount');
      assertPropStringOrNumber(invoice, 'paid_amount');
      assertPropDate(invoice, 'invoice_date');
      assertPropNullableDate(invoice, 'due_date');

      await tx.commitTransaction();

      return {
        id: String(invoice.id),
        userId: String(invoice.user_id),
        walletAddress: invoice.wallet_address,
        invoiceType: invoice.invoice_type,
        status: invoice.status,
        invoicedAmount: String(invoice.invoiced_amount),
        paidAmount: String(invoice.paid_amount),
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async blockchainDetectsInvoicePayment(
    params: BlockchainDetectsInvoicePaymentParams,
  ): Promise<BlockchainDetectsInvoicePaymentResult> {
    const { invoiceId, paymentHash, amount, paymentDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO invoice_payments (
          invoice_id,
          payment_hash,
          amount,
          payment_date
        )
        VALUES (
          ${invoiceId},
          ${paymentHash},
          ${amount},
          ${paymentDate.toISOString()}
        )
        RETURNING id, invoice_id, payment_hash, amount, payment_date
      `;

      const payment = rows[0];
      assertDefined(payment, 'Invoice payment recording failed');
      assertPropStringOrNumber(payment, 'id');
      assertPropStringOrNumber(payment, 'invoice_id');
      assertPropString(payment, 'payment_hash');
      assertPropStringOrNumber(payment, 'amount');
      assertPropDate(payment, 'payment_date');

      await tx.commitTransaction();
      return {
        id: String(payment.id),
        invoiceId: String(payment.invoice_id),
        paymentHash: payment.payment_hash,
        amount: String(payment.amount),
        paymentDate: payment.payment_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async testUpdatesInvoiceStatus(
    params: PlatformUpdatesInvoiceStatusParams,
  ): Promise<PlatformUpdatesInvoiceStatusResult> {
    const { invoiceId, status, expiredDate, notifiedDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE invoices
        SET status = ${status},
            expired_date = COALESCE(${expiredDate?.toISOString()}, expired_date),
            notified_date = COALESCE(${notifiedDate?.toISOString()}, notified_date)
        WHERE id = ${invoiceId}
        RETURNING id, status, expired_date, notified_date
      `;

      if (rows.length === 0) {
        throw new Error('Invoice status update failed');
      }

      const invoice = rows[0];
      assertDefined(invoice, 'Invoice not found or update failed');
      assertPropStringOrNumber(invoice, 'id');
      assertPropString(invoice, 'status');
      assertPropNullableDate(invoice, 'expired_date');
      assertPropNullableDate(invoice, 'notified_date');

      await tx.commitTransaction();

      return {
        id: String(invoice.id),
        status: invoice.status,
        expiredDate: invoice.expired_date,
        notifiedDate: invoice.notified_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userViewsInvoiceDetails(
    params: UserViewsInvoiceDetailsParams,
  ): Promise<UserViewsInvoiceDetailsResult> {
    const { invoiceId } = params;

    const rows = await this.sql`
      SELECT
        id,
        user_id,
        currency_blockchain_key,
        currency_token_id,
        invoiced_amount,
        paid_amount,
        wallet_address,
        invoice_type,
        status,
        invoice_date,
        due_date,
        expired_date,
        paid_date
      FROM invoices
      WHERE id = ${invoiceId}
    `;

    if (rows.length === 0) {
      throw new Error('Invoice not found');
    }

    const invoice = rows[0];
    assertDefined(invoice, 'Invoice not found');
    assertPropStringOrNumber(invoice, 'id');
    assertPropStringOrNumber(invoice, 'user_id');
    assertPropString(invoice, 'currency_blockchain_key');
    assertPropString(invoice, 'currency_token_id');
    assertPropString(invoice, 'wallet_address');
    assertPropString(invoice, 'invoice_type');
    assertPropString(invoice, 'status');
    assertPropStringOrNumber(invoice, 'invoiced_amount');
    assertPropStringOrNumber(invoice, 'paid_amount');
    assertPropDate(invoice, 'invoice_date');
    assertPropNullableDate(invoice, 'due_date');
    assertPropNullableDate(invoice, 'expired_date');
    assertPropNullableDate(invoice, 'paid_date');

    return {
      id: String(invoice.id),
      userId: String(invoice.user_id),
      currencyBlockchainKey: invoice.currency_blockchain_key,
      currencyTokenId: invoice.currency_token_id,
      invoicedAmount: String(invoice.invoiced_amount),
      paidAmount: String(invoice.paid_amount),
      walletAddress: invoice.wallet_address,
      invoiceType: invoice.invoice_type,
      status: invoice.status,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      expiredDate: invoice.expired_date,
      paidDate: invoice.paid_date,
    };
  }

  async platformViewsActiveButExpiredInvoices(
    params: PlatformViewsActiveButExpiredInvoicesParams,
  ): Promise<PlatformViewsActiveButExpiredInvoicesResult> {
    const { asOfDate = new Date(), limit = 50, offset = 0 } = params;

    // Get total count first
    const countResult = await this.sql`
      SELECT COUNT(*) as total
      FROM invoices
      WHERE status IN ('Pending', 'PartiallyPaid', 'Overdue')
        AND due_date IS NOT NULL
        AND due_date < ${asOfDate.toISOString()}
    `;

    const countRow = Array.isArray(countResult) ? countResult[0] : countResult;
    assertDefined(countRow, 'Count query failed');
    assertPropStringOrNumber(countRow, 'total');
    const totalCount = Number(countRow.total);

    const rows = await this.sql`
      SELECT
        id,
        user_id,
        currency_blockchain_key,
        currency_token_id,
        invoiced_amount,
        paid_amount,
        wallet_address,
        invoice_type,
        status,
        invoice_date,
        due_date,
        expired_date
      FROM invoices
      WHERE status IN ('Pending', 'PartiallyPaid', 'Overdue')
        AND due_date IS NOT NULL
        AND due_date < ${asOfDate.toISOString()}
      ORDER BY due_date ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const invoices = rows;
    const hasMore = offset + invoices.length < totalCount;

    return {
      invoices: invoices.map(function (invoice: unknown) {
        assertDefined(invoice, 'Invoice is undefined');
        assertPropStringOrNumber(invoice, 'id');
        assertPropStringOrNumber(invoice, 'user_id');
        assertPropString(invoice, 'currency_blockchain_key');
        assertPropString(invoice, 'currency_token_id');
        assertPropStringOrNumber(invoice, 'invoiced_amount');
        assertPropStringOrNumber(invoice, 'paid_amount');
        assertPropString(invoice, 'wallet_address');
        assertPropString(invoice, 'invoice_type');
        assertPropString(invoice, 'status');
        assertPropDate(invoice, 'invoice_date');
        assertPropNullableDate(invoice, 'due_date');
        assertPropNullableDate(invoice, 'expired_date');
        return {
          id: String(invoice.id),
          userId: String(invoice.user_id),
          currencyBlockchainKey: invoice.currency_blockchain_key,
          currencyTokenId: invoice.currency_token_id,
          invoicedAmount: String(invoice.invoiced_amount),
          paidAmount: String(invoice.paid_amount),
          walletAddress: invoice.wallet_address,
          invoiceType: invoice.invoice_type,
          status: invoice.status,
          invoiceDate: invoice.invoice_date,
          dueDate: invoice.due_date,
          expiredDate: invoice.expired_date,
        };
      }),
      totalCount,
      hasMore,
    };
  }

  async platformSetActiveButExpiredInvoiceAsExpired(
    params: PlatformSetActiveButExpiredInvoiceAsExpiredParams,
  ): Promise<PlatformSetActiveButExpiredInvoiceAsExpiredResult> {
    const { invoiceId, expiredDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE invoices
        SET status = 'Expired',
            expired_date = ${expiredDate.toISOString()}
        WHERE id = ${invoiceId}
          AND status IN ('Pending', 'PartiallyPaid', 'Overdue')
        RETURNING id, status, expired_date
      `;

      if (rows.length === 0) {
        throw new Error('Invoice not found or cannot be expired');
      }

      const invoice = rows[0];
      assertDefined(invoice, 'Invoice not found or update failed');
      assertPropStringOrNumber(invoice, 'id');
      assertPropString(invoice, 'status');
      assertPropDate(invoice, 'expired_date');

      await tx.commitTransaction();

      return {
        id: String(invoice.id),
        status: invoice.status,
        expiredDate: invoice.expired_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Withdrawal Management Methods
  async userRegistersWithdrawalBeneficiary(
    params: UserRegistersWithdrawalBeneficiaryParams,
  ): Promise<UserRegistersWithdrawalBeneficiaryResult> {
    const { userId, blockchainKey, address } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO beneficiaries (
          user_id,
          blockchain_key,
          address
        )
        VALUES (
          ${userId},
          ${blockchainKey},
          ${address}
        )
        RETURNING id, user_id, blockchain_key, address
      `;

      const beneficiary = rows[0];
      assertDefined(beneficiary, 'Beneficiary registration failed');
      assertPropStringOrNumber(beneficiary, 'id');
      assertPropStringOrNumber(beneficiary, 'user_id');
      assertPropString(beneficiary, 'blockchain_key');
      assertPropString(beneficiary, 'address');

      await tx.commitTransaction();

      return {
        id: String(beneficiary.id),
        userId: String(beneficiary.user_id),
        blockchainKey: beneficiary.blockchain_key,
        address: beneficiary.address,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userRequestsWithdrawal(
    params: UserRequestsWithdrawalParams,
  ): Promise<UserRequestsWithdrawalResult> {
    const { beneficiaryId, currencyBlockchainKey, currencyTokenId, amount, requestDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO withdrawals (
          beneficiary_id,
          currency_blockchain_key,
          currency_token_id,
          amount,
          request_amount,
          request_date,
          status
        )
        VALUES (
          ${beneficiaryId},
          ${currencyBlockchainKey},
          ${currencyTokenId},
          ${amount},
          ${amount},
          ${requestDate.toISOString()},
          'Requested'
        )
        RETURNING id, beneficiary_id, amount, request_amount, status, request_date
      `;

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal request failed');
      assertPropStringOrNumber(withdrawal, 'id');
      assertPropStringOrNumber(withdrawal, 'beneficiary_id');
      assertPropStringOrNumber(withdrawal, 'amount');
      assertPropStringOrNumber(withdrawal, 'request_amount');
      assertPropString(withdrawal, 'status');
      assertPropDate(withdrawal, 'request_date');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        beneficiaryId: String(withdrawal.beneficiary_id),
        amount: String(withdrawal.amount),
        requestAmount: String(withdrawal.request_amount),
        status: withdrawal.status,
        requestDate: withdrawal.request_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformSendsWithdrawal(
    params: PlatformSendsWithdrawalParams,
  ): Promise<PlatformSendsWithdrawalResult> {
    const { withdrawalId, sentAmount, sentHash, sentDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE withdrawals
        SET sent_amount = ${sentAmount},
            sent_hash = ${sentHash},
            sent_date = ${sentDate.toISOString()},
            status = 'Sent'
        WHERE id = ${withdrawalId} AND status = 'Requested'
        RETURNING id, status, sent_amount, sent_hash, sent_date
      `;

      if (rows.length === 0) {
        throw new Error('Withdrawal send update failed');
      }

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal not found or update failed');
      assertPropStringOrNumber(withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertPropString(withdrawal, 'sent_hash');
      assertPropStringOrNumber(withdrawal, 'sent_amount');
      assertPropDate(withdrawal, 'sent_date');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        status: withdrawal.status,
        sentAmount: String(withdrawal.sent_amount),
        sentHash: withdrawal.sent_hash,
        sentDate: withdrawal.sent_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformConfirmsWithdrawal(
    params: PlatformConfirmsWithdrawalParams,
  ): Promise<PlatformConfirmsWithdrawalResult> {
    const { withdrawalId, confirmedDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE withdrawals
        SET confirmed_date = ${confirmedDate.toISOString()},
            status = 'Confirmed'
        WHERE id = ${withdrawalId} AND status = 'Sent'
        RETURNING id, status, confirmed_date
      `;

      if (rows.length === 0) {
        throw new Error('Withdrawal confirmation update failed');
      }

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal not found or update failed');
      assertPropStringOrNumber(withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertPropDate(withdrawal, 'confirmed_date');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        status: withdrawal.status,
        confirmedDate: withdrawal.confirmed_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformFailsWithdrawal(
    params: PlatformFailsWithdrawalParams,
  ): Promise<PlatformFailsWithdrawalResult> {
    const { withdrawalId, failedDate, failureReason } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE withdrawals
        SET failed_date = ${failedDate.toISOString()},
            failure_reason = ${failureReason},
            status = 'Failed'
        WHERE id = ${withdrawalId} AND status IN ('Requested', 'Sent')
        RETURNING id, status, failed_date, failure_reason
      `;

      if (rows.length === 0) {
        throw new Error('Withdrawal failure update failed');
      }

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal not found or update failed');
      assertPropStringOrNumber(withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertPropDate(withdrawal, 'failed_date');
      assertPropString(withdrawal, 'failure_reason');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        status: withdrawal.status,
        failedDate: withdrawal.failed_date,
        failureReason: withdrawal.failure_reason,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminApprovesWithdrawalRefund(
    params: AdminApprovesWithdrawalRefundParams,
  ): Promise<AdminApprovesWithdrawalRefundResult> {
    const { withdrawalId, reviewerUserId, approvalDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE withdrawals
        SET failure_refund_reviewer_user_id = ${reviewerUserId},
            failure_refund_approved_date = ${approvalDate.toISOString()},
            status = 'RefundApproved'
        WHERE id = ${withdrawalId} AND status = 'Failed'
        RETURNING id, status, failure_refund_approved_date
      `;

      if (rows.length === 0) {
        throw new Error('Withdrawal refund approval failed');
      }

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal not found or update failed');
      assertPropStringOrNumber(withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertPropDate(withdrawal, 'failure_refund_approved_date');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        status: withdrawal.status,
        failureRefundApprovedDate: withdrawal.failure_refund_approved_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminRejectsWithdrawalRefund(
    params: AdminRejectsWithdrawalRefundParams,
  ): Promise<AdminRejectsWithdrawalRefundResult> {
    const { withdrawalId, reviewerUserId, rejectionReason, rejectionDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE withdrawals
        SET failure_refund_reviewer_user_id = ${reviewerUserId},
            failure_refund_rejected_date = ${rejectionDate.toISOString()},
            failure_refund_rejection_reason = ${rejectionReason},
            status = 'RefundRejected'
        WHERE id = ${withdrawalId} AND status = 'Failed'
        RETURNING id, status, failure_refund_rejected_date
      `;

      if (rows.length === 0) {
        throw new Error('Withdrawal refund rejection failed');
      }

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal not found or update failed');
      assertPropStringOrNumber(withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertPropDate(withdrawal, 'failure_refund_rejected_date');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        status: withdrawal.status,
        failureRefundRejectedDate: withdrawal.failure_refund_rejected_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userViewsWithdrawalBeneficiaries(
    params: UserViewsWithdrawalBeneficiariesParams,
  ): Promise<UserViewsWithdrawalBeneficiariesResult> {
    const { userId } = params;

    const rows = await this.sql`
      SELECT
        id,
        user_id,
        blockchain_key,
        address
      FROM beneficiaries
      WHERE user_id = ${userId}
      ORDER BY blockchain_key, address
    `;

    const beneficiaries = rows;

    return {
      beneficiaries: beneficiaries.map(function (beneficiary: unknown) {
        assertDefined(beneficiary, 'Beneficiary record is undefined');
        assertPropStringOrNumber(beneficiary, 'id');
        assertPropStringOrNumber(beneficiary, 'user_id');
        assertPropString(beneficiary, 'blockchain_key');
        assertPropString(beneficiary, 'address');
        return {
          id: String(beneficiary.id),
          userId: String(beneficiary.user_id),
          blockchainKey: beneficiary.blockchain_key,
          address: beneficiary.address,
        };
      }),
    };
  }

  // Currency Management Methods
  async userViewsCurrencies(params: UserViewsCurrenciesParams): Promise<UserViewsCurrenciesResult> {
    const { type = 'all', blockchainKey, minLtv, maxLtv } = params;

    const rows = await this.sql`
      SELECT
        c.blockchain_key,
        c.token_id,
        c.name,
        c.symbol,
        c.decimals,
        c.image as logo_url,
        c.withdrawal_fee_rate,
        c.min_withdrawal_amount,
        c.max_withdrawal_amount,
        c.max_daily_withdrawal_amount,
        c.min_loan_principal_amount,
        c.max_loan_principal_amount,
        c.max_ltv,
        c.ltv_warning_threshold,
        c.ltv_critical_threshold,
        c.ltv_liquidation_threshold,
        b.key as blockchain_key_ref,
        b.name as blockchain_name,
        b.short_name as blockchain_short_name,
        b.image as blockchain_image
      FROM currencies c
      JOIN blockchains b ON c.blockchain_key = b.key
      WHERE (${blockchainKey}::text IS NULL OR c.blockchain_key = ${blockchainKey})
        AND (${minLtv}::numeric IS NULL OR c.max_ltv >= ${minLtv})
        AND (${maxLtv}::numeric IS NULL OR c.max_ltv <= ${maxLtv})
        AND (
          ${type}::text = 'all' OR
          (${type}::text = 'collateral' AND c.max_ltv > 0) OR
          (${type}::text = 'loan' AND c.symbol IN ('USDC', 'USDT', 'USD') AND c.max_ltv = 0)
        )
      ORDER BY
        CASE
          WHEN c.max_ltv > 0 THEN 0  -- Collateral currencies first
          ELSE 1                     -- Loan currencies second
        END,
        c.blockchain_key,
        c.token_id
    `;

    const currencies = rows;

    return {
      currencies: currencies.map(function (currency: unknown) {
        assertDefined(currency, 'Currency record is undefined');
        assertPropString(currency, 'blockchain_key');
        assertPropString(currency, 'token_id');
        assertPropString(currency, 'name');
        assertPropString(currency, 'symbol');
        assertPropStringOrNumber(currency, 'decimals');
        assertPropString(currency, 'logo_url');
        assertPropStringOrNumber(currency, 'withdrawal_fee_rate');
        assertPropStringOrNumber(currency, 'min_withdrawal_amount');
        assertPropStringOrNumber(currency, 'max_withdrawal_amount');
        assertPropStringOrNumber(currency, 'max_daily_withdrawal_amount');
        assertPropStringOrNumber(currency, 'min_loan_principal_amount');
        assertPropStringOrNumber(currency, 'max_loan_principal_amount');
        assertPropStringOrNumber(currency, 'max_ltv');
        assertPropStringOrNumber(currency, 'ltv_warning_threshold');
        assertPropStringOrNumber(currency, 'ltv_critical_threshold');
        assertPropStringOrNumber(currency, 'ltv_liquidation_threshold');
        assertPropString(currency, 'blockchain_key_ref');
        assertPropString(currency, 'blockchain_name');
        assertPropString(currency, 'blockchain_short_name');
        assertPropString(currency, 'blockchain_image');

        // Determine currency type based on configuration
        const maxLtv = Number(currency.max_ltv);
        const isCollateralCurrency = maxLtv > 0;
        // USDT/USDC currencies are loan currencies (based on SRS - loans only in USDT form)
        const isLoanCurrency =
          (currency.symbol === 'USDC' || currency.symbol === 'USDT' || currency.symbol === 'USD') &&
          maxLtv === 0;

        return {
          blockchainKey: currency.blockchain_key,
          tokenId: currency.token_id,
          name: currency.name,
          symbol: currency.symbol,
          decimals: Number(currency.decimals),
          logoUrl: currency.logo_url,
          isCollateralCurrency,
          isLoanCurrency,
          maxLtv: Number(currency.max_ltv),
          ltvWarningThreshold: Number(currency.ltv_warning_threshold),
          ltvCriticalThreshold: Number(currency.ltv_critical_threshold),
          ltvLiquidationThreshold: Number(currency.ltv_liquidation_threshold),
          minLoanPrincipalAmount: String(currency.min_loan_principal_amount),
          maxLoanPrincipalAmount: String(currency.max_loan_principal_amount),
          minWithdrawalAmount: String(currency.min_withdrawal_amount),
          maxWithdrawalAmount: String(currency.max_withdrawal_amount),
          maxDailyWithdrawalAmount: String(currency.max_daily_withdrawal_amount),
          withdrawalFeeRate: Number(currency.withdrawal_fee_rate),
          blockchain: {
            key: currency.blockchain_key_ref,
            name: currency.blockchain_name,
            shortName: currency.blockchain_short_name,
            image: currency.blockchain_image,
          },
        };
      }),
    };
  }

  // Platform Configuration Methods
  async platformRetrievesProvisionRate(): Promise<PlatformRetrievesProvisionRateResult> {
    const rows = await this.sql`
      SELECT 
        loan_provision_rate,
        effective_date
      FROM platform_configs
      ORDER BY effective_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new Error('Platform configuration not found');
    }

    const config = rows[0];
    assertDefined(config, 'Platform configuration is undefined');
    assertPropStringOrNumber(config, 'loan_provision_rate');
    assertPropDate(config, 'effective_date');

    return {
      loanProvisionRate: String(config.loan_provision_rate),
      effectiveDate: config.effective_date,
    };
  }

  // Minimal test helpers for test suite only
  async systemCreatesTestUsers(params: {
    users: Array<{ email: string; name: string; role?: string }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      const createdUsers: Array<{ id: string; email: string; name: string; role: string }> = [];
      for (const user of params.users) {
        const result = await this.sql`
          INSERT INTO users (email, email_verified_date, role, user_type, name)
          VALUES (${user.email}, ${new Date()}, ${user.role ?? 'User'}, 'Individual', ${user.name})
          RETURNING id, email, name, role
        `;
        const row = result[0] as { id: number; email: string; name: string; role: string };
        createdUsers.push({
          id: String(row.id),
          email: row.email,
          name: row.name,
          role: row.role,
        });
      }
      await tx.commitTransaction();
      return { users: createdUsers };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async testCreatesAccountMutations(params: {
    accountId: string;
    mutations: Array<{ mutationType: string; mutationDate: string; amount: string }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const mutation of params.mutations) {
        await this.sql`
          INSERT INTO account_mutations (account_id, mutation_type, mutation_date, amount)
          VALUES (${params.accountId}, ${mutation.mutationType}, ${mutation.mutationDate}, ${mutation.amount})
        `;
      }
      await tx.commitTransaction();
      return { mutationsCreated: params.mutations.length };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }
  async systemCreatesTestBlockchains(params: {
    blockchains: Array<{ key: string; name: string; shortName: string; image: string }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const blockchain of params.blockchains) {
        await this.sql`
          INSERT INTO blockchains (key, name, short_name, image)
          VALUES (${blockchain.key}, ${blockchain.name}, ${blockchain.shortName}, ${blockchain.image})
          ON CONFLICT (key) DO NOTHING
        `;
      }
      await tx.commitTransaction();
      return { blockchainsCreated: params.blockchains.length };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async systemCreatesTestCurrencies(params: {
    currencies: Array<{
      blockchainKey: string;
      tokenId: string;
      name: string;
      symbol: string;
      decimals: number;
      image: string;
    }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const currency of params.currencies) {
        await this.sql`
          INSERT INTO currencies (blockchain_key, token_id, name, symbol, decimals, image)
          VALUES (${currency.blockchainKey}, ${currency.tokenId}, ${currency.name}, ${currency.symbol}, ${currency.decimals}, ${currency.image})
          ON CONFLICT (blockchain_key, token_id) DO NOTHING
        `;
      }
      await tx.commitTransaction();
      return { currenciesCreated: params.currencies.length };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }
}
