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
  setPropValue,
} from 'typeshaper';

import {
  AssetAllocation,
  PortfolioAnalyticsResult,
  PortfolioOverviewResult,
  UserRegistersWithdrawalBeneficiaryParams,
  UserRegistersWithdrawalBeneficiaryResult,
  UserRequestsWithdrawalParams,
  UserRequestsWithdrawalResult,
  UserRetrievesAccountBalancesParams,
  UserRetrievesAccountBalancesResult,
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
} from './finance.types';
import { UserRepository } from './user.repository';

export abstract class FinanceUserRepsitory extends UserRepository {
  // Account & Balance Management Methods
  async userRetrievesAccountBalances(
    params: UserRetrievesAccountBalancesParams,
  ): Promise<UserRetrievesAccountBalancesResult> {
    const rows = await this.sql`
      SELECT
        a.id,
        a.user_id AS "userId",
        a.currency_blockchain_key AS "currencyBlockchainKey",
        a.currency_token_id AS "currencyTokenId",
        a.balance,
        a.account_type AS "accountType",
        c.decimals AS "currencyDecimals",
        c.name AS "currencyName",
        c.symbol AS "currencySymbol",
        er.bid_price AS "exchangeRate",
        er.retrieval_date AS "rateDate",
        pf.source AS "rateSource",
        qc.decimals AS "quoteCurrencyDecimals"
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
      WHERE a.user_id = ${params.userId}
        AND a.account_type = 'User'
      ORDER BY a.currency_blockchain_key, a.currency_token_id
    `;

    let totalPortfolioValueUsd = BigInt(0);

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'userId');
      assertPropString(row, 'currencyBlockchainKey');
      assertPropString(row, 'currencyTokenId');
      assertProp(check(isString, isNumber), row, 'balance');
      assertPropString(row, 'accountType');
      assertProp(check(isString, isNumber), row, 'currencyDecimals');
      assertPropString(row, 'currencyName');
      assertPropString(row, 'currencySymbol');
      assertProp(check(isNullable, isString, isNumber), row, 'exchangeRate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'rateDate');
      assertProp(check(isNullable, isString), row, 'rateSource');
      assertProp(check(isNullable, isString, isNumber), row, 'quoteCurrencyDecimals');

      const balance = BigInt(row.balance);
      const currencyDecimals = Number(row.currencyDecimals);
      const exchangeRate = row.exchangeRate ? BigInt(row.exchangeRate) : null;
      const quoteCurrencyDecimals = row.quoteCurrencyDecimals
        ? Number(row.quoteCurrencyDecimals)
        : 6;

      let valuationAmount: string | null = null;
      if (exchangeRate !== null && balance > BigInt(0)) {
        const valuationInSmallestUnit = (balance * exchangeRate) / BigInt(10 ** currencyDecimals);
        valuationAmount = valuationInSmallestUnit.toString();
        totalPortfolioValueUsd += valuationInSmallestUnit;
      }

      setPropValue(row, 'id', String(row.id));
      setPropValue(row, 'userId', String(row.userId));
      setPropValue(row, 'balance', String(row.balance));
      setPropValue(row, 'currencyDecimals', currencyDecimals);
      setPropValue(row, 'valuationAmount', valuationAmount);
      setPropValue(row, 'exchangeRate', exchangeRate ? String(exchangeRate) : undefined);
      setPropValue(row, 'rateSource', row.rateSource || undefined);
      setPropValue(row, 'rateDate', row.rateDate || undefined);
      setPropValue(row, 'quoteCurrencyDecimals', quoteCurrencyDecimals);
      return row;
    });

    return {
      accounts: rows,
      totalPortfolioValueUsd: totalPortfolioValueUsd.toString(),
    };
  }

  async userViewsAccountTransactionHistory(
    params: UserViewsAccountTransactionHistoryParams,
  ): Promise<UserViewsAccountTransactionHistoryResult> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const countResult = await this.sql`
      SELECT COUNT(*) as total
      FROM account_mutations
      WHERE account_id = ${params.accountId}
        AND (${params.mutationType}::text IS NULL OR mutation_type = ${params.mutationType})
        AND (${params.fromDate}::timestamp IS NULL OR mutation_date >= ${params.fromDate})
        AND (${params.toDate}::timestamp IS NULL OR mutation_date <= ${params.toDate})
    `;

    const countRow = Array.isArray(countResult) ? countResult[0] : countResult;
    assertDefined(countRow);
    assertProp(check(isString, isNumber), countRow, 'total');
    const totalCount = Number(countRow.total);

    const rows = await this.sql`
      SELECT
        id,
        account_id AS "accountId",
        mutation_type AS "mutationType",
        mutation_date AS "mutationDate",
        amount,
        invoice_id AS "invoiceId",
        withdrawal_id AS "withdrawalId",
        invoice_payment_id AS "invoicePaymentId"
      FROM account_mutations
      WHERE account_id = ${params.accountId}
        AND (${params.mutationType}::text IS NULL OR mutation_type = ${params.mutationType})
        AND (${params.fromDate}::timestamp IS NULL OR mutation_date >= ${params.fromDate})
        AND (${params.toDate}::timestamp IS NULL OR mutation_date <= ${params.toDate})
      ORDER BY mutation_date DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'accountId');
      assertPropString(row, 'mutationType');
      assertProp(isInstanceOf(Date), row, 'mutationDate');
      assertProp(check(isString, isNumber), row, 'amount');
      assertProp(check(isNullable, isString, isNumber), row, 'invoiceId');
      assertProp(check(isNullable, isString, isNumber), row, 'withdrawalId');
      assertProp(check(isNullable, isString, isNumber), row, 'invoicePaymentId');

      setPropValue(row, 'id', String(row.id));
      setPropValue(row, 'accountId', String(row.accountId));
      setPropValue(row, 'amount', String(row.amount));
      setPropValue(row, 'invoiceId', row.invoiceId ? String(row.invoiceId) : undefined);
      setPropValue(row, 'withdrawalId', row.withdrawalId ? String(row.withdrawalId) : undefined);
      setPropValue(
        row,
        'invoicePaymentId',
        row.invoicePaymentId ? String(row.invoicePaymentId) : undefined,
      );
      return row;
    });

    return {
      mutations: rows,
      totalCount,
      hasMore: offset + rows.length < totalCount,
    };
  }

  async userViewsInvoiceDetails(
    params: UserViewsInvoiceDetailsParams,
  ): Promise<UserViewsInvoiceDetailsResult> {
    const rows = await this.sql`
      SELECT
        id,
        user_id AS "userId",
        currency_blockchain_key AS "currencyBlockchainKey",
        currency_token_id AS "currencyTokenId",
        invoiced_amount AS "invoicedAmount",
        paid_amount AS "paidAmount",
        wallet_address AS "walletAddress",
        invoice_type AS "invoiceType",
        status,
        invoice_date AS "invoiceDate",
        due_date AS "dueDate",
        expired_date AS "expiredDate",
        paid_date AS "paidDate"
      FROM invoices
      WHERE id = ${params.invoiceId}
    `;

    if (rows.length === 0) {
      throw new Error('Invoice not found');
    }

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'userId');
      assertPropString(row, 'currencyBlockchainKey');
      assertPropString(row, 'currencyTokenId');
      assertPropString(row, 'walletAddress');
      assertPropString(row, 'invoiceType');
      assertPropString(row, 'status');
      assertProp(check(isString, isNumber), row, 'invoicedAmount');
      assertProp(check(isString, isNumber), row, 'paidAmount');
      assertProp(isInstanceOf(Date), row, 'invoiceDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'dueDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'expiredDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'paidDate');

      setPropValue(row, 'id', String(row.id));
      setPropValue(row, 'userId', String(row.userId));
      setPropValue(row, 'invoicedAmount', String(row.invoicedAmount));
      setPropValue(row, 'paidAmount', String(row.paidAmount));
      return row;
    });

    return rows[0];
  }

  async userRequestsWithdrawal(
    params: UserRequestsWithdrawalParams,
  ): Promise<UserRequestsWithdrawalResult> {
    const tx = await this.beginTransaction();
    try {
      const rows = await tx.sql`
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
          ${params.beneficiaryId},
          ${params.currencyBlockchainKey},
          ${params.currencyTokenId},
          ${params.amount},
          ${params.amount},
          ${params.requestDate.toISOString()},
          'Requested'
        )
        RETURNING
          id,
          beneficiary_id AS "beneficiaryId",
          amount,
          request_amount AS "requestAmount",
          status,
          request_date AS "requestDate"
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'beneficiaryId');
        assertProp(check(isString, isNumber), row, 'amount');
        assertProp(check(isString, isNumber), row, 'requestAmount');
        assertPropString(row, 'status');
        assertProp(isInstanceOf(Date), row, 'requestDate');

        setPropValue(row, 'id', String(row.id));
        setPropValue(row, 'beneficiaryId', String(row.beneficiaryId));
        setPropValue(row, 'amount', String(row.amount));
        setPropValue(row, 'requestAmount', String(row.requestAmount));
        return row;
      });

      await tx.commitTransaction();

      return rows[0];
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }
  // Withdrawal Management Methods
  async userRegistersWithdrawalBeneficiary(
    params: UserRegistersWithdrawalBeneficiaryParams,
  ): Promise<UserRegistersWithdrawalBeneficiaryResult> {
    const tx = await this.beginTransaction();
    try {
      const rows = await tx.sql`
        INSERT INTO beneficiaries (
          user_id,
          blockchain_key,
          address
        )
        VALUES (
          ${params.userId},
          ${params.blockchainKey},
          ${params.address}
        )
        RETURNING
          id,
          user_id AS "userId",
          blockchain_key AS "blockchainKey",
          address
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row);
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'userId');
        assertPropString(row, 'blockchainKey');
        assertPropString(row, 'address');

        setPropValue(row, 'id', String(row.id));
        setPropValue(row, 'userId', String(row.userId));
        return row;
      });

      await tx.commitTransaction();

      return rows[0];
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userViewsWithdrawalBeneficiaries(
    params: UserViewsWithdrawalBeneficiariesParams,
  ): Promise<UserViewsWithdrawalBeneficiariesResult> {
    const rows = await this.sql`
      SELECT
        id,
        user_id AS "userId",
        blockchain_key AS "blockchainKey",
        address
      FROM beneficiaries
      WHERE user_id = ${params.userId}
      ORDER BY blockchain_key, address
    `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'userId');
      assertPropString(row, 'blockchainKey');
      assertPropString(row, 'address');

      setPropValue(row, 'id', String(row.id));
      setPropValue(row, 'userId', String(row.userId));
      return row;
    });

    return {
      beneficiaries: rows,
    };
  }

  // Currency Management Methods
  async userViewsCurrencies(params: UserViewsCurrenciesParams): Promise<UserViewsCurrenciesResult> {
    const type = params.type ?? 'all';

    const rows = await this.sql`
      SELECT
        c.blockchain_key AS "blockchainKey",
        c.token_id AS "tokenId",
        c.name,
        c.symbol,
        c.decimals,
        c.image AS "logoUrl",
        c.withdrawal_fee_rate AS "withdrawalFeeRate",
        c.min_withdrawal_amount AS "minWithdrawalAmount",
        c.max_withdrawal_amount AS "maxWithdrawalAmount",
        c.max_daily_withdrawal_amount AS "maxDailyWithdrawalAmount",
        c.min_loan_principal_amount AS "minLoanPrincipalAmount",
        c.max_loan_principal_amount AS "maxLoanPrincipalAmount",
        c.max_ltv AS "maxLtv",
        c.ltv_warning_threshold AS "ltvWarningThreshold",
        c.ltv_critical_threshold AS "ltvCriticalThreshold",
        c.ltv_liquidation_threshold AS "ltvLiquidationThreshold",
        b.key AS "blockchainKey_ref",
        b.name AS "blockchainName",
        b.short_name AS "blockchainShortName",
        b.image AS "blockchainImage"
      FROM currencies c
      JOIN blockchains b ON c.blockchain_key = b.key
      WHERE (${params.blockchainKey}::text IS NULL OR c.blockchain_key = ${params.blockchainKey})
        AND (${params.minLtv}::numeric IS NULL OR c.max_ltv >= ${params.minLtv})
        AND (${params.maxLtv}::numeric IS NULL OR c.max_ltv <= ${params.maxLtv})
        AND (
          ${type}::text = 'all' OR
          (${type}::text = 'collateral' AND c.max_ltv > 0) OR
          (${type}::text = 'loan' AND c.symbol IN ('USDC', 'USDT', 'USD') AND c.max_ltv = 0)
        )
      ORDER BY
        CASE
          WHEN c.max_ltv > 0 THEN 0
          ELSE 1
        END,
        c.blockchain_key,
        c.token_id
    `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertPropString(row, 'blockchainKey');
      assertPropString(row, 'tokenId');
      assertPropString(row, 'name');
      assertPropString(row, 'symbol');
      assertProp(check(isString, isNumber), row, 'decimals');
      assertPropString(row, 'logoUrl');
      assertProp(check(isString, isNumber), row, 'withdrawalFeeRate');
      assertProp(check(isString, isNumber), row, 'minWithdrawalAmount');
      assertProp(check(isString, isNumber), row, 'maxWithdrawalAmount');
      assertProp(check(isString, isNumber), row, 'maxDailyWithdrawalAmount');
      assertProp(check(isString, isNumber), row, 'minLoanPrincipalAmount');
      assertProp(check(isString, isNumber), row, 'maxLoanPrincipalAmount');
      assertProp(check(isString, isNumber), row, 'maxLtv');
      assertProp(check(isString, isNumber), row, 'ltvWarningThreshold');
      assertProp(check(isString, isNumber), row, 'ltvCriticalThreshold');
      assertProp(check(isString, isNumber), row, 'ltvLiquidationThreshold');
      assertPropString(row, 'blockchainKey_ref');
      assertPropString(row, 'blockchainName');
      assertPropString(row, 'blockchainShortName');
      assertPropString(row, 'blockchainImage');

      const maxLtv = Number(row.maxLtv);

      setPropValue(row, 'decimals', Number(row.decimals));
      setPropValue(row, 'maxLtv', maxLtv);
      setPropValue(row, 'isCollateralCurrency', maxLtv > 0);
      setPropValue(
        row,
        'isLoanCurrency',
        (row.symbol === 'USDC' || row.symbol === 'USDT' || row.symbol === 'USD') && maxLtv === 0,
      );
      setPropValue(row, 'ltvWarningThreshold', Number(row.ltvWarningThreshold));
      setPropValue(row, 'ltvCriticalThreshold', Number(row.ltvCriticalThreshold));
      setPropValue(row, 'ltvLiquidationThreshold', Number(row.ltvLiquidationThreshold));
      setPropValue(row, 'minLoanPrincipalAmount', String(row.minLoanPrincipalAmount));
      setPropValue(row, 'maxLoanPrincipalAmount', String(row.maxLoanPrincipalAmount));
      setPropValue(row, 'minWithdrawalAmount', String(row.minWithdrawalAmount));
      setPropValue(row, 'maxWithdrawalAmount', String(row.maxWithdrawalAmount));
      setPropValue(row, 'maxDailyWithdrawalAmount', String(row.maxDailyWithdrawalAmount));
      setPropValue(row, 'withdrawalFeeRate', Number(row.withdrawalFeeRate));
      setPropValue(row, 'blockchain', {
        key: row.blockchainKey_ref,
        name: row.blockchainName,
        shortName: row.blockchainShortName,
        image: row.blockchainImage,
      });
      return row;
    });

    return {
      currencies: rows,
    };
  }

  async userViewsWithdrawals(
    params: UserViewsWithdrawalsParams,
  ): Promise<UserViewsWithdrawalsResult> {
    const validatedPage = Math.max(1, params.page ?? 1);
    const validatedLimit = Math.min(Math.max(1, params.limit ?? 20), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count with state filter
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      WHERE b.user_id = ${params.userId}
        AND (${params.state}::text IS NULL OR
          (${params.state} = 'requested' AND w.request_date IS NOT NULL AND w.sent_date IS NULL) OR
          (${params.state} = 'sent' AND w.sent_date IS NOT NULL AND w.confirmed_date IS NULL AND w.failed_date IS NULL) OR
          (${params.state} = 'confirmed' AND w.confirmed_date IS NOT NULL) OR
          (${params.state} = 'failed' AND w.failed_date IS NOT NULL)
        )
    `;

    assertArrayMapOf(countRows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'total');
      setPropValue(row, 'total', Number(row.total));
      return row;
    });
    const totalCount = countRows[0].total;
    const totalPages = Math.ceil(totalCount / validatedLimit);

    // Get withdrawals with comprehensive details and state filter
    const rows = await this.sql`
      SELECT
        w.id,
        w.beneficiary_id AS "beneficiaryId",
        b.address AS "beneficiaryAddress",
        b.blockchain_key AS "beneficiaryBlockchainKey",
        b.user_id AS "beneficiaryUserId",
        w.currency_blockchain_key AS "currencyBlockchainKey",
        w.currency_token_id AS "currencyTokenId",
        c.name AS "currencyName",
        c.symbol AS "currencySymbol",
        c.decimals AS "currencyDecimals",
        c.image AS "currencyImage",
        bc.name AS "blockchainName",
        bc.short_name AS "blockchainShortName",
        bc.image AS "blockchainImage",
        w.request_amount AS "requestAmount",
        w.status,
        w.request_date AS "requestDate",
        w.sent_date AS "sentDate",
        w.sent_amount AS "sentAmount",
        w.sent_hash AS "sentHash",
        w.confirmed_date AS "confirmedDate",
        w.failed_date AS "failedDate",
        w.failure_reason AS "failureReason"
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      JOIN currencies c ON w.currency_blockchain_key = c.blockchain_key
        AND w.currency_token_id = c.token_id
      LEFT JOIN blockchains bc ON b.blockchain_key = bc.key
      WHERE b.user_id = ${params.userId}
        AND (${params.state}::text IS NULL OR
          (${params.state} = 'requested' AND w.request_date IS NOT NULL AND w.sent_date IS NULL) OR
          (${params.state} = 'sent' AND w.sent_date IS NOT NULL AND w.confirmed_date IS NULL AND w.failed_date IS NULL) OR
          (${params.state} = 'confirmed' AND w.confirmed_date IS NOT NULL) OR
          (${params.state} = 'failed' AND w.failed_date IS NOT NULL)
        )
      ORDER BY w.request_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'beneficiaryId');
      assertPropString(row, 'beneficiaryAddress');
      assertPropString(row, 'beneficiaryBlockchainKey');
      assertProp(check(isString, isNumber), row, 'beneficiaryUserId');
      assertPropString(row, 'currencyBlockchainKey');
      assertPropString(row, 'currencyTokenId');
      assertPropString(row, 'currencySymbol');
      assertPropString(row, 'currencyName');
      assertProp(check(isString, isNumber), row, 'currencyDecimals');
      assertPropNullableString(row, 'currencyImage');
      assertPropNullableString(row, 'blockchainName');
      assertPropNullableString(row, 'blockchainShortName');
      assertPropNullableString(row, 'blockchainImage');
      assertProp(check(isString, isNumber), row, 'requestAmount');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'requestDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'sentDate');
      assertPropNullableString(row, 'sentAmount');
      assertPropNullableString(row, 'sentHash');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'confirmedDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'failedDate');
      assertPropNullableString(row, 'failureReason');

      const requestAmount = parseFloat(String(row.requestAmount));
      const sentAmount = row.sentAmount ? parseFloat(String(row.sentAmount)) : null;
      const networkFee = sentAmount
        ? (requestAmount - sentAmount).toString() + '.000000000000000000'
        : null;

      let calculatedState: string;
      if (row.failedDate) {
        calculatedState = 'failed';
      } else if (row.confirmedDate) {
        calculatedState = 'confirmed';
      } else if (row.sentDate && !row.confirmedDate && !row.failedDate) {
        calculatedState = 'sent';
      } else if (row.requestDate && !row.sentDate) {
        calculatedState = 'requested';
      } else {
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

      const blockchainExplorerUrl = row.sentHash
        ? this.generateBlockchainExplorerUrl(row.currencyBlockchainKey, row.sentHash)
        : null;

      const estimatedConfirmationTime =
        calculatedState === 'requested'
          ? this.getEstimatedConfirmationTime(row.currencyBlockchainKey)
          : null;

      return {
        id: String(row.id),
        currency: {
          blockchainKey: row.currencyBlockchainKey,
          tokenId: row.currencyTokenId,
          name: row.currencyName,
          symbol: row.currencySymbol,
          decimals: Number(row.currencyDecimals),
          logoUrl: row.currencyImage || undefined,
        },
        beneficiary: {
          id: String(row.beneficiaryId),
          blockchainKey: row.beneficiaryBlockchainKey,
          address: row.beneficiaryAddress,
          label: undefined,
          createdDate: row.requestDate,
          verifiedDate: row.requestDate,
          isActive: true,
          blockchain: {
            key: row.beneficiaryBlockchainKey,
            name: row.blockchainName || row.beneficiaryBlockchainKey,
            shortName: row.blockchainShortName || row.beneficiaryBlockchainKey,
            image: row.blockchainImage || undefined,
          },
        },
        requestAmount: String(row.requestAmount),
        sentAmount: row.sentAmount || undefined,
        networkFee: networkFee || undefined,
        platformFee: '0.000000000000000000',
        requestDate: row.requestDate,
        sentDate: row.sentDate || undefined,
        sentHash: row.sentHash || undefined,
        confirmedDate: row.confirmedDate || undefined,
        failedDate: row.failedDate || undefined,
        failureReason: row.failureReason || undefined,
        state: calculatedState,
        blockchainExplorerUrl: blockchainExplorerUrl || undefined,
        estimatedConfirmationTime: estimatedConfirmationTime || undefined,
      };
    });

    return {
      withdrawals: rows,
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

  async userViewsWithdrawalDetails(
    params: UserViewsWithdrawalDetailsParams,
  ): Promise<UserViewsWithdrawalDetailsResult> {
    const rows = await this.sql`
      SELECT
        w.id,
        w.beneficiary_id AS "beneficiaryId",
        b.address AS "beneficiaryAddress",
        b.blockchain_key AS "beneficiaryBlockchainKey",
        b.user_id AS "beneficiaryUserId",
        w.currency_blockchain_key AS "currencyBlockchainKey",
        w.currency_token_id AS "currencyTokenId",
        c.symbol AS "currencySymbol",
        c.name AS "currencyName",
        c.decimals AS "currencyDecimals",
        c.image AS "currencyImage",
        bc.name AS "blockchainName",
        bc.short_name AS "blockchainShortName",
        bc.image AS "blockchainImage",
        w.amount,
        w.request_amount AS "requestAmount",
        w.status,
        w.request_date AS "requestDate",
        w.sent_date AS "sentDate",
        w.sent_amount AS "sentAmount",
        w.sent_hash AS "sentHash",
        w.confirmed_date AS "confirmedDate",
        w.failed_date AS "failedDate",
        w.failure_reason AS "failureReason"
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      JOIN currencies c ON w.currency_blockchain_key = c.blockchain_key
        AND w.currency_token_id = c.token_id
      LEFT JOIN blockchains bc ON b.blockchain_key = bc.key
      WHERE w.id = ${params.withdrawalId} AND b.user_id = ${params.userId}
    `;

    if (rows.length === 0) {
      return { withdrawal: null };
    }

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'beneficiaryId');
      assertPropString(row, 'beneficiaryAddress');
      assertPropString(row, 'beneficiaryBlockchainKey');
      assertProp(check(isString, isNumber), row, 'beneficiaryUserId');
      assertPropString(row, 'currencyBlockchainKey');
      assertPropString(row, 'currencyTokenId');
      assertPropString(row, 'currencySymbol');
      assertPropString(row, 'currencyName');
      assertProp(check(isString, isNumber), row, 'currencyDecimals');
      assertPropNullableString(row, 'currencyImage');
      assertPropNullableString(row, 'blockchainName');
      assertPropNullableString(row, 'blockchainShortName');
      assertPropNullableString(row, 'blockchainImage');
      assertProp(check(isString, isNumber), row, 'amount');
      assertProp(check(isString, isNumber), row, 'requestAmount');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'requestDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'sentDate');
      assertPropNullableString(row, 'sentAmount');
      assertPropNullableString(row, 'sentHash');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'confirmedDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'failedDate');
      assertPropNullableString(row, 'failureReason');

      const requestAmount = parseFloat(String(row.requestAmount));
      const sentAmount = row.sentAmount ? parseFloat(String(row.sentAmount)) : null;
      const networkFee = sentAmount
        ? (requestAmount - sentAmount).toString() + '.000000000000000000'
        : null;

      let calculatedState: string;
      if (row.failedDate) {
        calculatedState = 'failed';
      } else if (row.confirmedDate) {
        calculatedState = 'confirmed';
      } else if (row.sentDate && !row.confirmedDate && !row.failedDate) {
        calculatedState = 'sent';
      } else if (row.requestDate && !row.sentDate) {
        calculatedState = 'requested';
      } else {
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

      const blockchainExplorerUrl = row.sentHash
        ? this.generateBlockchainExplorerUrl(row.currencyBlockchainKey, row.sentHash)
        : null;

      const estimatedConfirmationTime =
        calculatedState === 'requested'
          ? this.getEstimatedConfirmationTime(row.currencyBlockchainKey)
          : null;

      return {
        id: String(row.id),
        currency: {
          blockchainKey: row.currencyBlockchainKey,
          tokenId: row.currencyTokenId,
          name: row.currencyName,
          symbol: row.currencySymbol,
          decimals: Number(row.currencyDecimals),
          logoUrl: row.currencyImage || undefined,
        },
        beneficiary: {
          id: String(row.beneficiaryId),
          blockchainKey: row.beneficiaryBlockchainKey,
          address: row.beneficiaryAddress,
          label: undefined,
          createdDate: row.requestDate,
          verifiedDate: row.requestDate,
          isActive: true,
          blockchain: {
            key: row.beneficiaryBlockchainKey,
            name: row.blockchainName || row.beneficiaryBlockchainKey,
            shortName: row.blockchainShortName || row.beneficiaryBlockchainKey,
            image: row.blockchainImage || undefined,
          },
        },
        requestAmount: String(row.requestAmount),
        sentAmount: row.sentAmount || undefined,
        networkFee: networkFee || undefined,
        platformFee: '0.000000000000000000',
        requestDate: row.requestDate,
        sentDate: row.sentDate || undefined,
        sentHash: row.sentHash || undefined,
        confirmedDate: row.confirmedDate || undefined,
        failedDate: row.failedDate || undefined,
        failureReason: row.failureReason || undefined,
        state: calculatedState,
        blockchainExplorerUrl: blockchainExplorerUrl || undefined,
        estimatedConfirmationTime: estimatedConfirmationTime || undefined,
      };
    });

    return { withdrawal: rows[0] };
  }

  // Blockchain Management Methods
  async userViewsBlockchains(
    params: UserViewsBlockchainsParams,
  ): Promise<UserViewsBlockchainsResult> {
    const rows = await this.sql`
      SELECT
        key,
        name,
        short_name AS "shortName",
        image
      FROM blockchains
      WHERE key != 'crosschain'
      ORDER BY
        CASE key
          WHEN 'bip122:000000000019d6689c085ae165831e93' THEN 1
          WHEN 'eip155:1' THEN 2
          WHEN 'eip155:56' THEN 3
          WHEN 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' THEN 4
          ELSE 5
        END,
        name
    `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertPropString(row, 'key');
      assertPropString(row, 'name');
      assertPropString(row, 'shortName');
      assertPropString(row, 'image');
      return row;
    });

    return {
      blockchains: rows,
    };
  }

  // Portfolio Management Methods
  async userRetrievesPortfolioAnalytics(
    params: UserRetrievesPortfolioAnalyticsParams,
  ): Promise<PortfolioAnalyticsResult> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const periodStart = new Date(currentYear, currentMonth, 1);
    const periodEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const balanceResult = await this.userRetrievesAccountBalances({ userId: params.userId });
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
    const balanceResult = await this.userRetrievesAccountBalances({ userId: params.userId });
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
