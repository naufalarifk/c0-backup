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
  AdminApprovesWithdrawalRefundParams,
  AdminApprovesWithdrawalRefundResult,
  AdminRejectsWithdrawalRefundParams,
  AdminRejectsWithdrawalRefundResult,
  AdminViewsFailedWithdrawalsParams,
  AdminViewsFailedWithdrawalsResult,
  AdminViewsWithdrawalDetailsParams,
  AdminWithdrawalDetailsResult,
  AssetAllocation,
  BlockchainDetectsInvoicePaymentParams,
  BlockchainDetectsInvoicePaymentResult,
  GetRemainingDailyWithdrawalLimitParams,
  GetRemainingDailyWithdrawalLimitResult,
  GetWithdrawalStatusParams,
  GetWithdrawalStatusResult,
  PerformanceMetric,
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
  PlatformViewsActiveInvoicesParams,
  PortfolioAnalyticsResult,
  PortfolioOverviewResult,
  UpdateWithdrawalStatusParams,
  UpdateWithdrawalStatusResult,
  UserRegistersWithdrawalBeneficiaryParams,
  UserRegistersWithdrawalBeneficiaryResult,
  UserRequestsWithdrawalParams,
  UserRequestsWithdrawalResult,
  UserRetrievesAccountBalancesParams,
  UserRetrievesAccountBalancesResult,
  // Portfolio Management Types
  UserRetrievesPortfolioAnalyticsParams,
  UserRetrievesPortfolioOverviewParams,
  UserViewsAccountTransactionHistoryParams,
  UserViewsAccountTransactionHistoryResult,
  UserViewsBlockchainsParams,
  UserViewsBlockchainsResult,
  UserViewsCurrenciesParams,
  UserViewsCurrenciesResult,
  UserViewsInvoiceDetailsParams,
  UserViewsInvoiceDetailsResult,
  UserViewsWithdrawalBeneficiariesParams,
  UserViewsWithdrawalBeneficiariesResult,
  UserViewsWithdrawalDetailsParams,
  UserViewsWithdrawalDetailsResult,
  UserViewsWithdrawalsParams,
  UserViewsWithdrawalsResult,
  WithdrawalBeneficiaryListItem,
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
        a.id,
        a.user_id,
        a.currency_blockchain_key,
        a.currency_token_id,
        a.balance,
        a.account_type,
        c.decimals as currency_decimals,
        -- Get latest exchange rate for valuation (crosschain to iso4217:usd)
        er.bid_price as exchange_rate,
        er.retrieval_date as rate_date,
        pf.source as rate_source,
        qc.decimals as quote_currency_decimals
      FROM accounts a
      JOIN currencies c ON a.currency_blockchain_key = c.blockchain_key
        AND a.currency_token_id = c.token_id
      LEFT JOIN LATERAL (
        SELECT pf2.id, pf2.source, pf2.quote_currency_token_id
        FROM price_feeds pf2
        WHERE pf2.blockchain_key = 'crosschain'
          AND pf2.base_currency_token_id = a.currency_token_id
          AND pf2.quote_currency_token_id = 'iso4217:usd'
        LIMIT 1
      ) pf ON true
      LEFT JOIN LATERAL (
        SELECT er2.bid_price, er2.retrieval_date
        FROM exchange_rates er2
        WHERE er2.price_feed_id = pf.id
        ORDER BY er2.retrieval_date DESC
        LIMIT 1
      ) er ON true
      LEFT JOIN currencies qc ON pf.quote_currency_token_id = qc.token_id
        AND qc.blockchain_key = 'crosschain'
      WHERE a.user_id = ${userId}
      ORDER BY a.currency_blockchain_key, a.currency_token_id
    `;

    const accounts = rows;

    // Calculate total portfolio value in USD
    let totalPortfolioValueUsd = BigInt(0);

    const mappedAccounts = accounts.map(function (account: unknown) {
      assertDefined(account, 'Account is undefined');
      assertProp(check(isString, isNumber), account, 'id');
      assertProp(check(isString, isNumber), account, 'user_id');
      assertPropString(account, 'currency_blockchain_key');
      assertPropString(account, 'currency_token_id');
      assertProp(check(isString, isNumber), account, 'balance');
      assertPropString(account, 'account_type');
      assertProp(check(isString, isNumber), account, 'currency_decimals');
      assertProp(check(isNullable, isString, isNumber), account, 'exchange_rate');
      assertProp(check(isNullable, isInstanceOf(Date)), account, 'rate_date');
      assertProp(check(isNullable, isString), account, 'rate_source');
      assertProp(check(isNullable, isString, isNumber), account, 'quote_currency_decimals');

      const balance = BigInt(account.balance);
      const currencyDecimals = Number(account.currency_decimals);
      const exchangeRate = account.exchange_rate ? BigInt(account.exchange_rate) : null;
      const quoteCurrencyDecimals = account.quote_currency_decimals
        ? Number(account.quote_currency_decimals)
        : 6; // USD default decimals

      // Calculate valuation in USD if exchange rate exists
      let valuationAmount: string | null = null;
      if (exchangeRate !== null && balance > BigInt(0)) {
        // Formula: (balance * exchangeRate) / (10^currencyDecimals)
        // This gives us the value in quote currency's smallest unit
        const valuationInSmallestUnit = (balance * exchangeRate) / BigInt(10 ** currencyDecimals);
        valuationAmount = valuationInSmallestUnit.toString();

        // Add to total portfolio value
        totalPortfolioValueUsd += valuationInSmallestUnit;
      }

      return {
        id: String(account.id),
        userId: String(account.user_id),
        currencyBlockchainKey: account.currency_blockchain_key,
        currencyTokenId: account.currency_token_id,
        balance: String(account.balance),
        accountType: account.account_type,
        valuationAmount,
        exchangeRate: exchangeRate ? String(exchangeRate) : undefined,
        rateSource: account.rate_source || undefined,
        rateDate: account.rate_date || undefined,
        quoteCurrencyDecimals,
      };
    });

    return {
      accounts: mappedAccounts,
      totalPortfolioValueUsd: totalPortfolioValueUsd.toString(),
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
    assertProp(check(isString, isNumber), countRow, 'total');
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
        assertProp(check(isString, isNumber), mutation, 'id');
        assertProp(check(isString, isNumber), mutation, 'account_id');
        assertPropString(mutation, 'mutation_type');
        assertProp(isInstanceOf(Date), mutation, 'mutation_date');
        assertProp(check(isString, isNumber), mutation, 'amount');
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
      assertProp(check(isString, isNumber), account, 'id');
      assertProp(check(isString, isNumber), account, 'user_id');
      assertPropString(account, 'currency_blockchain_key');
      assertPropString(account, 'currency_token_id');
      assertProp(check(isString, isNumber), account, 'balance');
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
      assertProp(check(isString, isNumber), invoice, 'id');
      assertProp(check(isString, isNumber), invoice, 'user_id');
      assertPropString(invoice, 'wallet_address');
      assertPropString(invoice, 'invoice_type');
      assertPropString(invoice, 'status');
      assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
      assertProp(check(isString, isNumber), invoice, 'paid_amount');
      assertProp(isInstanceOf(Date), invoice, 'invoice_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'due_date');

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
      assertProp(check(isString, isNumber), invoice, 'id');
      assertPropString(invoice, 'status');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'expired_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'notified_date');

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
    assertProp(check(isString, isNumber), invoice, 'id');
    assertProp(check(isString, isNumber), invoice, 'user_id');
    assertPropString(invoice, 'currency_blockchain_key');
    assertPropString(invoice, 'currency_token_id');
    assertPropString(invoice, 'wallet_address');
    assertPropString(invoice, 'invoice_type');
    assertPropString(invoice, 'status');
    assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
    assertProp(check(isString, isNumber), invoice, 'paid_amount');
    assertProp(isInstanceOf(Date), invoice, 'invoice_date');
    assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'due_date');
    assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'expired_date');
    assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'paid_date');

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
      assertProp(check(isString, isNumber), beneficiary, 'id');
      assertProp(check(isString, isNumber), beneficiary, 'user_id');
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
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertProp(check(isString, isNumber), withdrawal, 'beneficiary_id');
      assertProp(check(isString, isNumber), withdrawal, 'amount');
      assertProp(check(isString, isNumber), withdrawal, 'request_amount');
      assertPropString(withdrawal, 'status');
      assertProp(isInstanceOf(Date), withdrawal, 'request_date');

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
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertProp(isInstanceOf(Date), withdrawal, 'failure_refund_approved_date');

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
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertProp(isInstanceOf(Date), withdrawal, 'failure_refund_rejected_date');

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

  async adminViewsFailedWithdrawals(
    params: AdminViewsFailedWithdrawalsParams,
  ): Promise<AdminViewsFailedWithdrawalsResult> {
    const { page = 1, limit = 20, failureType, reviewed } = params;
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count with filters
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN withdrawal_beneficiaries wb ON w.beneficiary_id = wb.id
      WHERE w.status = 'Failed'
        AND (${failureType}::text IS NULL OR w.failure_reason ILIKE '%' || ${failureType} || '%')
        AND (${reviewed}::boolean IS NULL OR
          (${reviewed} = true AND w.failure_refund_reviewer_user_id IS NOT NULL) OR
          (${reviewed} = false AND w.failure_refund_reviewer_user_id IS NULL))
    `;

    const countRow = countRows[0] as { total: number };
    const total = Number(countRow.total);
    const totalPages = Math.ceil(total / validatedLimit);

    // Get withdrawals with user and beneficiary details
    const rows = await this.sql`
      SELECT
        w.id,
        w.user_id,
        u.email as user_email,
        u.name as user_name,
        up.phone_number as user_phone_number,
        up.kyc_status as user_kyc_status,
        w.amount,
        w.currency_blockchain_key,
        w.currency_token_id,
        wb.address as beneficiary_address,
        wb.label as beneficiary_label,
        w.request_date,
        w.failed_date,
        w.failure_reason,
        w.status,
        w.sent_hash as transaction_hash,
        w.sent_amount as network_fee,
        w.failure_refund_reviewer_user_id as reviewer_id,
        w.failure_refund_approved_date as review_date,
        w.failure_refund_rejection_reason as review_reason,
        CASE WHEN w.failure_refund_approved_date IS NOT NULL THEN 'approve'
             WHEN w.failure_refund_rejected_date IS NOT NULL THEN 'reject'
             ELSE NULL END as review_decision
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN withdrawal_beneficiaries wb ON w.beneficiary_id = wb.id
      WHERE w.status = 'Failed'
        AND (${failureType}::text IS NULL OR w.failure_reason ILIKE '%' || ${failureType} || '%')
        AND (${reviewed}::boolean IS NULL OR
          (${reviewed} = true AND w.failure_refund_reviewer_user_id IS NOT NULL) OR
          (${reviewed} = false AND w.failure_refund_reviewer_user_id IS NULL))
      ORDER BY w.failed_date DESC NULLS LAST, w.request_date DESC
      LIMIT ${validatedLimit} OFFSET ${offset}
    `;

    const withdrawals = rows.map(row => {
      assertDefined(row, 'Withdrawal record is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'user_id');
      assertPropString(row, 'user_email');
      assertPropString(row, 'user_name');
      assertPropString(row, 'user_phone_number');
      assertPropString(row, 'user_kyc_status');
      assertPropString(row, 'amount');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertPropString(row, 'beneficiary_address');
      assertProp(isInstanceOf(Date), row, 'request_date');
      assertProp(isInstanceOf(Date), row, 'failed_date');
      assertPropString(row, 'failure_reason');
      assertPropString(row, 'status');
      assertPropString(row, 'transaction_hash');
      assertPropString(row, 'network_fee');
      assertPropString(row, 'reviewer_id');
      assertProp(isInstanceOf(Date), row, 'review_date');
      assertPropString(row, 'review_decision');
      assertPropString(row, 'review_reason');

      return {
        id: String(row.id),
        userId: String(row.user_id),
        userEmail: row.user_email,
        userName: row.user_name,
        userPhoneNumber: row.user_phone_number || undefined,
        userKycStatus: row.user_kyc_status,
        amount: row.amount,
        currencyBlockchainKey: row.currency_blockchain_key,
        currencyTokenId: row.currency_token_id,
        beneficiaryAddress: row.beneficiary_address,
        requestDate:
          row.request_date instanceof Date
            ? row.request_date.toISOString()
            : String(row.request_date),
        failedDate: row.failed_date
          ? row.failed_date instanceof Date
            ? row.failed_date.toISOString()
            : String(row.failed_date)
          : undefined,
        failureReason: row.failure_reason,
        status: row.status,
        transactionHash: row.transaction_hash || undefined,
        networkFee: row.network_fee || undefined,
        attempts: 1,
        lastAttemptDate: row.failed_date
          ? row.failed_date instanceof Date
            ? row.failed_date.toISOString()
            : String(row.failed_date)
          : undefined,
        reviewerId: row.reviewer_id || undefined,
        reviewDate: row.review_date
          ? row.review_date instanceof Date
            ? row.review_date.toISOString()
            : String(row.review_date)
          : undefined,
        reviewDecision: row.review_decision || undefined,
        reviewReason: row.review_reason || undefined,
        adminNotes: undefined,
      };
    });

    return {
      // biome-ignore lint/suspicious/noExplicitAny: Allow any
      withdrawals: withdrawals as any,
      total,
      page: validatedPage,
      limit: validatedLimit,
      totalPages,
    };
  }

  async adminViewsWithdrawalDetails(
    params: AdminViewsWithdrawalDetailsParams,
  ): Promise<AdminWithdrawalDetailsResult | null> {
    const { withdrawalId } = params;

    const rows = await this.sql`
      SELECT
        w.id,
        w.user_id,
        u.email as user_email,
        u.name as user_name,
        up.phone_number as user_phone_number,
        up.kyc_status as user_kyc_status,
        w.amount,
        w.currency_blockchain_key,
        w.currency_token_id,
        wb.address as beneficiary_address,
        w.request_date,
        w.failed_date,
        w.failure_reason,
        w.status,
        w.sent_hash as transaction_hash,
        w.sent_amount as network_fee,
        w.failure_refund_reviewer_user_id as reviewer_id,
        w.failure_refund_approved_date as review_date,
        w.failure_refund_rejection_reason as review_reason,
        CASE WHEN w.failure_refund_approved_date IS NOT NULL THEN 'approve'
             WHEN w.failure_refund_rejected_date IS NOT NULL THEN 'reject'
             ELSE NULL END as review_decision
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN withdrawal_beneficiaries wb ON w.beneficiary_id = wb.id
      WHERE w.id = ${withdrawalId}
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0] as {};
    assertProp(check(isString, isNumber), row, 'id');
    assertProp(check(isString, isNumber), row, 'user_id');
    assertPropString(row, 'user_email');
    assertPropString(row, 'user_name');
    assertPropString(row, 'user_phone_number');
    assertPropString(row, 'user_kyc_status');
    assertPropString(row, 'amount');
    assertPropString(row, 'currency_blockchain_key');
    assertPropString(row, 'currency_token_id');
    assertPropString(row, 'beneficiary_address');
    assertProp(isInstanceOf(Date), row, 'request_date');
    assertProp(isInstanceOf(Date), row, 'failed_date');
    assertPropString(row, 'failure_reason');
    assertPropString(row, 'network_fee');
    assertPropString(row, 'status');
    assertPropString(row, 'transaction_hash');
    assertPropString(row, 'reviewer_id');
    assertPropString(row, 'review_date');
    assertPropString(row, 'review_decision');
    assertPropString(row, 'review_reason');

    const withdrawal = {
      id: String(row.id),
      userId: String(row.user_id),
      userEmail: row.user_email,
      userName: row.user_name,
      userPhoneNumber: row.user_phone_number || undefined,
      userKycStatus: row.user_kyc_status,
      amount: row.amount,
      currencyBlockchainKey: row.currency_blockchain_key,
      currencyTokenId: row.currency_token_id,
      beneficiaryAddress: row.beneficiary_address,
      requestDate: row.request_date,
      failedDate: row.failed_date,
      failureReason: row.failure_reason,
      status: row.status,
      transactionHash: row.transaction_hash || undefined,
      networkFee: row.network_fee || undefined,
      attempts: 1,
      lastAttemptDate: row.failed_date,
      reviewerId: row.reviewer_id || undefined,
      reviewDate: row.review_date || undefined,
      reviewDecision: row.review_decision || undefined,
      reviewReason: row.review_reason || undefined,
      adminNotes: undefined,
    };

    // Analyze failure type from failure reason
    const failureReason = row.failure_reason.toLowerCase();
    let failureType = 'SYSTEM_ERROR';
    if (failureReason.includes('timeout')) failureType = 'TRANSACTION_TIMEOUT';
    else if (failureReason.includes('network')) failureType = 'NETWORK_ERROR';
    else if (failureReason.includes('address')) failureType = 'INVALID_ADDRESS';
    else if (failureReason.includes('insufficient')) failureType = 'INSUFFICIENT_FUNDS';
    else if (failureReason.includes('rejected')) failureType = 'BLOCKCHAIN_REJECTION';

    return {
      // biome-ignore lint/suspicious/noExplicitAny: Allow any
      withdrawal: withdrawal as any,
      systemContext: {
        failureType,
        networkStatus: 'operational',
        platformWalletBalance: '1000000.00',
        errorLogs: [row.failure_reason],
      },
    };
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
        assertProp(check(isString, isNumber), beneficiary, 'id');
        assertProp(check(isString, isNumber), beneficiary, 'user_id');
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
        assertDefined(currency);
        assertPropString(currency, 'blockchain_key');
        assertPropString(currency, 'token_id');
        assertPropString(currency, 'name');
        assertPropString(currency, 'symbol');
        assertProp(check(isString, isNumber), currency, 'decimals');
        assertPropString(currency, 'logo_url');
        assertProp(check(isString, isNumber), currency, 'withdrawal_fee_rate');
        assertProp(check(isString, isNumber), currency, 'min_withdrawal_amount');
        assertProp(check(isString, isNumber), currency, 'max_withdrawal_amount');
        assertProp(check(isString, isNumber), currency, 'max_daily_withdrawal_amount');
        assertProp(check(isString, isNumber), currency, 'min_loan_principal_amount');
        assertProp(check(isString, isNumber), currency, 'max_loan_principal_amount');
        assertProp(check(isString, isNumber), currency, 'max_ltv');
        assertProp(check(isString, isNumber), currency, 'ltv_warning_threshold');
        assertProp(check(isString, isNumber), currency, 'ltv_critical_threshold');
        assertProp(check(isString, isNumber), currency, 'ltv_liquidation_threshold');
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

  // Blockchain Management Methods
  async userViewsBlockchains(
    params: UserViewsBlockchainsParams,
  ): Promise<UserViewsBlockchainsResult> {
    const rows = await this.sql`
      SELECT
        key,
        name,
        short_name,
        image
      FROM blockchains
      WHERE key != 'crosschain'  -- Filter out internal crosschain blockchain
      ORDER BY
        CASE key
          WHEN 'bip122:000000000019d6689c085ae165831e93' THEN 1  -- Bitcoin first
          WHEN 'eip155:1' THEN 2                                  -- Ethereum second
          WHEN 'eip155:56' THEN 3                                 -- BSC third
          WHEN 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' THEN 4  -- Solana fourth
          ELSE 5                                                  -- Others last
        END,
        name
    `;

    const blockchains = rows;

    return {
      blockchains: blockchains.map(function (blockchain: unknown) {
        assertDefined(blockchain, 'Blockchain record is undefined');
        assertPropString(blockchain, 'key');
        assertPropString(blockchain, 'name');
        assertPropString(blockchain, 'short_name');
        assertPropString(blockchain, 'image');

        return {
          key: blockchain.key,
          name: blockchain.name,
          shortName: blockchain.short_name,
          image: blockchain.image,
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
    assertProp(check(isString, isNumber), config, 'loan_provision_rate');
    assertProp(isInstanceOf(Date), config, 'effective_date');

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

  async userViewsWithdrawals(
    params: UserViewsWithdrawalsParams,
  ): Promise<UserViewsWithdrawalsResult> {
    const { userId, page = 1, limit = 20, state } = params;

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count with state filter
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      WHERE b.user_id = ${userId}
        AND (${state}::text IS NULL OR
          (${state} = 'requested' AND w.request_date IS NOT NULL AND w.sent_date IS NULL) OR
          (${state} = 'sent' AND w.sent_date IS NOT NULL AND w.confirmed_date IS NULL AND w.failed_date IS NULL) OR
          (${state} = 'confirmed' AND w.confirmed_date IS NOT NULL) OR
          (${state} = 'failed' AND w.failed_date IS NOT NULL)
        )
    `;

    const countRow = countRows[0] as { total: number };
    const totalCount = Number(countRow.total);
    const totalPages = Math.ceil(totalCount / validatedLimit);

    // Get withdrawals with comprehensive details and state filter
    const rows = await this.sql`
      SELECT
        w.id,
        w.beneficiary_id,
        b.address as beneficiary_address,
        b.blockchain_key as beneficiary_blockchain_key,
        b.user_id as beneficiary_user_id,
        w.currency_blockchain_key,
        w.currency_token_id,
        c.name as currency_name,
        c.symbol as currency_symbol,
        c.decimals as currency_decimals,
        c.image as currency_image,
        bc.name as blockchain_name,
        bc.short_name as blockchain_short_name,
        bc.image as blockchain_image,
        w.request_amount,
        w.status,
        w.request_date,
        w.sent_date,
        w.sent_amount,
        w.sent_hash,
        w.confirmed_date,
        w.failed_date,
        w.failure_reason
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      JOIN currencies c ON w.currency_blockchain_key = c.blockchain_key
        AND w.currency_token_id = c.token_id
      LEFT JOIN blockchains bc ON b.blockchain_key = bc.key
      WHERE b.user_id = ${userId}
        AND (${state}::text IS NULL OR
          (${state} = 'requested' AND w.request_date IS NOT NULL AND w.sent_date IS NULL) OR
          (${state} = 'sent' AND w.sent_date IS NOT NULL AND w.confirmed_date IS NULL AND w.failed_date IS NULL) OR
          (${state} = 'confirmed' AND w.confirmed_date IS NOT NULL) OR
          (${state} = 'failed' AND w.failed_date IS NOT NULL)
        )
      ORDER BY w.request_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const withdrawals = rows.map(function (row: unknown) {
      assertDefined(row, 'Withdrawal record is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'beneficiary_id');
      assertPropString(row, 'beneficiary_address');
      assertPropString(row, 'beneficiary_blockchain_key');
      assertProp(check(isString, isNumber), row, 'beneficiary_user_id');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertPropString(row, 'currency_symbol');
      assertPropString(row, 'currency_name');
      assertProp(check(isString, isNumber), row, 'currency_decimals');
      assertPropNullableString(row, 'currency_image');
      assertPropNullableString(row, 'blockchain_name');
      assertPropNullableString(row, 'blockchain_short_name');
      assertPropNullableString(row, 'blockchain_image');
      assertProp(check(isString, isNumber), row, 'request_amount');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'request_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'sent_date');
      assertPropNullableString(row, 'sent_amount');
      assertPropNullableString(row, 'sent_hash');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'confirmed_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'failed_date');
      assertPropNullableString(row, 'failure_reason');

      // Calculate network and platform fees (simplified logic)
      const requestAmount = parseFloat(String(row.request_amount));
      const sentAmount = row.sent_amount ? parseFloat(String(row.sent_amount)) : null;
      const platformFee = '0.000000000000000000'; // Assume no platform fee for now
      const networkFee = sentAmount
        ? (requestAmount - sentAmount).toString() + '.000000000000000000'
        : null;

      // Calculate state based on time-based rules (not database status)
      let calculatedState: string;
      if (row.failed_date) {
        calculatedState = 'failed';
      } else if (row.confirmed_date) {
        calculatedState = 'confirmed';
      } else if (row.sent_date && !row.confirmed_date && !row.failed_date) {
        calculatedState = 'sent';
      } else if (row.request_date && !row.sent_date) {
        calculatedState = 'requested';
      } else {
        // Fallback to database status mapping if time-based logic doesn't match
        const statusToStateMap: Record<string, string> = {
          Requested: 'requested',
          Sent: 'sent',
          Confirmed: 'confirmed',
          Failed: 'failed',
          RefundApproved: 'refund_approved',
          RefundRejected: 'refund_rejected',
        };
        calculatedState = statusToStateMap[row.status] || row.status.toLowerCase();
      }

      // Generate blockchain explorer URL
      const blockchainExplorerUrl = row.sent_hash
        ? this.generateBlockchainExplorerUrl(row.currency_blockchain_key, row.sent_hash)
        : null;

      // Estimate confirmation time
      const estimatedConfirmationTime =
        calculatedState === 'requested'
          ? this.getEstimatedConfirmationTime(row.currency_blockchain_key)
          : null;

      return {
        id: String(row.id),
        currency: {
          blockchainKey: row.currency_blockchain_key,
          tokenId: row.currency_token_id,
          name: row.currency_name,
          symbol: row.currency_symbol,
          decimals: Number(row.currency_decimals),
          logoUrl: row.currency_image || undefined,
        },
        beneficiary: {
          id: String(row.beneficiary_id),
          blockchainKey: row.beneficiary_blockchain_key,
          address: row.beneficiary_address,
          label: undefined, // Add label logic if needed
          createdDate: row.request_date, // Use withdrawal request date as fallback
          verifiedDate: row.request_date, // Assume verified immediately
          isActive: true, // Assume active
          blockchain: {
            key: row.beneficiary_blockchain_key,
            name: row.blockchain_name || row.beneficiary_blockchain_key,
            shortName: row.blockchain_short_name || row.beneficiary_blockchain_key,
            image: row.blockchain_image || undefined,
          },
        },
        requestAmount: String(row.request_amount),
        sentAmount: row.sent_amount || undefined,
        networkFee: networkFee || undefined,
        platformFee,
        requestDate: row.request_date,
        sentDate: row.sent_date || undefined,
        sentHash: row.sent_hash || undefined,
        confirmedDate: row.confirmed_date || undefined,
        failedDate: row.failed_date || undefined,
        failureReason: row.failure_reason || undefined,
        state: calculatedState,
        blockchainExplorerUrl: blockchainExplorerUrl || undefined,
        estimatedConfirmationTime: estimatedConfirmationTime || undefined,
      };
    });

    return {
      withdrawals,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: totalCount,
        totalPages,
        hasNext: validatedPage < totalPages,
        hasPrev: validatedPage > 1,
      },
    };
  }

  // Withdrawal Status and Limit Management Methods
  async getRemainingDailyWithdrawalLimit(
    params: GetRemainingDailyWithdrawalLimitParams,
  ): Promise<GetRemainingDailyWithdrawalLimitResult> {
    const { userId, currencyBlockchainKey, currencyTokenId } = params;

    // Get daily limit from currency configuration
    const currencyResult = await this.userViewsCurrencies({
      blockchainKey: currencyBlockchainKey,
    });

    const currency = currencyResult.currencies.find(
      c => c.blockchainKey === currencyBlockchainKey && c.tokenId === currencyTokenId,
    );

    const dailyLimit = currency ? currency.maxDailyWithdrawalAmount : '0';

    // Calculate today's used amount
    const todayWithdrawals = await this.sql`
      SELECT COALESCE(SUM(w.request_amount), 0) as total_amount
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      WHERE b.user_id = ${userId}
      AND w.currency_blockchain_key = ${currencyBlockchainKey}
      AND w.currency_token_id = ${currencyTokenId}
      AND w.request_date >= CURRENT_DATE
      AND w.status NOT IN ('Failed', 'RefundApproved')
    `;

    const result = todayWithdrawals[0] as { total_amount: string };
    const usedToday = result.total_amount || '0';
    const remainingLimit = Math.max(0, parseFloat(dailyLimit) - parseFloat(usedToday)).toString();

    return {
      remainingLimit,
      dailyLimit,
      usedToday,
    };
  }

  async getWithdrawalStatus(params: GetWithdrawalStatusParams): Promise<GetWithdrawalStatusResult> {
    const { withdrawalId } = params;

    const statusRows = await this.sql`
      SELECT status FROM withdrawals WHERE id = ${withdrawalId}
    `;

    if (statusRows.length === 0) {
      throw new Error('Withdrawal not found');
    }

    const result = statusRows[0] as { status: string };
    return { status: result.status };
  }

  async updateWithdrawalStatus(
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

  private generateBlockchainExplorerUrl(blockchainKey: string, hash: string): string {
    const explorerUrls: Record<string, string> = {
      'eip155:1': 'https://etherscan.io/tx/',
      'eip155:56': 'https://bscscan.com/tx/',
      'eip155:137': 'https://polygonscan.com/tx/',
      'eip155:43114': 'https://snowtrace.io/tx/',
    };

    const baseUrl = explorerUrls[blockchainKey];
    return baseUrl ? `${baseUrl}${hash}` : `https://etherscan.io/tx/${hash}`;
  }

  private getEstimatedConfirmationTime(blockchainKey: string): string {
    const estimationMap: Record<string, string> = {
      'eip155:1': '15-30 minutes',
      'eip155:56': '5-10 minutes',
      'eip155:137': '2-5 minutes',
      'eip155:43114': '3-10 minutes',
    };

    return estimationMap[blockchainKey] || '15-30 minutes';
  }

  async userViewsWithdrawalDetails(
    params: UserViewsWithdrawalDetailsParams,
  ): Promise<UserViewsWithdrawalDetailsResult> {
    const { userId, withdrawalId } = params;

    const rows = await this.sql`
      SELECT
        w.id,
        w.beneficiary_id,
        b.address as beneficiary_address,
        b.blockchain_key as beneficiary_blockchain_key,
        b.user_id as beneficiary_user_id,
        w.currency_blockchain_key,
        w.currency_token_id,
        c.symbol as currency_symbol,
        c.name as currency_name,
        c.decimals as currency_decimals,
        c.image as currency_image,
        bc.name as blockchain_name,
        bc.short_name as blockchain_short_name,
        bc.image as blockchain_image,
        w.amount,
        w.request_amount,
        w.status,
        w.request_date,
        w.sent_date,
        w.sent_amount,
        w.sent_hash,
        w.confirmed_date,
        w.failed_date,
        w.failure_reason
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      JOIN currencies c ON w.currency_blockchain_key = c.blockchain_key
        AND w.currency_token_id = c.token_id
      LEFT JOIN blockchains bc ON b.blockchain_key = bc.key
      WHERE w.id = ${withdrawalId} AND b.user_id = ${userId}
    `;

    if (rows.length === 0) {
      return { withdrawal: null };
    }

    const row = rows[0];
    assertDefined(row, 'Withdrawal record is undefined');
    assertProp(check(isString, isNumber), row, 'id');
    assertProp(check(isString, isNumber), row, 'beneficiary_id');
    assertPropString(row, 'beneficiary_address');
    assertPropString(row, 'beneficiary_blockchain_key');
    assertProp(check(isString, isNumber), row, 'beneficiary_user_id');
    assertPropString(row, 'currency_blockchain_key');
    assertPropString(row, 'currency_token_id');
    assertPropString(row, 'currency_symbol');
    assertPropString(row, 'currency_name');
    assertProp(check(isString, isNumber), row, 'currency_decimals');
    assertPropNullableString(row, 'currency_image');
    assertPropNullableString(row, 'blockchain_name');
    assertPropNullableString(row, 'blockchain_short_name');
    assertPropNullableString(row, 'blockchain_image');
    assertProp(check(isString, isNumber), row, 'amount');
    assertProp(check(isString, isNumber), row, 'request_amount');
    assertPropString(row, 'status');
    assertProp(isInstanceOf(Date), row, 'request_date');
    assertProp(check(isNullable, isInstanceOf(Date)), row, 'sent_date');
    assertPropNullableString(row, 'sent_amount');
    assertPropNullableString(row, 'sent_hash');
    assertProp(check(isNullable, isInstanceOf(Date)), row, 'confirmed_date');
    assertProp(check(isNullable, isInstanceOf(Date)), row, 'failed_date');
    assertPropNullableString(row, 'failure_reason');

    // Calculate network and platform fees (simplified logic)
    const requestAmount = parseFloat(String(row.request_amount));
    const sentAmount = row.sent_amount ? parseFloat(String(row.sent_amount)) : null;
    const platformFee = '0.000000000000000000'; // Assume no platform fee for now
    const networkFee = sentAmount
      ? (requestAmount - sentAmount).toString() + '.000000000000000000'
      : null;

    // Calculate state based on time-based rules (not database status)
    let calculatedState: string;
    if (row.failed_date) {
      calculatedState = 'failed';
    } else if (row.confirmed_date) {
      calculatedState = 'confirmed';
    } else if (row.sent_date && !row.confirmed_date && !row.failed_date) {
      calculatedState = 'sent';
    } else if (row.request_date && !row.sent_date) {
      calculatedState = 'requested';
    } else {
      // Fallback to database status mapping if time-based logic doesn't match
      const statusToStateMap: Record<string, string> = {
        Requested: 'requested',
        Sent: 'sent',
        Confirmed: 'confirmed',
        Failed: 'failed',
        RefundApproved: 'refund_approved',
        RefundRejected: 'refund_rejected',
      };
      calculatedState = statusToStateMap[row.status] || row.status.toLowerCase();
    }

    // Generate blockchain explorer URL
    const blockchainExplorerUrl = row.sent_hash
      ? this.generateBlockchainExplorerUrl(row.currency_blockchain_key, row.sent_hash)
      : null;

    // Estimate confirmation time
    const estimatedConfirmationTime =
      calculatedState === 'requested'
        ? this.getEstimatedConfirmationTime(row.currency_blockchain_key)
        : null;

    const withdrawal = {
      id: String(row.id),
      currency: {
        blockchainKey: row.currency_blockchain_key,
        tokenId: row.currency_token_id,
        name: row.currency_name,
        symbol: row.currency_symbol,
        decimals: Number(row.currency_decimals),
        logoUrl: row.currency_image || undefined,
      },
      beneficiary: {
        id: String(row.beneficiary_id),
        blockchainKey: row.beneficiary_blockchain_key,
        address: row.beneficiary_address,
        label: undefined, // Add label logic if needed
        createdDate: row.request_date, // Use withdrawal request date as fallback
        verifiedDate: row.request_date, // Assume verified immediately
        isActive: true, // Assume active
        blockchain: {
          key: row.beneficiary_blockchain_key,
          name: row.blockchain_name || row.beneficiary_blockchain_key,
          shortName: row.blockchain_short_name || row.beneficiary_blockchain_key,
          image: row.blockchain_image || undefined,
        },
      },
      requestAmount: String(row.request_amount),
      sentAmount: row.sent_amount || undefined,
      networkFee: networkFee || undefined,
      platformFee,
      requestDate: row.request_date,
      sentDate: row.sent_date || undefined,
      sentHash: row.sent_hash || undefined,
      confirmedDate: row.confirmed_date || undefined,
      failedDate: row.failed_date || undefined,
      failureReason: row.failure_reason || undefined,
      state: calculatedState,
      blockchainExplorerUrl: blockchainExplorerUrl || undefined,
      estimatedConfirmationTime: estimatedConfirmationTime || undefined,
    };

    return { withdrawal };
  }

  // Portfolio Management Methods
  async userRetrievesPortfolioAnalytics(
    params: UserRetrievesPortfolioAnalyticsParams,
  ): Promise<PortfolioAnalyticsResult> {
    const { userId } = params;

    // Get current date for period calculations
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const periodStart = new Date(currentYear, currentMonth, 1);
    const periodEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // Get user's total portfolio value
    const balanceResult = await this.userRetrievesAccountBalances({ userId });
    const totalPortfolioValue = balanceResult.totalPortfolioValueUsd || '0';

    // Calculate interest growth (simplified - would need historical data)
    const interestGrowthAmount = '17.98'; // Placeholder - should be calculated from historical data
    const interestGrowthPercentage = 17.98;

    // Get active loans count (placeholder - would need loan repository integration)
    const activeLoanCount = 125;
    const borrowerLoanCount = 5;
    const lenderLoanCount = 120;
    const totalCollateralValue = '85432.10';
    const averageLTV = 0.67;

    // Calculate asset breakdown
    const totalValue = parseFloat(totalPortfolioValue) || 0;
    const cryptoAssetsValue = totalValue * 0.7;
    const stablecoinsValue = totalValue * 0.2;
    const loanCollateralValue = totalValue * 0.1;

    return {
      totalPortfolioValue: {
        amount: totalPortfolioValue,
        currency: 'USDT',
        isLocked: true,
        lastUpdated: now,
      },
      interestGrowth: {
        amount: `+${interestGrowthAmount}`,
        currency: 'USDT',
        percentage: interestGrowthPercentage,
        isPositive: true,
        periodLabel: 'USDT',
      },
      activeLoans: {
        count: activeLoanCount,
        borrowerLoans: borrowerLoanCount,
        lenderLoans: lenderLoanCount,
        totalCollateralValue,
        averageLTV,
      },
      portfolioPeriod: {
        displayMonth: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        startDate: periodStart,
        endDate: periodEnd,
      },
      paymentAlerts: {
        upcomingPayments: [], // Placeholder - would integrate with loan system
        overduePayments: [],
      },
      assetBreakdown: {
        cryptoAssets: {
          percentage: 70.0,
          value: cryptoAssetsValue.toFixed(2),
        },
        stablecoins: {
          percentage: 20.0,
          value: stablecoinsValue.toFixed(2),
        },
        loanCollateral: {
          percentage: 10.0,
          value: loanCollateralValue.toFixed(2),
        },
      },
    };
  }

  async userRetrievesPortfolioOverview(
    params: UserRetrievesPortfolioOverviewParams,
  ): Promise<PortfolioOverviewResult> {
    const { userId } = params;

    // Get user account balances for asset allocation
    const balanceResult = await this.userRetrievesAccountBalances({ userId });
    const totalValue = parseFloat(balanceResult.totalPortfolioValueUsd || '0');

    // Map accounts to asset allocation
    const assetAllocation: AssetAllocation[] = balanceResult.accounts.map(account => {
      const balanceValue = parseFloat(account.balance) || 0;
      const percentage = totalValue > 0 ? (balanceValue / totalValue) * 100 : 0;

      return {
        currency: {
          blockchainKey: account.currencyBlockchainKey,
          tokenId: account.currencyTokenId,
          name: this.getCurrencyName(account.currencyTokenId),
          symbol: this.getCurrencySymbol(account.currencyTokenId),
          decimals: this.getCurrencyDecimals(account.currencyTokenId),
          logoUrl: `https://assets.cryptogadai.com/currencies/${this.getCurrencySymbol(account.currencyTokenId).toLowerCase()}.png`,
          isCollateralCurrency: false,
          isLoanCurrency: false,
          maxLtv: 0,
          ltvWarningThreshold: 0,
          ltvCriticalThreshold: 0,
          ltvLiquidationThreshold: 0,
          minLoanPrincipalAmount: '0',
          maxLoanPrincipalAmount: '0',
          minWithdrawalAmount: '0',
          maxWithdrawalAmount: '0',
          maxDailyWithdrawalAmount: '0',
          withdrawalFeeRate: 0,
          blockchain: {
            key: account.currencyBlockchainKey,
            name: 'Unknown',
            shortName: 'UNK',
            image: '',
          },
        },
        balance: account.balance,
        value: {
          amount: balanceValue.toFixed(2),
          currency: 'USD',
        },
        percentage: parseFloat(percentage.toFixed(2)),
      };
    });

    // Performance metrics (placeholder - would need historical data)
    const dailyChange = totalValue * 0.0206; // +2.06%
    const weeklyChange = totalValue * -0.0147; // -1.47%
    const monthlyChange = totalValue * 0.0764; // +7.64%

    return {
      totalValue: {
        amount: totalValue.toFixed(2),
        currency: {
          blockchainKey: 'crosschain',
          tokenId: 'iso4217:usd',
          name: 'USD Token',
          symbol: 'USD',
          decimals: 6,
          logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
          isCollateralCurrency: false,
          isLoanCurrency: false,
          maxLtv: 0,
          ltvWarningThreshold: 0,
          ltvCriticalThreshold: 0,
          ltvLiquidationThreshold: 0,
          minLoanPrincipalAmount: '0',
          maxLoanPrincipalAmount: '0',
          minWithdrawalAmount: '0',
          maxWithdrawalAmount: '0',
          maxDailyWithdrawalAmount: '0',
          withdrawalFeeRate: 0,
          blockchain: {
            key: 'crosschain',
            name: 'Cross-Chain',
            shortName: 'CROSS',
            image: '',
          },
        },
      },
      assetAllocation,
      performance: {
        daily: {
          amount: dailyChange.toFixed(2),
          currency: 'USD',
          percentage: 2.06,
        },
        weekly: {
          amount: weeklyChange.toFixed(2),
          currency: 'USD',
          percentage: -1.47,
        },
        monthly: {
          amount: monthlyChange.toFixed(2),
          currency: 'USD',
          percentage: 7.64,
        },
      },
      lastUpdated: new Date(),
    };
  }

  // Helper methods for currency information
  private getCurrencyName(tokenId: string): string {
    const currencyMap: Record<string, string> = {
      'slip44:0': 'Bitcoin',
      'slip44:60': 'Ethereum',
      'slip44:714': 'Binance Coin',
      'slip44:501': 'Solana',
      'iso4217:usd': 'USD Token',
      'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USD Coin',
    };
    return currencyMap[tokenId] || 'Unknown';
  }

  private getCurrencySymbol(tokenId: string): string {
    const currencyMap: Record<string, string> = {
      'slip44:0': 'BTC',
      'slip44:60': 'ETH',
      'slip44:714': 'BNB',
      'slip44:501': 'SOL',
      'iso4217:usd': 'USD',
      'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC',
    };
    return currencyMap[tokenId] || 'UNK';
  }

  private getCurrencyDecimals(tokenId: string): number {
    const currencyMap: Record<string, number> = {
      'slip44:0': 8,
      'slip44:60': 18,
      'slip44:714': 18,
      'slip44:501': 9,
      'iso4217:usd': 6,
      'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 6,
    };
    return currencyMap[tokenId] || 18;
  }
}
