import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropNullableString,
  assertPropString,
  check,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import {
  ActiveInvoiceRecord,
  BlockchainDetectsInvoicePaymentParams,
  BlockchainDetectsInvoicePaymentResult,
  PlatformConfirmsWithdrawalParams,
  PlatformConfirmsWithdrawalResult,
  PlatformFailsWithdrawalParams,
  PlatformFailsWithdrawalResult,
  PlatformRetrievesProvisionRateResult,
  PlatformSendsWithdrawalParams,
  PlatformSendsWithdrawalResult,
  PlatformSetActiveButExpiredInvoiceAsExpiredParams,
  PlatformSetActiveButExpiredInvoiceAsExpiredResult,
  PlatformViewsActiveButExpiredInvoicesParams,
  PlatformViewsActiveButExpiredInvoicesResult,
  PlatformViewsActiveInvoicesParams,
  UpdateWithdrawalStatusParams,
  UpdateWithdrawalStatusResult,
} from './finance.types';
import { FinanceAdminRepository } from './finance-admin.repository';

export abstract class FinancePlatformRepository extends FinanceAdminRepository {
  async platformViewsActiveInvoices(
    params: PlatformViewsActiveInvoicesParams = {},
  ): Promise<ActiveInvoiceRecord[]> {
    const { blockchainKey, limit = 1000, offset = 0 } = params;

    if (limit <= 0) {
      throw new Error('limit must be greater than zero');
    }

    if (offset < 0) {
      throw new Error('offset cannot be negative');
    }

    const queryFragments: string[] = [
      `SELECT
        id,
        user_id,
        wallet_address,
        wallet_derivation_path,
        currency_blockchain_key,
        currency_token_id,
        account_blockchain_key,
        account_token_id,
        invoice_type,
        status,
        invoiced_amount,
        prepaid_amount,
        paid_amount,
        due_date,
        expired_date
      FROM invoices
      WHERE (
        status IN ('Pending', 'PartiallyPaid', 'Overdue')
        OR (status = 'Expired' AND paid_amount < invoiced_amount)
      )
      AND wallet_address IS NOT NULL`,
    ];

    const sqlParams: Array<string | number> = [];

    if (blockchainKey) {
      sqlParams.push(blockchainKey);
      queryFragments.push(`AND currency_blockchain_key = $${sqlParams.length}`);
    }

    sqlParams.push(limit);
    queryFragments.push(`ORDER BY id ASC LIMIT $${sqlParams.length}`);

    sqlParams.push(offset);
    queryFragments.push(`OFFSET $${sqlParams.length}`);

    const query = queryFragments.join('\n');

    const rows = await this.rawQuery(query, sqlParams);
    const activeInvoices: ActiveInvoiceRecord[] = [];

    assertArrayMapOf(rows, row => {
      assertDefined(row, 'Active invoice row is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'user_id');
      assertPropString(row, 'wallet_address');
      assertPropString(row, 'wallet_derivation_path');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertPropNullableString(row, 'account_blockchain_key');
      assertPropNullableString(row, 'account_token_id');
      assertPropString(row, 'invoice_type');
      assertPropString(row, 'status');
      assertProp(check(isString, isNumber), row, 'invoiced_amount');
      assertProp(check(isString, isNumber), row, 'prepaid_amount');
      assertProp(check(isString, isNumber), row, 'paid_amount');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'due_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'expired_date');

      activeInvoices.push({
        id: String(row.id),
        userId: String(row.user_id),
        walletAddress: row.wallet_address as string,
        walletDerivationPath: row.wallet_derivation_path as string,
        currencyBlockchainKey: row.currency_blockchain_key as string,
        currencyTokenId: row.currency_token_id as string,
        accountBlockchainKey: (row.account_blockchain_key as string | null) ?? null,
        accountTokenId: (row.account_token_id as string | null) ?? null,
        invoiceType: row.invoice_type as string,
        status: row.status as string,
        invoicedAmount: String(row.invoiced_amount),
        prepaidAmount: String(row.prepaid_amount),
        paidAmount: String(row.paid_amount),
        dueDate: row.due_date as Date | null,
        expiredDate: row.expired_date as Date | null,
      });

      return row;
    });

    return activeInvoices;
  }

  async platformRecordInvoicePayment(
    params: BlockchainDetectsInvoicePaymentParams,
  ): Promise<BlockchainDetectsInvoicePaymentResult> {
    const { walletAddress, paymentHash, amount, paymentDate } = params;

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
          (SELECT id FROM invoices WHERE wallet_address = ${walletAddress} ORDER BY id LIMIT 1),
          ${paymentHash},
          ${amount},
          ${paymentDate.toISOString()}
        )
        RETURNING id, invoice_id, payment_hash, amount, payment_date
      `;

      const payment = rows[0];
      assertDefined(payment, 'Invoice payment recording failed');
      assertProp(check(isString, isNumber), payment, 'id');
      assertProp(check(isString, isNumber), payment, 'invoice_id');
      assertPropString(payment, 'payment_hash');
      assertProp(check(isString, isNumber), payment, 'amount');
      assertProp(isInstanceOf(Date), payment, 'payment_date');

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
    assertProp(check(isString, isNumber), countRow, 'total');
    const totalCount = Number(countRow.total);

    const rows = await this.sql`
      SELECT
        id,
        user_id,
        currency_blockchain_key,
        currency_token_id,
        invoiced_amount,
        paid_amount,
        wallet_derivation_path,
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
        assertProp(check(isString, isNumber), invoice, 'id');
        assertProp(check(isString, isNumber), invoice, 'user_id');
        assertPropString(invoice, 'currency_blockchain_key');
        assertPropString(invoice, 'currency_token_id');
        assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
        assertProp(check(isString, isNumber), invoice, 'paid_amount');
        assertPropString(invoice, 'wallet_derivation_path');
        assertPropString(invoice, 'wallet_address');
        assertPropString(invoice, 'invoice_type');
        assertPropString(invoice, 'status');
        assertProp(isInstanceOf(Date), invoice, 'invoice_date');
        assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'due_date');
        assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'expired_date');
        return {
          id: String(invoice.id),
          userId: String(invoice.user_id),
          currencyBlockchainKey: invoice.currency_blockchain_key,
          currencyTokenId: invoice.currency_token_id,
          invoicedAmount: String(invoice.invoiced_amount),
          paidAmount: String(invoice.paid_amount),
          walletDerivationPath: invoice.wallet_derivation_path,
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
      assertProp(check(isString, isNumber), invoice, 'id');
      assertPropString(invoice, 'status');
      assertProp(isInstanceOf(Date), invoice, 'expired_date');

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
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertPropString(withdrawal, 'sent_hash');
      assertProp(check(isString, isNumber), withdrawal, 'sent_amount');
      assertProp(isInstanceOf(Date), withdrawal, 'sent_date');

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
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertProp(isInstanceOf(Date), withdrawal, 'confirmed_date');

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
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertProp(isInstanceOf(Date), withdrawal, 'failed_date');
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
    assertProp(check(isString, isNumber), config, 'loan_provision_rate');
    assertProp(isInstanceOf(Date), config, 'effective_date');

    return {
      loanProvisionRate: String(config.loan_provision_rate),
      effectiveDate: config.effective_date,
    };
  }

  async platformUpdatesWithdatawalStatus(
    params: UpdateWithdrawalStatusParams,
  ): Promise<UpdateWithdrawalStatusResult> {
    const { withdrawalId, status, refundRequestedDate } = params;

    const updateRows = await this.sql`
      UPDATE withdrawals
      SET status = ${status},
          refund_requested_date = ${refundRequestedDate ? refundRequestedDate.toISOString() : null}
      WHERE id = ${withdrawalId}
      RETURNING id, status
    `;

    if (updateRows.length === 0) {
      throw new Error('Withdrawal not found or update failed');
    }

    const result = updateRows[0] as { id: string; status: string };
    return { id: result.id, status: result.status };
  }
}
