import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropNullableString,
  assertPropString,
  check,
  hasPropArray,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import {
  BorrowerCreatesLoanApplicationParams,
  BorrowerCreatesLoanApplicationResult,
  BorrowerGetsCurrencyPairParams,
  BorrowerGetsCurrencyPairResult,
  BorrowerGetsExchangeRateParams,
  BorrowerGetsExchangeRateResult,
  BorrowerGetsLoanAmountsParams,
  BorrowerGetsLoanAmountsResult,
  BorrowerGetsPlatformConfigParams,
  BorrowerGetsPlatformConfigResult,
  BorrowerRepaysLoanParams,
  BorrowerRepaysLoanResult,
  BorrowerRequestsEarlyLiquidationEstimateParams,
  BorrowerRequestsEarlyLiquidationEstimateResult,
  BorrowerRequestsEarlyLiquidationParams,
  BorrowerRequestsEarlyLiquidationResult,
  BorrowerRequestsEarlyRepaymentParams,
  BorrowerRequestsEarlyRepaymentResult,
  BorrowerUpdatesLoanApplicationParams,
  BorrowerUpdatesLoanApplicationResult,
  BorrowerViewsMyLoanApplicationsParams,
  BorrowerViewsMyLoanApplicationsResult,
  PlatformUpdatesLiquidationTargetAmountParams,
  PlatformUpdatesLiquidationTargetAmountResult,
} from './loan.types';
import { LoanLenderRepository } from './loan-lender.repository';

