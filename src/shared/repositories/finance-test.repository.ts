import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import {
  GetRemainingDailyWithdrawalLimitParams,
  GetRemainingDailyWithdrawalLimitResult,
  GetWithdrawalStatusParams,
  GetWithdrawalStatusResult,
  PlatformAdjustsAccountBalanceForTestingParams,
  PlatformAdjustsAccountBalanceForTestingResult,
  PlatformCreatesInvoiceParams,
  PlatformCreatesInvoiceResult,
  PlatformCreatesUserAccountParams,
  PlatformCreatesUserAccountResult,
  PlatformUpdatesInvoiceStatusParams,
  PlatformUpdatesInvoiceStatusResult,
  UpdateWithdrawalStatusParams,
  UpdateWithdrawalStatusResult,
} from './finance.types';
import { FinancePlatformRepository } from './finance-platform.repository';

export abstract class FinanceTestRepository extends FinancePlatformRepository {
  async testCreatesUserAccount(
    params: PlatformCreatesUserAccountParams,
  ): Promise<PlatformCreatesUserAccountResult> {
    const { userId, currencyBlockchainKey, currencyTokenId, accountType = 'User' } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        INSERT INTO user_accounts (
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

  // Minimal test helpers for test suite only
  async testCreatesUsers(params: { users: Array<{ email: string; name: string; role?: string }> }) {
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
  async testCreatesBlockchains(params: {
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

  async testCreatesCurrencies(params: {
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

  // Withdrawal Status and Limit Management Methods
  async userViewsRemainingDailyWithdrawalLimit(
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

  async testAdjustsAccountBalance(
    params: PlatformAdjustsAccountBalanceForTestingParams,
  ): Promise<PlatformAdjustsAccountBalanceForTestingResult> {
    const {
      userId,
      currencyBlockchainKey,
      currencyTokenId,
      amount,
      mutationDate = new Date(),
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Ensure account exists
      await this.sql`
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
          'User'
        )
        ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type)
        DO NOTHING
      `;

      // Insert the test balance adjustment mutation
      await this.sql`
        INSERT INTO account_mutations (account_id, mutation_type, mutation_date, amount)
        SELECT
          a.id,
          'TestBalanceAdjustment',
          ${mutationDate.toISOString()},
          ${amount}
        FROM accounts a
        WHERE a.user_id = ${userId}
          AND a.currency_blockchain_key = ${currencyBlockchainKey}
          AND a.currency_token_id = ${currencyTokenId}
          AND a.account_type = 'User'
      `;

      // Get the updated account information
      const accountRows = await this.sql`
        SELECT id, user_id, currency_blockchain_key, currency_token_id, balance, account_type
        FROM accounts
        WHERE user_id = ${userId}
          AND currency_blockchain_key = ${currencyBlockchainKey}
          AND currency_token_id = ${currencyTokenId}
          AND account_type = 'User'
      `;

      const account = accountRows[0];
      assertDefined(account, 'Account not found after balance adjustment');
      assertProp(check(isString, isNumber), account, 'id');
      assertProp(check(isString, isNumber), account, 'user_id');
      assertPropString(account, 'currency_blockchain_key');
      assertPropString(account, 'currency_token_id');
      assertProp(check(isString, isNumber), account, 'balance');
      assertPropString(account, 'account_type');

      await tx.commitTransaction();

      return {
        accountId: String(account.id),
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
}
