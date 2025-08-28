import {
  assertArrayOf,
  assertDefined,
  assertPropDate,
  assertPropDefined,
  assertPropNullableDate,
  assertPropNullableString,
  assertPropString,
  assertPropStringOrNumber,
  setAssertPropValue,
} from '../utils/assertions';
import { unknownErrorToString } from '../utils/error';
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
  PlatformRetrievesExchangeRatesParams,
  PlatformRetrievesExchangeRatesResult,
  PlatformSendsWithdrawalParams,
  PlatformSendsWithdrawalResult,
  PlatformUpdatesExchangeRateParams,
  PlatformUpdatesExchangeRateResult,
  PlatformUpdatesInvoiceStatusParams,
  PlatformUpdatesInvoiceStatusResult,
  UserRegistersWithdrawalBeneficiaryParams,
  UserRegistersWithdrawalBeneficiaryResult,
  UserRequestsWithdrawalParams,
  UserRequestsWithdrawalResult,
  UserRetrievesAccountBalancesParams,
  UserRetrievesAccountBalancesResult,
  UserViewsAccountTransactionHistoryParams,
  UserViewsAccountTransactionHistoryResult,
  UserViewsInvoiceDetailsParams,
  UserViewsInvoiceDetailsResult,
  UserViewsWithdrawalBeneficiariesParams,
  UserViewsWithdrawalBeneficiariesResult,
} from './finance-type';
import { UserRepository } from './user-repository';

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
        assertPropStringOrNumber(
          account,
          'id',
          `Expect account id to string or number, got ${unknownErrorToString(account)}`,
        );
        assertPropStringOrNumber(
          account,
          'user_id',
          `Expect account user_id to string or number, got ${unknownErrorToString(account)}`,
        );
        assertPropString(
          account,
          'currency_blockchain_key',
          `Expect account currency_blockchain_key to string, got ${unknownErrorToString(account)}`,
        );
        assertPropString(
          account,
          'currency_token_id',
          `Expect account currency_token_id to string, got ${unknownErrorToString(account)}`,
        );
        assertPropStringOrNumber(
          account,
          'balance',
          `Expect account balance to string or number, got ${unknownErrorToString(account)}`,
        );
        assertPropString(
          account,
          'account_type',
          `Expect account account_type to string, got ${unknownErrorToString(account)}`,
        );
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
    assertPropStringOrNumber(
      countRow,
      'total',
      `Expect total to be string or number, got ${unknownErrorToString(countRow)}`,
    );
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
        assertPropStringOrNumber(
          mutation,
          'id',
          `Expect mutation id to string or number, got ${unknownErrorToString(mutation)}`,
        );
        assertPropStringOrNumber(
          mutation,
          'account_id',
          `Expect mutation account_id to string or number, got ${unknownErrorToString(mutation)}`,
        );
        assertPropString(
          mutation,
          'mutation_type',
          `Expect mutation mutation_type to string, got ${unknownErrorToString(mutation)}`,
        );
        assertPropDate(
          mutation,
          'mutation_date',
          `Expect mutation mutation_date to be Date, got ${unknownErrorToString(mutation)}`,
        );
        assertPropStringOrNumber(
          mutation,
          'amount',
          `Expect mutation amount to string or number, got ${unknownErrorToString(mutation)}`,
        );
        assertPropNullableString(
          mutation,
          'invoice_id',
          `Expect mutation invoice_id to be string or null, got ${unknownErrorToString(mutation)}`,
        );
        assertPropNullableString(
          mutation,
          'withdrawal_id',
          `Expect mutation withdrawal_id to be string or null, got ${unknownErrorToString(mutation)}`,
        );
        assertPropNullableString(
          mutation,
          'invoice_payment_id',
          `Expect mutation invoice_payment_id to be string or null, got ${unknownErrorToString(mutation)}`,
        );
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

  async platformCreatesUserAccount(
    params: PlatformCreatesUserAccountParams,
  ): Promise<PlatformCreatesUserAccountResult> {
    const { userId, currencyBlockchainKey, currencyTokenId, accountType = 'user' } = params;

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
      assertPropStringOrNumber(
        account,
        'id',
        `Expect account id to string or number, got ${unknownErrorToString(account)}`,
      );
      assertPropStringOrNumber(
        account,
        'user_id',
        `Expect account user_id to string or number, got ${unknownErrorToString(account)}`,
      );
      assertPropString(
        account,
        'currency_blockchain_key',
        `Expect account currency_blockchain_key to string, got ${unknownErrorToString(account)}`,
      );
      assertPropString(
        account,
        'currency_token_id',
        `Expect account currency_token_id to string, got ${unknownErrorToString(account)}`,
      );
      assertPropStringOrNumber(
        account,
        'balance',
        `Expect account balance to string or number, got ${unknownErrorToString(account)}`,
      );
      assertPropString(
        account,
        'account_type',
        `Expect account account_type to string, got ${unknownErrorToString(account)}`,
      );

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
  async platformCreatesInvoice(
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
          ${dueDate?.toISOString()}
        )
        RETURNING id, user_id, wallet_address, invoice_type, status, invoiced_amount, paid_amount, invoice_date, due_date
      `;

      const invoice = rows[0];
      assertDefined(invoice, 'Invoice creation failed');
      assertPropStringOrNumber(
        invoice,
        'id',
        `Expect invoice id to string or number, got ${unknownErrorToString(invoice)}`,
      );
      assertPropStringOrNumber(
        invoice,
        'user_id',
        `Expect invoice user_id to string or number, got ${unknownErrorToString(invoice)}`,
      );
      assertPropString(
        invoice,
        'wallet_address',
        `Expect invoice wallet_address to string, got ${unknownErrorToString(invoice)}`,
      );
      assertPropString(
        invoice,
        'invoice_type',
        `Expect invoice invoice_type to string, got ${unknownErrorToString(invoice)}`,
      );
      assertPropString(
        invoice,
        'status',
        `Expect invoice status to string, got ${unknownErrorToString(invoice)}`,
      );
      assertPropStringOrNumber(
        invoice,
        'invoiced_amount',
        `Expect invoice invoiced_amount to string or number, got ${unknownErrorToString(invoice)}`,
      );
      assertPropStringOrNumber(
        invoice,
        'paid_amount',
        `Expect invoice paid_amount to string or number, got ${unknownErrorToString(invoice)}`,
      );
      assertPropDate(
        invoice,
        'invoice_date',
        `Expect invoice invoice_date to be Date, got ${unknownErrorToString(invoice)}`,
      );
      assertPropNullableDate(
        invoice,
        'due_date',
        `Expect invoice due_date to be Date or null, got ${unknownErrorToString(invoice)}`,
      );

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
      assertPropStringOrNumber(
        payment,
        'id',
        `Expect payment id to string or number, got ${unknownErrorToString(payment)}`,
      );
      assertPropStringOrNumber(
        payment,
        'invoice_id',
        `Expect payment invoice_id to string or number, got ${unknownErrorToString(payment)}`,
      );
      assertPropString(
        payment,
        'payment_hash',
        `Expect payment payment_hash to string, got ${unknownErrorToString(payment)}`,
      );
      assertPropStringOrNumber(
        payment,
        'amount',
        `Expect payment amount to string or number, got ${unknownErrorToString(payment)}`,
      );
      assertPropDate(
        payment,
        'payment_date',
        `Expect payment payment_date to be Date, got ${unknownErrorToString(payment)}`,
      );

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

  async platformUpdatesInvoiceStatus(
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
      assertPropStringOrNumber(
        invoice,
        'id',
        `Expect invoice id to string or number, got ${unknownErrorToString(invoice)}`,
      );
      assertPropString(
        invoice,
        'status',
        `Expect invoice status to string, got ${unknownErrorToString(invoice)}`,
      );
      assertPropDate(
        invoice,
        'expired_date',
        `Expect invoice expired_date to be Date or null, got ${unknownErrorToString(invoice)}`,
      );
      assertPropDate(
        invoice,
        'notified_date',
        `Expect invoice notified_date to be Date or null, got ${unknownErrorToString(invoice)}`,
      );

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
    assertPropStringOrNumber(
      invoice,
      'id',
      `Expect invoice id to string or number, got ${unknownErrorToString(invoice)}`,
    );
    assertPropStringOrNumber(
      invoice,
      'user_id',
      `Expect invoice user_id to string or number, got ${unknownErrorToString(invoice)}`,
    );
    assertPropString(
      invoice,
      'currency_blockchain_key',
      `Expect invoice currency_blockchain_key to string, got ${unknownErrorToString(invoice)}`,
    );
    assertPropString(
      invoice,
      'currency_token_id',
      `Expect invoice currency_token_id to string, got ${unknownErrorToString(invoice)}`,
    );
    assertPropString(
      invoice,
      'wallet_address',
      `Expect invoice wallet_address to string, got ${unknownErrorToString(invoice)}`,
    );
    assertPropString(
      invoice,
      'invoice_type',
      `Expect invoice invoice_type to string, got ${unknownErrorToString(invoice)}`,
    );
    assertPropString(
      invoice,
      'status',
      `Expect invoice status to string, got ${unknownErrorToString(invoice)}`,
    );
    assertPropStringOrNumber(
      invoice,
      'invoiced_amount',
      `Expect invoice invoiced_amount to string or number, got ${unknownErrorToString(invoice)}`,
    );
    assertPropStringOrNumber(
      invoice,
      'paid_amount',
      `Expect invoice paid_amount to string or number, got ${unknownErrorToString(invoice)}`,
    );
    assertPropDate(
      invoice,
      'invoice_date',
      `Expect invoice invoice_date to be Date, got ${unknownErrorToString(invoice)}`,
    );
    assertPropNullableDate(
      invoice,
      'due_date',
      `Expect invoice due_date to be Date or null, got ${unknownErrorToString(invoice)}`,
    );
    assertPropNullableDate(
      invoice,
      'expired_date',
      `Expect invoice expired_date to be Date or null, got ${unknownErrorToString(invoice)}`,
    );
    assertPropNullableDate(
      invoice,
      'paid_date',
      `Expect invoice paid_date to be Date or null, got ${unknownErrorToString(invoice)}`,
    );

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

  // Withdrawal Management Methods
  async userRegistersWithdrawalBeneficiary(
    params: UserRegistersWithdrawalBeneficiaryParams,
  ): Promise<UserRegistersWithdrawalBeneficiaryResult> {
    const { userId, currencyBlockchainKey, currencyTokenId, address } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO beneficiaries (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          address
        )
        VALUES (
          ${userId},
          ${currencyBlockchainKey},
          ${currencyTokenId},
          ${address}
        )
        RETURNING id, user_id, currency_blockchain_key, currency_token_id, address
      `;

      const beneficiary = rows[0];
      assertDefined(beneficiary, 'Beneficiary registration failed');
      assertPropStringOrNumber(
        beneficiary,
        'id',
        `Expect beneficiary id to string or number, got ${unknownErrorToString(beneficiary)}`,
      );
      assertPropStringOrNumber(
        beneficiary,
        'user_id',
        `Expect beneficiary user_id to string or number, got ${unknownErrorToString(beneficiary)}`,
      );
      assertPropString(
        beneficiary,
        'currency_blockchain_key',
        `Expect beneficiary currency_blockchain_key to string, got ${unknownErrorToString(beneficiary)}`,
      );
      assertPropString(
        beneficiary,
        'currency_token_id',
        `Expect beneficiary currency_token_id to string, got ${unknownErrorToString(beneficiary)}`,
      );
      assertPropString(
        beneficiary,
        'address',
        `Expect beneficiary address to string, got ${unknownErrorToString(beneficiary)}`,
      );

      await tx.commitTransaction();

      return {
        id: String(beneficiary.id),
        userId: String(beneficiary.user_id),
        currencyBlockchainKey: beneficiary.currency_blockchain_key,
        currencyTokenId: beneficiary.currency_token_id,
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
    const { beneficiaryId, amount, requestDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO withdrawals (
          beneficiary_id,
          amount,
          request_amount,
          request_date,
          status
        )
        VALUES (
          ${beneficiaryId},
          ${amount},
          ${amount},
          ${requestDate.toISOString()},
          'Requested'
        )
        RETURNING id, beneficiary_id, amount, request_amount, status, request_date
      `;

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal request failed');
      assertPropStringOrNumber(
        withdrawal,
        'id',
        `Expect withdrawal id to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropStringOrNumber(
        withdrawal,
        'beneficiary_id',
        `Expect withdrawal beneficiary_id to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropStringOrNumber(
        withdrawal,
        'amount',
        `Expect withdrawal amount to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropStringOrNumber(
        withdrawal,
        'request_amount',
        `Expect withdrawal request_amount to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'status',
        `Expect withdrawal status to string, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropDate(
        withdrawal,
        'request_date',
        `Expect withdrawal request_date to be Date, got ${unknownErrorToString(withdrawal)}`,
      );

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
      assertPropStringOrNumber(
        withdrawal,
        'id',
        `Expect withdrawal id to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'status',
        `Expect withdrawal status to string, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'sent_hash',
        `Expect withdrawal sent_hash to string, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropStringOrNumber(
        withdrawal,
        'sent_amount',
        `Expect withdrawal sent_amount to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropDate(
        withdrawal,
        'sent_date',
        `Expect withdrawal sent_date to be Date, got ${unknownErrorToString(withdrawal)}`,
      );

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
      assertPropStringOrNumber(
        withdrawal,
        'id',
        `Expect withdrawal id to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'status',
        `Expect withdrawal status to string, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropDate(
        withdrawal,
        'confirmed_date',
        `Expect withdrawal confirmed_date to be Date, got ${unknownErrorToString(withdrawal)}`,
      );

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
      assertPropStringOrNumber(
        withdrawal,
        'id',
        `Expect withdrawal id to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'status',
        `Expect withdrawal status to string, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropDate(
        withdrawal,
        'failed_date',
        `Expect withdrawal failed_date to be Date, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'failure_reason',
        `Expect withdrawal failure_reason to string, got ${unknownErrorToString(withdrawal)}`,
      );

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
      assertPropStringOrNumber(
        withdrawal,
        'id',
        `Expect withdrawal id to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'status',
        `Expect withdrawal status to string, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropDate(
        withdrawal,
        'failure_refund_approved_date',
        `Expect withdrawal failure_refund_approved_date to be Date, got ${unknownErrorToString(withdrawal)}`,
      );

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
      assertPropStringOrNumber(
        withdrawal,
        'id',
        `Expect withdrawal id to string or number, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropString(
        withdrawal,
        'status',
        `Expect withdrawal status to string, got ${unknownErrorToString(withdrawal)}`,
      );
      assertPropDate(
        withdrawal,
        'failure_refund_rejected_date',
        `Expect withdrawal failure_refund_rejected_date to be Date, got ${unknownErrorToString(withdrawal)}`,
      );

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
        currency_blockchain_key,
        currency_token_id,
        address
      FROM beneficiaries
      WHERE user_id = ${userId}
      ORDER BY currency_blockchain_key, currency_token_id, address
    `;

    const beneficiaries = rows;

    return {
      beneficiaries: beneficiaries.map(function (beneficiary: unknown) {
        assertDefined(beneficiary, 'Beneficiary record is undefined');
        assertPropStringOrNumber(
          beneficiary,
          'id',
          `Expect beneficiary id to string or number, got ${unknownErrorToString(beneficiary)}`,
        );
        assertPropStringOrNumber(
          beneficiary,
          'user_id',
          `Expect beneficiary user_id to string or number, got ${unknownErrorToString(beneficiary)}`,
        );
        assertPropString(
          beneficiary,
          'currency_blockchain_key',
          `Expect beneficiary currency_blockchain_key to string, got ${unknownErrorToString(beneficiary)}`,
        );
        assertPropString(
          beneficiary,
          'currency_token_id',
          `Expect beneficiary currency_token_id to string, got ${unknownErrorToString(beneficiary)}`,
        );
        assertPropString(
          beneficiary,
          'address',
          `Expect beneficiary address to string, got ${unknownErrorToString(beneficiary)}`,
        );
        return {
          id: String(beneficiary.id),
          userId: String(beneficiary.user_id),
          currencyBlockchainKey: beneficiary.currency_blockchain_key,
          currencyTokenId: beneficiary.currency_token_id,
          address: beneficiary.address,
        };
      }),
    };
  }

  // Exchange Rate Management Methods
  async platformRetrievesExchangeRates(
    params: PlatformRetrievesExchangeRatesParams,
  ): Promise<PlatformRetrievesExchangeRatesResult> {
    const { blockchainKey, baseCurrencyTokenId, quoteCurrencyTokenId } = params;

    const rows = await this.sql`
      SELECT 
        er.id,
        er.price_feed_id,
        er.bid_price,
        er.ask_price,
        er.retrieval_date,
        er.source_date,
        pf.blockchain_key,
        pf.base_currency_token_id,
        pf.quote_currency_token_id,
        pf.source
      FROM exchange_rates er
      JOIN price_feeds pf ON er.price_feed_id = pf.id
      WHERE (${blockchainKey}::text IS NULL OR pf.blockchain_key = ${blockchainKey})
        AND (${baseCurrencyTokenId}::text IS NULL OR pf.base_currency_token_id = ${baseCurrencyTokenId})
        AND (${quoteCurrencyTokenId}::text IS NULL OR pf.quote_currency_token_id = ${quoteCurrencyTokenId})
      ORDER BY er.retrieval_date DESC
    `;

    const exchangeRates = rows;

    return {
      exchangeRates: exchangeRates.map(function (rate: unknown) {
        assertDefined(rate, 'Exchange rate record is undefined');
        assertPropStringOrNumber(
          rate,
          'id',
          `Expect rate id to string or number, got ${unknownErrorToString(rate)}`,
        );
        assertPropStringOrNumber(
          rate,
          'price_feed_id',
          `Expect rate price_feed_id to string or number, got ${unknownErrorToString(rate)}`,
        );
        assertPropStringOrNumber(
          rate,
          'bid_price',
          `Expect rate bid_price to string or number, got ${unknownErrorToString(rate)}`,
        );
        assertPropStringOrNumber(
          rate,
          'ask_price',
          `Expect rate ask_price to string or number, got ${unknownErrorToString(rate)}`,
        );
        assertPropDate(
          rate,
          'retrieval_date',
          `Expect rate retrieval_date to be Date, got ${unknownErrorToString(rate)}`,
        );
        assertPropDate(
          rate,
          'source_date',
          `Expect rate source_date to be Date, got ${unknownErrorToString(rate)}`,
        );
        assertPropString(
          rate,
          'blockchain_key',
          `Expect rate blockchain_key to string, got ${unknownErrorToString(rate)}`,
        );
        assertPropString(
          rate,
          'base_currency_token_id',
          `Expect rate base_currency_token_id to string, got ${unknownErrorToString(rate)}`,
        );
        assertPropString(
          rate,
          'quote_currency_token_id',
          `Expect rate quote_currency_token_id to string, got ${unknownErrorToString(rate)}`,
        );
        assertPropString(
          rate,
          'source',
          `Expect rate source to string, got ${unknownErrorToString(rate)}`,
        );
        return {
          id: String(rate.id),
          priceFeedId: String(rate.price_feed_id),
          bidPrice: String(rate.bid_price),
          askPrice: String(rate.ask_price),
          retrievalDate: rate.retrieval_date,
          sourceDate: rate.source_date,
          blockchain: rate.blockchain_key,
          baseCurrency: rate.base_currency_token_id,
          quoteCurrency: rate.quote_currency_token_id,
          source: rate.source,
        };
      }),
    };
  }

  async platformUpdatesExchangeRate(
    params: PlatformUpdatesExchangeRateParams,
  ): Promise<PlatformUpdatesExchangeRateResult> {
    const { priceFeedId, bidPrice, askPrice, retrievalDate, sourceDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO exchange_rates (
          price_feed_id,
          bid_price,
          ask_price,
          retrieval_date,
          source_date
        )
        VALUES (
          ${priceFeedId},
          ${bidPrice},
          ${askPrice},
          ${retrievalDate.toISOString()},
          ${sourceDate.toISOString()}
        )
        RETURNING id, price_feed_id, bid_price, ask_price, retrieval_date, source_date
      `;

      const exchangeRate = rows[0];
      assertDefined(exchangeRate, 'Exchange rate update failed');
      assertPropStringOrNumber(
        exchangeRate,
        'id',
        `Expect exchange rate id to string or number, got ${unknownErrorToString(exchangeRate)}`,
      );
      assertPropStringOrNumber(
        exchangeRate,
        'price_feed_id',
        `Expect exchange rate price_feed_id to string or number, got ${unknownErrorToString(exchangeRate)}`,
      );
      assertPropStringOrNumber(
        exchangeRate,
        'bid_price',
        `Expect exchange rate bid_price to string or number, got ${unknownErrorToString(exchangeRate)}`,
      );
      assertPropStringOrNumber(
        exchangeRate,
        'ask_price',
        `Expect exchange rate ask_price to string or number, got ${unknownErrorToString(exchangeRate)}`,
      );
      assertPropDate(
        exchangeRate,
        'retrieval_date',
        `Expect exchange rate retrieval_date to be Date, got ${unknownErrorToString(exchangeRate)}`,
      );
      assertPropDate(
        exchangeRate,
        'source_date',
        `Expect exchange rate source_date to be Date, got ${unknownErrorToString(exchangeRate)}`,
      );

      await tx.commitTransaction();

      return {
        id: String(exchangeRate.id),
        priceFeedId: String(exchangeRate.price_feed_id),
        bidPrice: String(exchangeRate.bid_price),
        askPrice: String(exchangeRate.ask_price),
        retrievalDate: exchangeRate.retrieval_date,
        sourceDate: exchangeRate.source_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Minimal test helpers for test suite only
  async systemCreatesTestUsers(params: {
    users: Array<{ id: string; email: string; name: string; role?: string }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const user of params.users) {
        await this.sql`
          INSERT INTO users (id, email, email_verified, role, user_type, name)
          VALUES (${user.id}, ${user.email}, true, ${user.role ?? 'User'}, 'Individual', ${user.name})
          ON CONFLICT (id) DO UPDATE SET 
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            role = EXCLUDED.role
        `;
      }
      await tx.commitTransaction();
      return { usersCreated: params.users.length };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async systemCreatesTestAccountMutations(params: {
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

  async systemCreatesTestPriceFeeds(params: {
    priceFeeds: Array<{
      blockchainKey: string;
      baseCurrencyTokenId: string;
      quoteCurrencyTokenId: string;
      source: string;
    }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const pf of params.priceFeeds) {
        await this.sql`
          INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
          VALUES (${pf.blockchainKey}, ${pf.baseCurrencyTokenId}, ${pf.quoteCurrencyTokenId}, ${pf.source})
        `;
      }
      await tx.commitTransaction();
      return { priceFeedsCreated: params.priceFeeds.length };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async systemCreatesTestExchangeRates(params: {
    exchangeRates: Array<{
      priceFeedId: string;
      bidPrice: string;
      askPrice: string;
      retrievalDate: string;
      sourceDate: string;
    }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const er of params.exchangeRates) {
        await this.sql`
          INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
          VALUES (${er.priceFeedId}, ${er.bidPrice}, ${er.askPrice}, ${er.retrievalDate}, ${er.sourceDate})
        `;
      }
      await tx.commitTransaction();
      return { exchangeRatesCreated: params.exchangeRates.length };
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

  async systemFindsTestPriceFeedId(params: {
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
  }) {
    const rows = await this.sql`
      SELECT id FROM price_feeds 
      WHERE blockchain_key = ${params.blockchainKey} 
      AND base_currency_token_id = ${params.baseCurrencyTokenId} 
      AND quote_currency_token_id = ${params.quoteCurrencyTokenId}
    `;

    if (rows.length === 0) {
      throw new Error('Price feed not found');
    }

    const row = rows[0];
    assertDefined(row, 'Price feed is undefined');
    assertPropStringOrNumber(
      row,
      'id',
      `Expect price feed id to be string or number, got ${unknownErrorToString(row)}`,
    );

    return { id: String(row.id) };
  }
}