/**
 * LoanBorrowerRepository <- LoanLenderRepository <- LoanTestRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
export abstract class LoanBorrowerRepository extends LoanLenderRepository {
  /**
   * Data-only method: Get currency pair details without calculations
   */
  async borrowerGetsCurrencyPair(
    params: BorrowerGetsCurrencyPairParams,
  ): Promise<BorrowerGetsCurrencyPairResult> {
    const rows = await this.sql`
      SELECT
        jsonb_build_object(
          'blockchainKey', c1.blockchain_key,
          'tokenId', c1.token_id,
          'decimals', c1.decimals,
          'symbol', c1.symbol,
          'name', c1.name
        ) as "principalCurrency",
        jsonb_build_object(
          'blockchainKey', c2.blockchain_key,
          'tokenId', c2.token_id,
          'decimals', c2.decimals,
          'symbol', c2.symbol,
          'name', c2.name
        ) as "collateralCurrency"
      FROM currencies c1
      CROSS JOIN currencies c2
      WHERE c1.blockchain_key = ${params.principalBlockchainKey}
        AND c1.token_id = ${params.principalTokenId}
        AND c2.blockchain_key = ${params.collateralBlockchainKey}
        AND c2.token_id = ${params.collateralTokenId}
    `;

    if (rows.length === 0) {
      throw new Error(
        `Currency pair ${params.principalBlockchainKey}:${params.principalTokenId} or ${params.collateralBlockchainKey}:${params.collateralTokenId} does not exist`,
      );
    }

    assertArrayMapOf(rows, function (row) {
      assertDefined(row, 'Currency validation failed');
      return row as BorrowerGetsCurrencyPairResult;
    });

    return rows[0];
  }

  /**
   * Data-only method: Get platform configuration without calculations
   */
  async borrowerGetsPlatformConfig(
    params: BorrowerGetsPlatformConfigParams,
  ): Promise<BorrowerGetsPlatformConfigResult> {
    const rows = await this.sql`
      SELECT
        loan_provision_rate as "loanProvisionRate",
        loan_min_ltv_ratio as "loanMinLtvRatio",
        loan_max_ltv_ratio as "loanMaxLtvRatio"
      FROM platform_configs
      WHERE effective_date <= ${params.effectiveDate.toISOString()}
      ORDER BY effective_date DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new Error('Platform configuration not found');
    }

    return assertArrayMapOf(rows, function (row) {
      assertDefined(row, 'Platform config is undefined');
      assertProp(check(isString, isNumber), row, 'loanProvisionRate');
      assertProp(check(isString, isNumber), row, 'loanMinLtvRatio');
      assertProp(check(isString, isNumber), row, 'loanMaxLtvRatio');
      return row;
    })[0];
  }

  /**
   * Data-only method: Get exchange rate without calculations
   */
  async borrowerGetsExchangeRate(
    params: BorrowerGetsExchangeRateParams,
  ): Promise<BorrowerGetsExchangeRateResult> {
    const { collateralBlockchainKey, collateralTokenId, asOfDate } = params;

    // For test currencies on cg:testnet, we need to look for rates on that specific blockchain
    // For production currencies, we use crosschain rates
    const blockchainKey = collateralBlockchainKey || 'crosschain';

    // Determine quote currency based on blockchain
    // For cg:testnet, use mock:usd, otherwise use iso4217:usd
    const quoteCurrency = blockchainKey === 'cg:testnet' ? 'mock:usd' : 'iso4217:usd';

    let exchangeRateRows;
    if (asOfDate) {
      exchangeRateRows = await this.sql`
        SELECT
          er.id,
          er.bid_price AS "bidPrice",
          er.ask_price AS "askPrice",
          er.source_date AS "sourceDate"
        FROM exchange_rates er
        JOIN price_feeds pf ON er.price_feed_id = pf.id
        WHERE pf.blockchain_key = ${blockchainKey}
          AND ((pf.base_currency_token_id = ${collateralTokenId} AND pf.quote_currency_token_id = ${quoteCurrency})
               OR (pf.base_currency_token_id = ${quoteCurrency} AND pf.quote_currency_token_id = ${collateralTokenId}))
          AND er.source_date <= ${asOfDate.toISOString()}
        ORDER BY er.source_date DESC
        LIMIT 1
      `;
    } else {
      exchangeRateRows = await this.sql`
        SELECT
          er.id,
          er.bid_price AS "bidPrice",
          er.ask_price AS "askPrice",
          er.source_date AS "sourceDate"
        FROM exchange_rates er
        JOIN price_feeds pf ON er.price_feed_id = pf.id
        WHERE pf.blockchain_key = ${blockchainKey}
          AND ((pf.base_currency_token_id = ${collateralTokenId} AND pf.quote_currency_token_id = ${quoteCurrency})
               OR (pf.base_currency_token_id = ${quoteCurrency} AND pf.quote_currency_token_id = ${collateralTokenId}))
        ORDER BY er.source_date DESC
        LIMIT 1
      `;
    }

    return assertArrayMapOf(exchangeRateRows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'bidPrice');
      assertProp(check(isString, isNumber), row, 'askPrice');
      assertProp(isInstanceOf(Date), row, 'sourceDate');
      // Convert numeric fields to strings for consistency
      return {
        id: String(row.id),
        bidPrice: String(row.bidPrice),
        askPrice: String(row.askPrice),
        sourceDate: row.sourceDate,
      };
    })[0];
  }

  /**
   * Data-only method: Create mock exchange rate for testing purposes
   * NOTE: This method should only be used in test environments
   */
  async testCreatesMockExchangeRate(
    collateralTokenId: string,
    mockRate: string,
    appliedDate: Date,
  ): Promise<BorrowerGetsExchangeRateResult> {
    const tx = await this.beginTransaction();
    try {
      // First check if price feed exists, then create if not
      const priceFeedRows = await tx.sql`
        SELECT id FROM price_feeds
        WHERE blockchain_key = 'crosschain'
          AND base_currency_token_id = ${collateralTokenId}
          AND quote_currency_token_id = 'iso4217:usd'
          AND source = 'random'
      `;

      let priceFeedId;
      if (priceFeedRows.length === 0) {
        const insertResult = await tx.sql`
          INSERT INTO price_feeds (
            blockchain_key,
            base_currency_token_id,
            quote_currency_token_id,
            source
          ) VALUES (
            'crosschain',
            ${collateralTokenId},
            'iso4217:usd',
            'random'
          )
          RETURNING id
        `;
        assertDefined(insertResult[0], 'Price feed insert failed');
        assertProp(check(isString, isNumber), insertResult[0], 'id');
        priceFeedId = insertResult[0].id;
      } else {
        assertDefined(priceFeedRows[0], 'Price feed query failed');
        assertProp(check(isString, isNumber), priceFeedRows[0], 'id');
        priceFeedId = priceFeedRows[0].id;
      }

      const exchangeRateInsertRows = await tx.sql`
        INSERT INTO exchange_rates (
          price_feed_id,
          bid_price,
          ask_price,
          retrieval_date,
          source_date
        ) VALUES (
          ${priceFeedId},
          ${mockRate},
          ${mockRate},
          ${appliedDate.toISOString()},
          ${appliedDate.toISOString()}
        )
        RETURNING id::text as id, bid_price::text as "bidPrice", ask_price::text as "askPrice", source_date as "sourceDate"
      `;

      if (exchangeRateInsertRows.length === 0) {
        throw new Error('Failed to create exchange rate record');
      }

      const result = assertArrayMapOf(exchangeRateInsertRows, function (row) {
        assertDefined(row, 'Exchange rate insert failed');
        assertPropString(row, 'id');
        assertPropString(row, 'bidPrice');
        assertPropString(row, 'askPrice');
        assertProp(isInstanceOf(Date), row, 'sourceDate');
        return row;
      })[0];

      await tx.commitTransaction();

      return result;
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Data-only method: Create loan application with pre-calculated values (no business logic)
   */
  async borrowerCreatesLoanApplication(
    params: BorrowerCreatesLoanApplicationParams,
  ): Promise<BorrowerCreatesLoanApplicationResult> {
    const tx = await this.beginTransaction();
    try {
      const currencies = await this.borrowerGetsCurrencyPair(params);

      const loanApplication = assertArrayMapOf(
        await tx.sql`
        INSERT INTO loan_applications (
          borrower_user_id,
          loan_offer_id,
          principal_currency_blockchain_key,
          principal_currency_token_id,
          principal_amount,
          provision_amount,
          max_interest_rate,
          min_ltv_ratio,
          max_ltv_ratio,
          term_in_months,
          liquidation_mode,
          collateral_currency_blockchain_key,
          collateral_currency_token_id,
          collateral_deposit_amount,
          collateral_deposit_exchange_rate_id,
          status,
          applied_date,
          expired_date
        )
        VALUES (
          ${params.borrowerUserId},
          ${params.loanOfferId || null},
          ${params.principalBlockchainKey},
          ${params.principalTokenId},
          ${params.principalAmount},
          ${params.provisionAmount},
          ${params.maxInterestRate},
          ${params.minLtvRatio},
          ${params.maxLtvRatio},
          ${params.termInMonths},
          ${params.liquidationMode},
          ${params.collateralBlockchainKey},
          ${params.collateralTokenId},
          ${params.collateralDepositAmount},
          ${params.collateralDepositExchangeRateId},
          'PendingCollateral',
          ${params.appliedDate.toISOString()},
          ${params.expirationDate.toISOString()}
        )
        RETURNING
          id::text as id,
          borrower_user_id::text as "borrowerUserId",
          loan_offer_id::text as "loanOfferId",
          principal_amount::text as "principalAmount",
          provision_amount::text as "provisionAmount",
          max_interest_rate::numeric as "maxInterestRate",
          min_ltv_ratio::numeric as "minLtvRatio",
          max_ltv_ratio::numeric as "maxLtvRatio",
          term_in_months::int as "termInMonths",
          liquidation_mode as "liquidationMode",
          collateral_deposit_amount::text as "collateralDepositAmount",
          status,
          applied_date as "appliedDate",
          expired_date as "expirationDate"
      `,
        function (row) {
          assertDefined(row, 'Loan application creation failed');
          assertPropString(row, 'id');
          assertPropString(row, 'borrowerUserId');
          assertProp(check(isNullable, isString), row, 'loanOfferId');
          assertPropString(row, 'principalAmount');
          assertPropString(row, 'provisionAmount');
          assertProp(check(isString, isNumber), row, 'maxInterestRate');
          assertProp(check(isString, isNumber), row, 'minLtvRatio');
          assertProp(check(isString, isNumber), row, 'maxLtvRatio');
          assertProp(check(isString, isNumber), row, 'termInMonths');
          assertPropString(row, 'liquidationMode');
          assertPropString(row, 'collateralDepositAmount');
          assertPropString(row, 'status');
          assertProp(isInstanceOf(Date), row, 'appliedDate');
          assertProp(isInstanceOf(Date), row, 'expirationDate');
          return row;
        },
      )[0];

      const invoice = assertArrayMapOf(
        await tx.sql`
        INSERT INTO invoices (
          id,
          user_id,
          currency_blockchain_key,
          currency_token_id,
          account_blockchain_key,
          account_token_id,
          invoiced_amount,
          prepaid_amount,
          wallet_derivation_path,
          wallet_address,
          invoice_type,
          status,
          draft_date,
          invoice_date,
          due_date,
          expired_date,
          loan_application_id
        )
        VALUES (
          ${params.collateralInvoiceId},
          ${params.borrowerUserId},
          ${params.collateralBlockchainKey},
          ${params.collateralTokenId},
          ${params.collateralAccountBlockchainKey ?? null},
          ${params.collateralAccountTokenId ?? null},
          ${params.collateralDepositAmount},
          ${params.collateralInvoicePrepaidAmount},
          ${params.collateralWalletDerivationPath},
          ${params.collateralWalletAddress},
          'LoanCollateral',
          'Pending',
          ${params.collateralInvoiceDate.toISOString()},
          ${params.collateralInvoiceDate.toISOString()},
          ${params.collateralInvoiceDueDate.toISOString()},
          ${params.collateralInvoiceExpiredDate.toISOString()},
          ${loanApplication.id}
        )
        RETURNING
          id::text as id,
          invoiced_amount::text as amount,
          status,
          invoice_date as "createdDate",
          COALESCE(due_date, expired_date) as "expiryDate",
          paid_date as "paidDate"
      `,
        function (row) {
          assertDefined(row, 'Invoice row is undefined');
          assertPropString(row, 'id');
          assertPropString(row, 'amount');
          assertPropString(row, 'status');
          assertProp(isInstanceOf(Date), row, 'createdDate');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'expiryDate');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'paidDate');
          return row;
        },
      )[0];

      await tx.commitTransaction();

      return {
        id: loanApplication.id,
        borrowerUserId: loanApplication.borrowerUserId,
        loanOfferId: loanApplication.loanOfferId || undefined,
        principalCurrency: currencies.principalCurrency,
        principalAmount: loanApplication.principalAmount,
        provisionAmount: loanApplication.provisionAmount,
        maxInterestRate: Number(loanApplication.maxInterestRate),
        minLtvRatio: Number(loanApplication.minLtvRatio),
        maxLtvRatio: Number(loanApplication.maxLtvRatio),
        termInMonths: Number(loanApplication.termInMonths),
        liquidationMode: loanApplication.liquidationMode as 'Partial' | 'Full',
        collateralCurrency: currencies.collateralCurrency,
        collateralDepositAmount: loanApplication.collateralDepositAmount,
        status: loanApplication.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Cancelled'
          | 'Closed'
          | 'Expired',
        loanApplicationStatus: loanApplication.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Cancelled'
          | 'Closed'
          | 'Expired',
        appliedDate: loanApplication.appliedDate,
        expirationDate: loanApplication.expirationDate,
        collateralDepositInvoice: {
          ...invoice,
          currency: currencies.collateralCurrency,
          status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
          expiryDate: invoice.expiryDate || params.expirationDate,
          paidDate: invoice.paidDate || undefined,
        },
        collateralInvoice: {
          ...invoice,
          currency: currencies.collateralCurrency,
          status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
          expiryDate: invoice.expiryDate || params.expirationDate,
          paidDate: invoice.paidDate || undefined,
        },
        collateralDepositExchangeRateId: String(params.collateralDepositExchangeRateId),
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerUpdatesLoanApplication(
    params: BorrowerUpdatesLoanApplicationParams,
  ): Promise<BorrowerUpdatesLoanApplicationResult> {
    const tx = await this.beginTransaction();
    try {
      const currentApplication = assertArrayMapOf(
        await tx.sql`
        SELECT status, expired_date as "expiredDate"
        FROM loan_applications
        WHERE id = ${params.loanApplicationId} AND borrower_user_id = ${params.borrowerUserId}
      `,
        function (row) {
          assertDefined(row, 'Current application validation failed');
          assertPropString(row, 'status');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'expiredDate');
          return row;
        },
      )[0];

      if (!currentApplication) {
        throw new Error('Loan application not found or access denied');
      }

      let newStatus: string;
      let closedDate: Date | null = null;
      let newExpirationDate: Date | null = null;

      switch (params.action) {
        case 'cancel':
          if (!['PendingCollateral', 'Published'].includes(currentApplication.status)) {
            throw new Error(`Cannot cancel application from status: ${currentApplication.status}`);
          }
          newStatus = 'Cancelled';
          closedDate = params.updateDate;
          break;

        case 'modify':
          if (currentApplication.status !== 'PendingCollateral') {
            throw new Error(`Cannot modify application from status: ${currentApplication.status}`);
          }
          newStatus = currentApplication.status;
          if (params.expirationDate) {
            newExpirationDate = params.expirationDate;
          }
          break;

        default:
          throw new Error(`Invalid action: ${params.action}`);
      }

      const updatedApplication = assertArrayMapOf(
        await tx.sql`
        UPDATE loan_applications
        SET
          status = ${newStatus},
          closed_date = ${closedDate?.toISOString() || null},
          closure_reason = ${params.closureReason || null},
          expired_date = ${newExpirationDate?.toISOString() || currentApplication.expiredDate}
        WHERE id = ${params.loanApplicationId} AND borrower_user_id = ${params.borrowerUserId}
        RETURNING
          id::text as id,
          status,
          expired_date as "expirationDate",
          closure_reason as "closureReason"
      `,
        function (row) {
          assertDefined(row, 'Updated application validation failed');
          assertPropString(row, 'id');
          assertPropString(row, 'status');
          assertProp(isInstanceOf(Date), row, 'expirationDate');
          assertProp(check(isNullable, isString), row, 'closureReason');
          return row;
        },
      )[0];

      if (!updatedApplication) {
        throw new Error('Loan application update failed');
      }

      await tx.commitTransaction();

      return {
        id: updatedApplication.id,
        status: updatedApplication.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Cancelled'
          | 'Closed'
          | 'Expired',
        updatedDate: params.updateDate,
        expirationDate: updatedApplication.expirationDate,
        closureReason: updatedApplication.closureReason || undefined,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerViewsMyLoanApplications(
    params: BorrowerViewsMyLoanApplicationsParams,
  ): Promise<BorrowerViewsMyLoanApplicationsResult> {
    const validatedPage = Math.max(1, params.page ?? 1);
    const validatedLimit = Math.min(Math.max(1, params.limit ?? 20), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM loan_applications
      WHERE borrower_user_id = ${params.borrowerUserId}
        AND (${params.status}::text IS NULL OR status = ${params.status})
    `;

    const totalCount = Number(
      assertArrayMapOf(countRows, function (row) {
        assertDefined(row, 'Count query failed');
        assertProp(check(isString, isNumber), row, 'total');
        return row;
      })[0].total,
    );

    // Get loan applications with currency details
    const applicationRows = await this.sql`
      SELECT
        la.id::text as id,
        la.loan_offer_id::text as "loanOfferId",
        jsonb_build_object(
          'blockchainKey', c1.blockchain_key,
          'tokenId', c1.token_id,
          'decimals', c1.decimals,
          'symbol', c1.symbol,
          'name', c1.name
        ) as "principalCurrency",
        la.principal_amount::text as "principalAmount",
        la.provision_amount::text as "provisionAmount",
        la.max_interest_rate::numeric as "maxInterestRate",
        la.min_ltv_ratio::numeric as "minLtvRatio",
        la.max_ltv_ratio::numeric as "maxLtvRatio",
        la.term_in_months::int as "termInMonths",
        la.liquidation_mode as "liquidationMode",
        jsonb_build_object(
          'blockchainKey', c2.blockchain_key,
          'tokenId', c2.token_id,
          'decimals', c2.decimals,
          'symbol', c2.symbol,
          'name', c2.name
        ) as "collateralCurrency",
        la.collateral_deposit_amount::text as "collateralDepositAmount",
        la.status,
        la.applied_date as "appliedDate",
        la.expired_date as "expirationDate",
        la.published_date as "publishedDate",
        la.matched_date as "matchedDate",
        la.matched_loan_offer_id::text as "matchedLoanOfferId",
        la.closed_date as "closedDate",
        la.closure_reason as "closureReason"
      FROM loan_applications la
      JOIN currencies c1 ON la.principal_currency_blockchain_key = c1.blockchain_key
        AND la.principal_currency_token_id = c1.token_id
      JOIN currencies c2 ON la.collateral_currency_blockchain_key = c2.blockchain_key
        AND la.collateral_currency_token_id = c2.token_id
      WHERE la.borrower_user_id = ${params.borrowerUserId}
        AND (${params.status}::text IS NULL OR la.status = ${params.status})
      ORDER BY la.applied_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const loanApplications = applicationRows.map(function (row: unknown) {
      assertDefined(row, 'Loan application row is undefined');
      assertPropString(row, 'id');
      assertProp(check(isNullable, isString), row, 'loanOfferId');
      // JSONB objects from PostgreSQL are returned as plain objects
      assertPropString(row, 'principalAmount');
      assertPropString(row, 'provisionAmount');
      assertProp(check(isString, isNumber), row, 'maxInterestRate');
      assertProp(check(isString, isNumber), row, 'minLtvRatio');
      assertProp(check(isString, isNumber), row, 'maxLtvRatio');
      assertProp(check(isString, isNumber), row, 'termInMonths');
      assertPropString(row, 'liquidationMode');
      assertPropString(row, 'collateralDepositAmount');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'appliedDate');
      assertProp(isInstanceOf(Date), row, 'expirationDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'publishedDate');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'matchedDate');
      assertProp(check(isNullable, isString), row, 'matchedLoanOfferId');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'closedDate');
      assertProp(check(isNullable, isString), row, 'closureReason');

      const r = row as any; // Cast to access JSONB properties

      return {
        id: row.id,
        loanOfferId: row.loanOfferId || undefined,
        principalCurrency: r.principalCurrency,
        principalAmount: row.principalAmount,
        provisionAmount: row.provisionAmount,
        maxInterestRate: Number(row.maxInterestRate),
        minLtvRatio: Number(row.minLtvRatio),
        maxLtvRatio: Number(row.maxLtvRatio),
        termInMonths: Number(row.termInMonths),
        liquidationMode: row.liquidationMode as 'Partial' | 'Full',
        collateralCurrency: r.collateralCurrency,
        collateralDepositAmount: row.collateralDepositAmount,
        status: row.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Cancelled'
          | 'Closed'
          | 'Expired',
        appliedDate: row.appliedDate,
        expirationDate: row.expirationDate,
        publishedDate: row.publishedDate || undefined,
        matchedDate: row.matchedDate || undefined,
        matchedLoanOfferId: row.matchedLoanOfferId || undefined,
        closedDate: row.closedDate || undefined,
        closureReason: row.closureReason || undefined,
      };
    });

    const totalPages = Math.ceil(totalCount / validatedLimit);

    return {
      loanApplications,
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

  async borrowerRepaysLoan(params: BorrowerRepaysLoanParams): Promise<BorrowerRepaysLoanResult> {
    const tx = await this.beginTransaction();
    try {
      const loan = assertArrayMapOf(
        await tx.sql`
        SELECT
          l.id,
          l.principal_currency_blockchain_key,
          l.principal_currency_token_id,
          l.repayment_amount,
          l.status,
          la.borrower_user_id,
          c.decimals,
          c.symbol,
          c.name
        FROM loans l
        JOIN loan_applications la ON l.loan_application_id = la.id
        JOIN currencies c ON l.principal_currency_blockchain_key = c.blockchain_key
          AND l.principal_currency_token_id = c.token_id
        WHERE l.id = ${params.loanId} AND la.borrower_user_id = ${params.borrowerUserId}
      `,
        function (row) {
          assertDefined(row, 'Loan validation failed');
          assertProp(check(isString, isNumber), row, 'id');
          assertPropString(row, 'principal_currency_blockchain_key');
          assertPropString(row, 'principal_currency_token_id');
          assertProp(check(isString, isNumber), row, 'repayment_amount');
          assertPropString(row, 'status');
          assertProp(check(isString, isNumber), row, 'borrower_user_id');
          assertProp(check(isString, isNumber), row, 'decimals');
          assertPropString(row, 'symbol');
          assertPropString(row, 'name');
          return row;
        },
      )[0];

      if (!loan) {
        throw new Error('Loan not found or access denied');
      }

      if (loan.status !== 'Active') {
        throw new Error(`Cannot repay loan with status: ${loan.status}`);
      }

      // Use provided wallet information for repayment invoice

      const invoice = assertArrayMapOf(
        await tx.sql`
        INSERT INTO invoices (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          invoiced_amount,
          wallet_derivation_path,
          wallet_address,
          invoice_type,
          status,
          draft_date,
          invoice_date,
          due_date,
          loan_id
        )
        VALUES (
          ${params.borrowerUserId},
          ${loan.principal_currency_blockchain_key},
          ${loan.principal_currency_token_id},
          ${loan.repayment_amount},
          ${params.repaymentWalletDerivationPath},
          ${params.repaymentWalletAddress},
          'LoanRepayment',
          'Pending',
          ${params.repaymentDate.toISOString()},
          ${params.repaymentDate.toISOString()},
          ${new Date(params.repaymentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()}, -- 7 days to pay
          ${params.loanId}
        )
        RETURNING
          id,
          invoiced_amount,
          status,
          invoice_date,
          due_date,
          expired_date,
          paid_date
      `,
        function (row) {
          assertDefined(row, 'Repayment invoice creation failed');
          assertProp(check(isString, isNumber), row, 'id');
          assertProp(check(isString, isNumber), row, 'invoiced_amount');
          assertPropString(row, 'status');
          assertProp(isInstanceOf(Date), row, 'invoice_date');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'due_date');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'expired_date');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'paid_date');
          return row;
        },
      )[0];

      // Create loan repayment record
      await tx.sql`
        INSERT INTO loan_repayments (
          loan_id,
          repayment_initiator,
          repayment_invoice_id,
          repayment_invoice_date
        )
        VALUES (
          ${params.loanId},
          'Borrower',
          ${invoice.id},
          ${params.repaymentDate.toISOString()}
        )
        ON CONFLICT (loan_id) DO UPDATE SET
          repayment_initiator = 'Borrower',
          repayment_invoice_id = ${invoice.id},
          repayment_invoice_date = ${params.repaymentDate.toISOString()}
      `;

      await tx.commitTransaction();

      return {
        id: String(params.loanId),
        status: 'Active', // Status will change to 'Repaid' when invoice is paid
        repaymentInvoice: {
          id: String(invoice.id),
          amount: String(invoice.invoiced_amount),
          currency: {
            blockchainKey: loan.principal_currency_blockchain_key,
            tokenId: loan.principal_currency_token_id,
            decimals: Number(loan.decimals),
            symbol: loan.symbol,
            name: loan.name,
          },
          status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
          createdDate: invoice.invoice_date,
          expiryDate:
            invoice.due_date ||
            invoice.expired_date ||
            new Date(params.repaymentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          paidDate: invoice.paid_date || undefined,
        },
        concludedDate: params.repaymentDate,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerRequestsEarlyLiquidationEstimate(
    params: BorrowerRequestsEarlyLiquidationEstimateParams,
  ): Promise<BorrowerRequestsEarlyLiquidationEstimateResult> {
    const loan = assertArrayMapOf(
      await this.sql`
      SELECT
        l.id,
        l.principal_amount,
        l.interest_amount,
        l.premi_amount,
        l.liquidation_fee_amount,
        l.repayment_amount,
        l.collateral_amount,
        l.principal_currency_blockchain_key,
        l.principal_currency_token_id,
        l.collateral_currency_blockchain_key,
        l.collateral_currency_token_id,
        l.status,
        l.mc_ltv_ratio,
        la.borrower_user_id,
        la.liquidation_mode,
        pc.decimals as principal_decimals,
        pc.symbol as principal_symbol,
        pc.name as principal_name,
        cc.decimals as collateral_decimals,
        cc.symbol as collateral_symbol,
        cc.name as collateral_name
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      JOIN currencies pc ON l.principal_currency_blockchain_key = pc.blockchain_key
        AND l.principal_currency_token_id = pc.token_id
      JOIN currencies cc ON la.collateral_currency_blockchain_key = cc.blockchain_key
        AND la.collateral_currency_token_id = cc.token_id
      WHERE l.id = ${params.loanId} AND la.borrower_user_id = ${params.borrowerUserId}
    `,
      function (row) {
        assertDefined(row, 'Loan validation failed');
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'principal_amount');
        assertProp(check(isString, isNumber), row, 'interest_amount');
        assertProp(check(isString, isNumber), row, 'premi_amount');
        assertProp(check(isString, isNumber), row, 'liquidation_fee_amount');
        assertProp(check(isString, isNumber), row, 'repayment_amount');
        assertProp(check(isString, isNumber), row, 'collateral_amount');
        assertPropString(row, 'status');
        assertProp(check(isString, isNumber), row, 'mc_ltv_ratio');
        assertPropString(row, 'liquidation_mode');
        assertPropString(row, 'collateral_currency_blockchain_key');
        assertPropString(row, 'collateral_currency_token_id');
        assertProp(check(isString, isNumber), row, 'collateral_decimals');
        assertPropString(row, 'collateral_symbol');
        assertPropString(row, 'collateral_name');
        return row;
      },
    )[0];

    if (!loan) {
      throw new Error('Loan not found or access denied');
    }

    if (!['Active', 'Originated'].includes(loan.status)) {
      throw new Error(`Cannot estimate liquidation for loan with status: ${loan.status}`);
    }

    const exchangeRate = assertArrayMapOf(
      await this.sql`
      SELECT
        id,
        bid_price,
        ask_price,
        source_date
      FROM exchange_rates
      WHERE collateral_token_id = ${loan.collateral_currency_token_id}
        AND source_date <= ${params.estimateDate.toISOString()}
      ORDER BY source_date DESC
      LIMIT 1
    `,
      function (row) {
        assertDefined(row, 'Exchange rate validation failed');
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'bid_price');
        assertProp(check(isString, isNumber), row, 'ask_price');
        assertProp(isInstanceOf(Date), row, 'source_date');
        return row;
      },
    )[0];

    if (!exchangeRate) {
      throw new Error('Exchange rate not found for collateral currency');
    }

    // Calculate current collateral valuation (using bid price for liquidation estimate)
    const collateralAmountBigNum = BigInt(String(loan.collateral_amount));
    const bidPriceBigNum = BigInt(String(exchangeRate.bid_price));
    const currentValuationAmount =
      (collateralAmountBigNum * bidPriceBigNum) / BigInt('1000000000000000000'); // Assuming 18 decimals

    // Calculate current LTV ratio
    const totalOutstandingAmount = BigInt(String(loan.repayment_amount));
    const currentLtvRatio =
      Number(totalOutstandingAmount * BigInt(100)) / Number(currentValuationAmount);

    // Estimate liquidation amounts (basic calculation, detailed logic should be in service layer)
    const estimatedLiquidationAmount = currentValuationAmount; // Simplified estimation
    const estimatedSurplusDeficit = estimatedLiquidationAmount - totalOutstandingAmount;

    return {
      success: true,
      data: {
        loanId: String(params.loanId),
        liquidationBreakdown: {
          outstandingLoan: {
            principalAmount: String(loan.principal_amount),
            interestAmount: String(loan.interest_amount),
            premiAmount: String(loan.premi_amount),
            liquidationFeeAmount: String(loan.liquidation_fee_amount),
            totalOutstandingAmount: String(totalOutstandingAmount),
          },
          collateralValuation: {
            collateralCurrency: {
              blockchainKey: String(loan.collateral_currency_blockchain_key),
              tokenId: String(loan.collateral_currency_token_id),
              decimals: Number(loan.collateral_decimals),
              symbol: String(loan.collateral_symbol),
              name: String(loan.collateral_name),
            },
            currentCollateralAmount: String(loan.collateral_amount),
            currentValuationAmount: String(currentValuationAmount),
            currentLtvRatio: currentLtvRatio,
            estimatedLiquidationAmount: String(estimatedLiquidationAmount),
            estimatedSurplusDeficit: String(estimatedSurplusDeficit),
          },
          calculationDetails: {
            exchangeRateId: String(exchangeRate.id),
            valuationDate: params.estimateDate,
            liquidationMode: loan.liquidation_mode as 'Partial' | 'Full',
            marketProvider: 'DefaultProvider',
            estimatedSlippage: 0.02, // 2% estimated slippage
          },
        },
      },
    };
  }

  async borrowerRequestsEarlyLiquidation(
    params: BorrowerRequestsEarlyLiquidationParams,
  ): Promise<BorrowerRequestsEarlyLiquidationResult> {
    const tx = await this.beginTransaction();
    try {
      const loan = assertArrayMapOf(
        await tx.sql`
        SELECT
          l.id,
          l.status
        FROM loans l
        JOIN loan_applications la ON l.loan_application_id = la.id
        WHERE l.id = ${params.loanId} AND la.borrower_user_id = ${params.borrowerUserId}
      `,
        function (row) {
          assertDefined(row, 'Loan validation failed');
          assertProp(check(isString, isNumber), row, 'id');
          assertPropString(row, 'status');
          return row;
        },
      )[0];

      if (!loan) {
        throw new Error('Loan not found or access denied');
      }

      if (!['Active', 'Originated'].includes(loan.status)) {
        throw new Error(`Cannot request liquidation for loan with status: ${loan.status}`);
      }

      // Check if liquidation already exists
      const existingLiquidationRows = await tx.sql`
        SELECT loan_id FROM loan_liquidations WHERE loan_id = ${params.loanId}
      `;

      if (existingLiquidationRows.length > 0) {
        throw new Error('Liquidation request already exists for this loan');
      }

      await tx.sql`
        INSERT INTO loan_liquidations (
          loan_id,
          liquidation_initiator,
          liquidation_target_amount,
          market_provider,
          market_symbol,
          order_ref,
          status,
          order_date,
          acknowledgment
        )
        VALUES (
          ${params.loanId},
          'Borrower',
          '0',
          'DefaultProvider',
          'DEFAULT',
          ${`borrower_liquidation_${params.loanId}_${Date.now()}`},
          'Pending',
          ${params.requestDate.toISOString()},
          ${params.acknowledgment ? 'true' : 'false'}
        )
      `;

      await tx.commitTransaction();

      return {
        success: true,
        message: 'Early liquidation request submitted successfully',
        data: {
          loanId: String(params.loanId),
          liquidationRequestDate: params.requestDate,
          liquidationStatus: 'Pending',
        },
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Data-only method: Get loan amounts for calculations (no business logic)
   */
  async borrowerGetsLoanAmounts(
    params: BorrowerGetsLoanAmountsParams,
  ): Promise<BorrowerGetsLoanAmountsResult> {
    const result = assertArrayMapOf(
      await this.sql`
      SELECT
        l.id::text as "loanId",
        l.repayment_amount::text as "repaymentAmount",
        l.premi_amount::text as "premiAmount",
        l.liquidation_fee_amount::text as "liquidationFeeAmount",
        l.principal_amount::text as "principalAmount",
        l.interest_amount::text as "interestAmount",
        l.status
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      WHERE l.id = ${params.loanId} AND la.borrower_user_id = ${params.borrowerUserId}
    `,
      function (row) {
        assertDefined(row, 'Loan validation failed');
        assertPropString(row, 'loanId');
        assertPropString(row, 'repaymentAmount');
        assertPropString(row, 'premiAmount');
        assertPropString(row, 'liquidationFeeAmount');
        assertPropString(row, 'principalAmount');
        assertPropString(row, 'interestAmount');
        assertPropString(row, 'status');
        return row;
      },
    )[0];

    if (!result) {
      throw new Error('Loan not found or access denied');
    }

    return result;
  }

  /**
   * Data-only method: Update liquidation target amount with pre-calculated value
   */
  async platformUpdatesLiquidationTargetAmount(
    params: PlatformUpdatesLiquidationTargetAmountParams,
  ): Promise<PlatformUpdatesLiquidationTargetAmountResult> {
    const tx = await this.beginTransaction();
    try {
      const result = assertArrayMapOf(
        await tx.sql`
        UPDATE loan_liquidations
        SET liquidation_target_amount = ${params.liquidationTargetAmount}
        WHERE loan_id = ${params.loanId}
        RETURNING loan_id::text as "loanId", liquidation_target_amount::text as "liquidationTargetAmount"
      `,
        function (row) {
          assertDefined(row, 'Liquidation update failed');
          assertPropString(row, 'loanId');
          assertPropString(row, 'liquidationTargetAmount');
          return row;
        },
      )[0];

      if (!result) {
        throw new Error(`Liquidation record not found for loan ${params.loanId}`);
      }

      await tx.commitTransaction();

      return result;
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerRequestsEarlyRepayment(
    params: BorrowerRequestsEarlyRepaymentParams,
  ): Promise<BorrowerRequestsEarlyRepaymentResult> {
    const tx = await this.beginTransaction();
    try {
      const loan = assertArrayMapOf(
        await tx.sql`
        SELECT
          l.id,
          l.principal_amount,
          l.interest_amount,
          l.premi_amount,
          l.repayment_amount,
          l.principal_currency_blockchain_key,
          l.principal_currency_token_id,
          l.status,
          l.origination_date,
          l.maturity_date,
          la.borrower_user_id,
          la.term_in_months,
          c.decimals,
          c.symbol,
          c.name
        FROM loans l
        JOIN loan_applications la ON l.loan_application_id = la.id
        JOIN currencies c ON l.principal_currency_blockchain_key = c.blockchain_key
          AND l.principal_currency_token_id = c.token_id
        WHERE l.id = ${params.loanId} AND la.borrower_user_id = ${params.borrowerUserId}
      `,
        function (row) {
          assertDefined(row, 'Loan validation failed');
          assertProp(check(isString, isNumber), row, 'id');
          assertProp(check(isString, isNumber), row, 'principal_amount');
          assertProp(check(isString, isNumber), row, 'interest_amount');
          assertProp(check(isString, isNumber), row, 'premi_amount');
          assertProp(check(isString, isNumber), row, 'repayment_amount');
          assertPropString(row, 'principal_currency_blockchain_key');
          assertPropString(row, 'principal_currency_token_id');
          assertPropString(row, 'status');
          assertProp(isInstanceOf(Date), row, 'origination_date');
          assertProp(isInstanceOf(Date), row, 'maturity_date');
          assertProp(check(isString, isNumber), row, 'term_in_months');
          assertProp(check(isString, isNumber), row, 'decimals');
          assertPropString(row, 'symbol');
          assertPropString(row, 'name');
          return row;
        },
      )[0];

      if (!loan) {
        throw new Error('Loan not found or access denied');
      }

      if (loan.status !== 'Active') {
        throw new Error(`Cannot request early repayment for loan with status: ${loan.status}`);
      }

      // NOTE: Early repayment calculations should be done in service layer using LoanCalculationService
      // Repository should only handle data storage and retrieval
      const totalRepaymentAmount = loan.repayment_amount; // Use raw amount, calculations in service layer

      // Use provided wallet information for early repayment invoice

      const invoice = assertArrayMapOf(
        await tx.sql`
        INSERT INTO invoices (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          invoiced_amount,
          wallet_derivation_path,
          wallet_address,
          invoice_type,
          status,
          draft_date,
          invoice_date,
          due_date,
          loan_id
        )
        VALUES (
          ${params.borrowerUserId},
          ${loan.principal_currency_blockchain_key},
          ${loan.principal_currency_token_id},
          ${totalRepaymentAmount},
          ${params.repaymentWalletDerivationPath},
          ${params.repaymentWalletAddress},
          'LoanEarlyRepayment',
          'Pending',
          ${params.requestDate.toISOString()},
          ${params.requestDate.toISOString()},
          ${new Date(params.requestDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()}, -- 3 days to pay for early repayment
          ${params.loanId}
        )
        RETURNING
          id,
          invoiced_amount,
          status,
          invoice_date,
          due_date,
          expired_date,
          paid_date
      `,
        function (row) {
          assertDefined(row, 'Early repayment invoice creation failed');
          assertProp(check(isString, isNumber), row, 'id');
          assertProp(check(isString, isNumber), row, 'invoiced_amount');
          assertPropString(row, 'status');
          assertProp(isInstanceOf(Date), row, 'invoice_date');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'due_date');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'expired_date');
          assertProp(check(isNullable, isInstanceOf(Date)), row, 'paid_date');
          return row;
        },
      )[0];

      await tx.sql`
        INSERT INTO loan_repayments (
          loan_id,
          repayment_initiator,
          repayment_invoice_id,
          repayment_invoice_date,
          acknowledgment
        )
        VALUES (
          ${params.loanId},
          'Borrower',
          ${invoice.id},
          ${params.requestDate.toISOString()},
          ${params.acknowledgment ? 'true' : 'false'}
        )
        ON CONFLICT (loan_id) DO UPDATE SET
          repayment_initiator = 'Borrower',
          repayment_invoice_id = ${invoice.id},
          repayment_invoice_date = ${params.requestDate.toISOString()},
          acknowledgment = ${params.acknowledgment ? 'true' : 'false'}
      `;

      await tx.commitTransaction();

      return {
        success: true,
        message: 'Early repayment request processed successfully',
        data: {
          loanId: String(params.loanId),
          repaymentBreakdown: {
            loanDetails: {
              principalAmount: String(loan.principal_amount),
              interestAmount: String(loan.interest_amount),
              premiAmount: String(loan.premi_amount),
              totalRepaymentAmount: String(totalRepaymentAmount),
            },
            calculationDetails: {
              fullInterestCharged: true, // Static value, detailed calculations should be in service
              remainingTermDays: 0, // Placeholder, calculations should be in service
              earlyRepaymentDate: params.requestDate,
            },
          },
          repaymentInvoice: {
            id: String(invoice.id),
            amount: String(invoice.invoiced_amount),
            currency: {
              blockchainKey: loan.principal_currency_blockchain_key,
              tokenId: loan.principal_currency_token_id,
              decimals: Number(loan.decimals),
              symbol: loan.symbol,
              name: loan.name,
            },
            status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
            createdDate: invoice.invoice_date,
            expiryDate:
              invoice.due_date ||
              invoice.expired_date ||
              new Date(params.requestDate.getTime() + 3 * 24 * 60 * 60 * 1000),
            paidDate: invoice.paid_date || undefined,
          },
        },
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw new Error(`Early repayment request failed: ${error}`);
    }
  }

  /**
   * Data-only method: Get a single loan application by id for borrower/platform views
   */
  async borrowerGetsLoanApplicationById(params: { loanApplicationId: string }) {
    const row = assertArrayMapOf(
      await this.sql`
      SELECT
        la.id,
        la.borrower_user_id,
        u.user_type as borrower_user_type,
        u.name as borrower_name,
        la.loan_offer_id,
        la.principal_amount,
        la.max_interest_rate,
        la.min_ltv_ratio,
        la.term_in_months,
        la.liquidation_mode,
        la.status,
        la.applied_date,
        la.published_date,
        la.expired_date,
        c1.blockchain_key as principal_blockchain_key,
        c1.token_id as principal_token_id,
        c1.decimals as principal_decimals,
        c1.symbol as principal_symbol,
        c1.name as principal_name,
        c2.blockchain_key as collateral_blockchain_key,
        c2.token_id as collateral_token_id,
        c2.decimals as collateral_decimals,
        c2.symbol as collateral_symbol,
        c2.name as collateral_name,
        i.id as invoice_id,
        i.invoiced_amount as invoice_amount,
        i.wallet_address as invoice_wallet_address,
        i.due_date as invoice_due_date,
        i.paid_date as invoice_paid_date,
        i.expired_date as invoice_expired_date
      FROM loan_applications la
      JOIN users u ON la.borrower_user_id = u.id
      JOIN currencies c1 ON la.principal_currency_blockchain_key = c1.blockchain_key
        AND la.principal_currency_token_id = c1.token_id
      JOIN currencies c2 ON la.collateral_currency_blockchain_key = c2.blockchain_key
        AND la.collateral_currency_token_id = c2.token_id
      LEFT JOIN invoices i ON i.loan_application_id = la.id AND i.invoice_type = 'LoanCollateral'
      WHERE la.id = ${params.loanApplicationId}
    `,
      function (r) {
        assertDefined(r);
        return r;
      },
    )[0];

    if (!row) {
      throw new Error('Loan application not found');
    }
    // Narrow the row to a well-known shape so we can safely access its properties
    const r = row as {
      id: string | number;
      borrower_user_id: string | number;
      borrower_user_type: string;
      borrower_name: string;
      loan_offer_id?: string | number | null;
      principal_blockchain_key: string;
      principal_token_id: string;
      principal_decimals: string | number;
      principal_symbol: string;
      principal_name: string;
      collateral_blockchain_key: string;
      collateral_token_id: string;
      collateral_decimals: string | number;
      collateral_symbol: string;
      collateral_name: string;
      principal_amount: string | number;
      min_ltv_ratio?: string | number;
      max_interest_rate: string | number;
      term_in_months: string | number;
      liquidation_mode: string;
      status: string;
      applied_date: Date;
      published_date?: Date | null;
      expired_date: Date;
      invoice_id?: string | number | null;
      invoice_amount?: string | number;
      invoice_wallet_address?: string | null;
      invoice_due_date?: Date | null;
      invoice_paid_date?: Date | null;
      invoice_expired_date?: Date | null;
    };

    return {
      id: String(r.id),
      borrowerUserId: String(r.borrower_user_id),
      borrower: {
        id: String(r.borrower_user_id),
        type: r.borrower_user_type,
        name: r.borrower_name,
      },
      loanOfferId: r.loan_offer_id ? String(r.loan_offer_id) : undefined,
      principalCurrency: {
        blockchainKey: r.principal_blockchain_key,
        tokenId: r.principal_token_id,
        decimals: Number(r.principal_decimals),
        symbol: r.principal_symbol,
        name: r.principal_name,
      },
      collateralCurrency: {
        blockchainKey: r.collateral_blockchain_key,
        tokenId: r.collateral_token_id,
        decimals: Number(r.collateral_decimals),
        symbol: r.collateral_symbol,
        name: r.collateral_name,
      },
      principalAmount: String(r.principal_amount),
      minLtvRatio: r.min_ltv_ratio !== undefined ? Number(r.min_ltv_ratio) : undefined,
      maxInterestRate: Number(r.max_interest_rate),
      termInMonths: Number(r.term_in_months),
      liquidationMode: r.liquidation_mode,
      status: r.status,
      appliedDate: r.applied_date,
      publishedDate: r.published_date || undefined,
      expirationDate: r.expired_date,
      collateralInvoice: r.invoice_id
        ? {
            id: String(r.invoice_id),
            amount: String(r.invoice_amount),
            currency: {
              blockchainKey: r.collateral_blockchain_key,
              tokenId: r.collateral_token_id,
              name: r.collateral_name,
              symbol: r.collateral_symbol,
              decimals: Number(r.collateral_decimals),
            },
            walletAddress: r.invoice_wallet_address || undefined,
            expiryDate: r.invoice_due_date || undefined,
            paidDate: r.invoice_paid_date || undefined,
            expiredDate: r.invoice_expired_date || undefined,
          }
        : undefined,
    };
  }
}
