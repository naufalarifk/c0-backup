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
  SystemUpdatesLiquidationTargetAmountParams,
  SystemUpdatesLiquidationTargetAmountResult,
} from './loan.types';
import { LoanLenderRepository } from './loan-lender.repository';

function assertPlatformConfig(config: unknown): asserts config is {
  loan_provision_rate: string | number;
  loan_min_ltv_ratio: string | number;
  loan_max_ltv_ratio: string | number;
} {
  assertDefined(config, 'Platform config is undefined');
  assertProp(check(isString, isNumber), config, 'loan_provision_rate');
  assertProp(check(isString, isNumber), config, 'loan_min_ltv_ratio');
  assertProp(check(isString, isNumber), config, 'loan_max_ltv_ratio');
}

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
    const { collateralBlockchainKey, collateralTokenId, principalBlockchainKey, principalTokenId } =
      params;

    const currencyRows = await this.sql`
      SELECT
        c1.blockchain_key as principal_blockchain_key,
        c1.token_id as principal_token_id,
        c1.decimals as principal_decimals,
        c1.symbol as principal_symbol,
        c1.name as principal_name,
        c2.blockchain_key as collateral_blockchain_key,
        c2.token_id as collateral_token_id,
        c2.decimals as collateral_decimals,
        c2.symbol as collateral_symbol,
        c2.name as collateral_name
      FROM currencies c1
      CROSS JOIN currencies c2
      WHERE c1.blockchain_key = ${principalBlockchainKey}
        AND c1.token_id = ${principalTokenId}
        AND c2.blockchain_key = ${collateralBlockchainKey}
        AND c2.token_id = ${collateralTokenId}
    `;

    if (currencyRows.length === 0) {
      throw new Error(
        `Currency pair ${principalBlockchainKey}:${principalTokenId} or ${collateralBlockchainKey}:${collateralTokenId} does not exist`,
      );
    }

    const currencies = currencyRows[0];
    assertDefined(currencies, 'Currency validation failed');
    assertPropString(currencies, 'principal_blockchain_key');
    assertPropString(currencies, 'principal_token_id');
    assertProp(check(isString, isNumber), currencies, 'principal_decimals');
    assertPropString(currencies, 'principal_symbol');
    assertPropString(currencies, 'principal_name');
    assertPropString(currencies, 'collateral_blockchain_key');
    assertPropString(currencies, 'collateral_token_id');
    assertProp(check(isString, isNumber), currencies, 'collateral_decimals');
    assertPropString(currencies, 'collateral_symbol');
    assertPropString(currencies, 'collateral_name');

    return {
      principalCurrency: {
        blockchainKey: currencies.principal_blockchain_key,
        tokenId: currencies.principal_token_id,
        decimals: Number(currencies.principal_decimals),
        symbol: currencies.principal_symbol,
        name: currencies.principal_name,
      },
      collateralCurrency: {
        blockchainKey: currencies.collateral_blockchain_key,
        tokenId: currencies.collateral_token_id,
        decimals: Number(currencies.collateral_decimals),
        symbol: currencies.collateral_symbol,
        name: currencies.collateral_name,
      },
    };
  }

  /**
   * Data-only method: Get platform configuration without calculations
   */
  async borrowerGetsPlatformConfig(
    params: BorrowerGetsPlatformConfigParams,
  ): Promise<BorrowerGetsPlatformConfigResult> {
    const { effectiveDate } = params;

    const platformConfigRows = await this.sql`
      SELECT
        loan_provision_rate,
        loan_min_ltv_ratio,
        loan_max_ltv_ratio
      FROM platform_configs
      WHERE effective_date <= ${effectiveDate.toISOString()}
      ORDER BY effective_date DESC
      LIMIT 1
    `;

    if (platformConfigRows.length === 0) {
      throw new Error('Platform configuration not found');
    }

    const platformConfig = platformConfigRows[0];
    assertPlatformConfig(platformConfig);

    return {
      loanProvisionRate: platformConfig.loan_provision_rate,
      loanMinLtvRatio: platformConfig.loan_min_ltv_ratio,
      loanMaxLtvRatio: platformConfig.loan_max_ltv_ratio,
    };
  }

  /**
   * Data-only method: Get exchange rate without calculations
   */
  async borrowerGetsExchangeRate(
    params: BorrowerGetsExchangeRateParams,
  ): Promise<BorrowerGetsExchangeRateResult> {
    const { collateralTokenId, asOfDate } = params;

    let exchangeRateRows;
    if (asOfDate) {
      exchangeRateRows = await this.sql`
        SELECT
          er.id,
          er.bid_price,
          er.ask_price,
          er.source_date
        FROM exchange_rates er
        JOIN price_feeds pf ON er.price_feed_id = pf.id
        WHERE pf.blockchain_key = 'crosschain'
          AND ((pf.base_currency_token_id = ${collateralTokenId} AND pf.quote_currency_token_id = 'iso4217:usd')
               OR (pf.base_currency_token_id = 'iso4217:usd' AND pf.quote_currency_token_id = ${collateralTokenId}))
          AND er.source_date <= ${asOfDate.toISOString()}
        ORDER BY er.source_date DESC
        LIMIT 1
      `;
    } else {
      exchangeRateRows = await this.sql`
        SELECT
          er.id,
          er.bid_price,
          er.ask_price,
          er.source_date
        FROM exchange_rates er
        JOIN price_feeds pf ON er.price_feed_id = pf.id
        WHERE pf.blockchain_key = 'crosschain'
          AND ((pf.base_currency_token_id = ${collateralTokenId} AND pf.quote_currency_token_id = 'iso4217:usd')
               OR (pf.base_currency_token_id = 'iso4217:usd' AND pf.quote_currency_token_id = ${collateralTokenId}))
        ORDER BY er.source_date DESC
        LIMIT 1
      `;
    }

    assertArrayMapOf(exchangeRateRows, function (rate) {
      assertDefined(rate);
      assertProp(check(isString, isNumber), rate, 'id');
      assertPropString(rate, 'bid_price');
      assertPropString(rate, 'ask_price');
      assertProp(isInstanceOf(Date), rate, 'source_date');
      return rate;
    });

    if (exchangeRateRows.length === 0) {
      throw new Error(`Exchange rate not found for token ${collateralTokenId}`);
    }

    const exchangeRate = exchangeRateRows[0];
    return {
      id: exchangeRate.id,
      bidPrice: exchangeRate.bid_price,
      askPrice: exchangeRate.ask_price,
      sourceDate: exchangeRate.source_date,
    };
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
        RETURNING id, bid_price, ask_price, source_date
      `;

      if (exchangeRateInsertRows.length === 0) {
        throw new Error('Failed to create exchange rate record');
      }

      const insertedRate = exchangeRateInsertRows[0];
      assertDefined(insertedRate, 'Exchange rate insert failed');
      assertProp(check(isString, isNumber), insertedRate, 'id');
      assertProp(check(isString, isNumber), insertedRate, 'bid_price');
      assertProp(check(isString, isNumber), insertedRate, 'ask_price');
      assertProp(isInstanceOf(Date), insertedRate, 'source_date');

      await tx.commitTransaction();

      return {
        id: insertedRate.id,
        bidPrice: String(insertedRate.bid_price),
        askPrice: String(insertedRate.ask_price),
        sourceDate: insertedRate.source_date,
      };
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
    const {
      borrowerUserId,
      loanOfferId,
      collateralBlockchainKey,
      collateralTokenId,
      principalBlockchainKey,
      principalTokenId,
      principalAmount,
      provisionAmount,
      maxInterestRate,
      minLtvRatio,
      maxLtvRatio,
      termInMonths,
      liquidationMode,
      collateralDepositAmount,
      collateralDepositExchangeRateId,
      appliedDate,
      expirationDate,
      collateralInvoiceId,
      collateralInvoicePrepaidAmount,
      collateralAccountBlockchainKey,
      collateralAccountTokenId,
      collateralInvoiceDate,
      collateralInvoiceDueDate,
      collateralInvoiceExpiredDate,
      collateralWalletDerivationPath,
      collateralWalletAddress,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Get currency details (data-only)
      const currencies = await this.borrowerGetsCurrencyPair({
        collateralBlockchainKey,
        collateralTokenId,
        principalBlockchainKey,
        principalTokenId,
      });

      // Create loan application with pre-calculated values
      const loanApplicationRows = await tx.sql`
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
          ${borrowerUserId},
          ${loanOfferId || null},
          ${principalBlockchainKey},
          ${principalTokenId},
          ${principalAmount},
          ${provisionAmount},
          ${maxInterestRate},
          ${minLtvRatio},
          ${maxLtvRatio},
          ${termInMonths},
          ${liquidationMode},
          ${collateralBlockchainKey},
          ${collateralTokenId},
          ${collateralDepositAmount},
          ${collateralDepositExchangeRateId},
          'PendingCollateral',
          ${appliedDate.toISOString()},
          ${expirationDate.toISOString()}
        )
        RETURNING
          id,
          borrower_user_id,
          loan_offer_id,
          principal_amount,
          provision_amount,
          max_interest_rate,
          min_ltv_ratio,
          max_ltv_ratio,
          term_in_months,
          liquidation_mode,
          collateral_deposit_amount,
          status,
          applied_date,
          expired_date
      `;

      const loanApplication = loanApplicationRows[0];
      assertDefined(loanApplication, 'Loan application creation failed');
      assertProp(check(isString, isNumber), loanApplication, 'id');
      assertProp(check(isString, isNumber), loanApplication, 'borrower_user_id');
      assertProp(check(isNullable, isString, isNumber), loanApplication, 'loan_offer_id');
      assertProp(check(isString, isNumber), loanApplication, 'principal_amount');
      assertProp(check(isString, isNumber), loanApplication, 'provision_amount');
      assertProp(check(isString, isNumber), loanApplication, 'max_interest_rate');
      assertProp(check(isString, isNumber), loanApplication, 'min_ltv_ratio');
      assertProp(check(isString, isNumber), loanApplication, 'max_ltv_ratio');
      assertProp(check(isString, isNumber), loanApplication, 'term_in_months');
      assertPropString(loanApplication, 'liquidation_mode');
      assertProp(check(isString, isNumber), loanApplication, 'collateral_deposit_amount');
      assertPropString(loanApplication, 'status');
      assertProp(isInstanceOf(Date), loanApplication, 'applied_date');
      assertProp(isInstanceOf(Date), loanApplication, 'expired_date');

      // Create collateral deposit invoice
      const invoiceRows = await tx.sql`
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
          ${collateralInvoiceId},
          ${borrowerUserId},
          ${collateralBlockchainKey},
          ${collateralTokenId},
          ${collateralAccountBlockchainKey ?? null},
          ${collateralAccountTokenId ?? null},
          ${collateralDepositAmount},
          ${collateralInvoicePrepaidAmount},
          ${collateralWalletDerivationPath},
          ${collateralWalletAddress},
          'LoanCollateral',
          'Pending',
          ${collateralInvoiceDate.toISOString()},
          ${collateralInvoiceDate.toISOString()},
          ${collateralInvoiceDueDate.toISOString()},
          ${collateralInvoiceExpiredDate.toISOString()},
          ${loanApplication.id}
        )
        RETURNING
          id,
          invoiced_amount,
          prepaid_amount,
          status,
          invoice_date,
          due_date,
          expired_date,
          paid_date
      `;

      assertArrayMapOf(invoiceRows, function (invoice) {
        assertDefined(invoice, 'Invoice row is undefined');
        assertProp(check(isString, isNumber), invoice, 'id');
        assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
        assertProp(check(isString, isNumber), invoice, 'prepaid_amount');
        assertPropString(invoice, 'status');
        assertProp(isInstanceOf(Date), invoice, 'invoice_date');
        assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'due_date');
        assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'expired_date');
        assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'paid_date');
        return invoice;
      });
      const invoice = invoiceRows[0];

      await tx.commitTransaction();

      return {
        id: String(loanApplication.id),
        borrowerUserId: String(loanApplication.borrower_user_id),
        loanOfferId: loanApplication.loan_offer_id
          ? String(loanApplication.loan_offer_id)
          : undefined,
        principalCurrency: currencies.principalCurrency,
        principalAmount: String(loanApplication.principal_amount),
        provisionAmount: String(loanApplication.provision_amount),
        maxInterestRate: Number(loanApplication.max_interest_rate),
        minLtvRatio: Number(loanApplication.min_ltv_ratio),
        maxLtvRatio: Number(loanApplication.max_ltv_ratio),
        termInMonths: Number(loanApplication.term_in_months),
        liquidationMode: loanApplication.liquidation_mode as 'Partial' | 'Full',
        collateralCurrency: currencies.collateralCurrency,
        collateralDepositAmount: String(loanApplication.collateral_deposit_amount),
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
        appliedDate: loanApplication.applied_date,
        expirationDate: loanApplication.expired_date,
        collateralDepositInvoice: {
          id: String(invoice.id),
          amount: String(invoice.invoiced_amount),
          currency: currencies.collateralCurrency,
          status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
          createdDate: invoice.invoice_date,
          expiryDate: invoice.due_date || invoice.expired_date || expirationDate,
          paidDate: invoice.paid_date || undefined,
        },
        collateralInvoice: {
          id: String(invoice.id),
          amount: String(invoice.invoiced_amount),
          currency: currencies.collateralCurrency,
          status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
          createdDate: invoice.invoice_date,
          expiryDate: invoice.due_date || invoice.expired_date || expirationDate,
          paidDate: invoice.paid_date || undefined,
        },
        collateralDepositExchangeRateId: String(collateralDepositExchangeRateId),
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerUpdatesLoanApplication(
    params: BorrowerUpdatesLoanApplicationParams,
  ): Promise<BorrowerUpdatesLoanApplicationResult> {
    const { loanApplicationId, borrowerUserId, action, updateDate, expirationDate, closureReason } =
      params;

    const tx = await this.beginTransaction();
    try {
      // Get current loan application status to validate transition
      const currentApplicationRows = await tx.sql`
        SELECT status, expired_date
        FROM loan_applications
        WHERE id = ${loanApplicationId} AND borrower_user_id = ${borrowerUserId}
      `;

      if (currentApplicationRows.length === 0) {
        throw new Error('Loan application not found or access denied');
      }

      const currentApplication = currentApplicationRows[0];
      assertDefined(currentApplication, 'Current application validation failed');
      assertPropString(currentApplication, 'status');
      assertProp(check(isNullable, isInstanceOf(Date)), currentApplication, 'expired_date');

      let newStatus: string;
      let closedDate: Date | null = null;
      let newExpirationDate: Date | null = null;

      switch (action) {
        case 'cancel':
          if (!['PendingCollateral', 'Published'].includes(currentApplication.status)) {
            throw new Error(`Cannot cancel application from status: ${currentApplication.status}`);
          }
          newStatus = 'Cancelled';
          closedDate = updateDate;
          break;

        case 'modify':
          if (currentApplication.status !== 'PendingCollateral') {
            throw new Error(`Cannot modify application from status: ${currentApplication.status}`);
          }
          newStatus = currentApplication.status;
          if (expirationDate) {
            newExpirationDate = expirationDate;
          }
          break;

        default:
          throw new Error(`Invalid action: ${action}`);
      }

      // Update loan application
      const updateRows = await tx.sql`
        UPDATE loan_applications
        SET 
          status = ${newStatus},
          closed_date = ${closedDate?.toISOString() || null},
          closure_reason = ${closureReason || null},
          expired_date = ${newExpirationDate?.toISOString() || currentApplication.expired_date}
        WHERE id = ${loanApplicationId} AND borrower_user_id = ${borrowerUserId}
        RETURNING 
          id,
          status,
          closed_date,
          closure_reason,
          expired_date
      `;

      if (updateRows.length === 0) {
        throw new Error('Loan application update failed');
      }

      const updatedApplication = updateRows[0];
      assertDefined(updatedApplication, 'Updated application validation failed');
      assertProp(check(isString, isNumber), updatedApplication, 'id');
      assertPropString(updatedApplication, 'status');
      assertProp(check(isNullable, isInstanceOf(Date)), updatedApplication, 'closed_date');
      assertPropNullableString(updatedApplication, 'closure_reason');
      assertProp(isInstanceOf(Date), updatedApplication, 'expired_date');

      await tx.commitTransaction();

      return {
        id: String(updatedApplication.id),
        status: updatedApplication.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Cancelled'
          | 'Closed'
          | 'Expired',
        updatedDate: updateDate,
        expirationDate: updatedApplication.expired_date,
        closureReason: updatedApplication.closure_reason || undefined,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerViewsMyLoanApplications(
    params: BorrowerViewsMyLoanApplicationsParams,
  ): Promise<BorrowerViewsMyLoanApplicationsResult> {
    const { borrowerUserId, page = 1, limit = 20, status } = params;

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM loan_applications
      WHERE borrower_user_id = ${borrowerUserId}
        AND (${status}::text IS NULL OR status = ${status})
    `;

    const countRow = countRows[0];
    assertDefined(countRow, 'Count query failed');
    assertProp(check(isString, isNumber), countRow, 'total');
    const totalCount = Number(countRow.total);

    // Get loan applications with currency details
    const applicationRows = await this.sql`
      SELECT 
        la.id,
        la.loan_offer_id,
        la.principal_amount,
        la.provision_amount,
        la.max_interest_rate,
        la.min_ltv_ratio,
        la.max_ltv_ratio,
        la.term_in_months,
        la.liquidation_mode,
        la.collateral_deposit_amount,
        la.status,
        la.applied_date,
        la.expired_date,
        la.published_date,
        la.matched_date,
        la.matched_loan_offer_id,
        la.closed_date,
        la.closure_reason,
        c1.blockchain_key as principal_blockchain_key,
        c1.token_id as principal_token_id,
        c1.decimals as principal_decimals,
        c1.symbol as principal_symbol,
        c1.name as principal_name,
        c2.blockchain_key as collateral_blockchain_key,
        c2.token_id as collateral_token_id,
        c2.decimals as collateral_decimals,
        c2.symbol as collateral_symbol,
        c2.name as collateral_name
      FROM loan_applications la
      JOIN currencies c1 ON la.principal_currency_blockchain_key = c1.blockchain_key 
        AND la.principal_currency_token_id = c1.token_id
      JOIN currencies c2 ON la.collateral_currency_blockchain_key = c2.blockchain_key
        AND la.collateral_currency_token_id = c2.token_id
      WHERE la.borrower_user_id = ${borrowerUserId}
        AND (${status}::text IS NULL OR la.status = ${status})
      ORDER BY la.applied_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const loanApplications = applicationRows.map(function (row: unknown) {
      assertDefined(row, 'Loan application row is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertPropNullableString(row, 'loan_offer_id');
      assertPropString(row, 'principal_blockchain_key');
      assertPropString(row, 'principal_token_id');
      assertProp(check(isString, isNumber), row, 'principal_decimals');
      assertPropString(row, 'principal_symbol');
      assertPropString(row, 'principal_name');
      assertProp(check(isString, isNumber), row, 'principal_amount');
      assertProp(check(isString, isNumber), row, 'provision_amount');
      assertProp(check(isString, isNumber), row, 'max_interest_rate');
      assertProp(check(isString, isNumber), row, 'min_ltv_ratio');
      assertProp(check(isString, isNumber), row, 'max_ltv_ratio');
      assertProp(check(isString, isNumber), row, 'term_in_months');
      assertPropString(row, 'liquidation_mode');
      assertPropString(row, 'collateral_blockchain_key');
      assertPropString(row, 'collateral_token_id');
      assertProp(check(isString, isNumber), row, 'collateral_decimals');
      assertPropString(row, 'collateral_symbol');
      assertPropString(row, 'collateral_name');
      assertProp(check(isString, isNumber), row, 'collateral_deposit_amount');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'applied_date');
      assertProp(isInstanceOf(Date), row, 'expired_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'published_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'matched_date');
      assertPropNullableString(row, 'matched_loan_offer_id');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'closed_date');
      assertPropNullableString(row, 'closure_reason');

      return {
        id: String(row.id),
        loanOfferId: row.loan_offer_id ? String(row.loan_offer_id) : undefined,
        principalCurrency: {
          blockchainKey: row.principal_blockchain_key as string,
          tokenId: row.principal_token_id as string,
          decimals: Number(row.principal_decimals),
          symbol: row.principal_symbol as string,
          name: row.principal_name as string,
        },
        principalAmount: String(row.principal_amount),
        provisionAmount: String(row.provision_amount),
        maxInterestRate: Number(row.max_interest_rate),
        minLtvRatio: Number(row.min_ltv_ratio),
        maxLtvRatio: Number(row.max_ltv_ratio),
        termInMonths: Number(row.term_in_months),
        liquidationMode: row.liquidation_mode as 'Partial' | 'Full',
        collateralCurrency: {
          blockchainKey: row.collateral_blockchain_key as string,
          tokenId: row.collateral_token_id as string,
          decimals: Number(row.collateral_decimals),
          symbol: row.collateral_symbol as string,
          name: row.collateral_name as string,
        },
        collateralDepositAmount: String(row.collateral_deposit_amount),
        status: row.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Cancelled'
          | 'Closed'
          | 'Expired',
        appliedDate: row.applied_date,
        expirationDate: row.expired_date,
        publishedDate: row.published_date || undefined,
        matchedDate: row.matched_date || undefined,
        matchedLoanOfferId: row.matched_loan_offer_id
          ? String(row.matched_loan_offer_id)
          : undefined,
        closedDate: row.closed_date || undefined,
        closureReason: row.closure_reason || undefined,
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
    const {
      loanId,
      borrowerUserId,
      repaymentDate,
      repaymentWalletDerivationPath,
      repaymentWalletAddress,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Get loan details and validate borrower access
      const loanRows = await tx.sql`
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
        WHERE l.id = ${loanId} AND la.borrower_user_id = ${borrowerUserId}
      `;

      if (loanRows.length === 0) {
        throw new Error('Loan not found or access denied');
      }

      const loan = loanRows[0];
      assertDefined(loan, 'Loan validation failed');
      assertProp(check(isString, isNumber), loan, 'id');
      assertPropString(loan, 'principal_currency_blockchain_key');
      assertPropString(loan, 'principal_currency_token_id');
      assertProp(check(isString, isNumber), loan, 'repayment_amount');
      assertPropString(loan, 'status');
      assertProp(check(isString, isNumber), loan, 'borrower_user_id');
      assertProp(check(isString, isNumber), loan, 'decimals');
      assertPropString(loan, 'symbol');
      assertPropString(loan, 'name');

      if (loan.status !== 'Active') {
        throw new Error(`Cannot repay loan with status: ${loan.status}`);
      }

      // Use provided wallet information for repayment invoice

      // Create repayment invoice
      const invoiceRows = await tx.sql`
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
          ${borrowerUserId},
          ${loan.principal_currency_blockchain_key},
          ${loan.principal_currency_token_id},
          ${loan.repayment_amount},
          ${repaymentWalletDerivationPath},
          ${repaymentWalletAddress},
          'LoanRepayment',
          'Pending',
          ${repaymentDate.toISOString()},
          ${repaymentDate.toISOString()},
          ${new Date(repaymentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()}, -- 7 days to pay
          ${loanId}
        )
        RETURNING 
          id,
          invoiced_amount,
          status,
          invoice_date,
          due_date,
          expired_date,
          paid_date
      `;

      const invoice = invoiceRows[0];
      assertDefined(invoice, 'Repayment invoice creation failed');
      assertProp(check(isString, isNumber), invoice, 'id');
      assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
      assertPropString(invoice, 'status');
      assertProp(isInstanceOf(Date), invoice, 'invoice_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'due_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'expired_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'paid_date');

      // Create loan repayment record
      await tx.sql`
        INSERT INTO loan_repayments (
          loan_id,
          repayment_initiator,
          repayment_invoice_id,
          repayment_invoice_date
        )
        VALUES (
          ${loanId},
          'Borrower',
          ${invoice.id},
          ${repaymentDate.toISOString()}
        )
        ON CONFLICT (loan_id) DO UPDATE SET
          repayment_initiator = 'Borrower',
          repayment_invoice_id = ${invoice.id},
          repayment_invoice_date = ${repaymentDate.toISOString()}
      `;

      await tx.commitTransaction();

      return {
        id: String(loanId),
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
            new Date(repaymentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          paidDate: invoice.paid_date || undefined,
        },
        concludedDate: repaymentDate,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerRequestsEarlyLiquidationEstimate(
    params: BorrowerRequestsEarlyLiquidationEstimateParams,
  ): Promise<BorrowerRequestsEarlyLiquidationEstimateResult> {
    const { loanId, borrowerUserId, estimateDate } = params;

    // Get loan details and current valuations for estimate calculation
    const loanRows = await this.sql`
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
      WHERE l.id = ${loanId} AND la.borrower_user_id = ${borrowerUserId}
    `;

    if (loanRows.length === 0) {
      throw new Error('Loan not found or access denied');
    }

    const loan = loanRows[0];
    assertDefined(loan, 'Loan validation failed');
    assertProp(check(isString, isNumber), loan, 'id');
    assertProp(check(isString, isNumber), loan, 'principal_amount');
    assertProp(check(isString, isNumber), loan, 'interest_amount');
    assertProp(check(isString, isNumber), loan, 'premi_amount');
    assertProp(check(isString, isNumber), loan, 'liquidation_fee_amount');
    assertProp(check(isString, isNumber), loan, 'repayment_amount');
    assertProp(check(isString, isNumber), loan, 'collateral_amount');
    assertPropString(loan, 'status');
    assertProp(check(isString, isNumber), loan, 'mc_ltv_ratio');
    assertPropString(loan, 'liquidation_mode');
    assertPropString(loan, 'collateral_currency_blockchain_key');
    assertPropString(loan, 'collateral_currency_token_id');
    assertProp(check(isString, isNumber), loan, 'collateral_decimals');
    assertPropString(loan, 'collateral_symbol');
    assertPropString(loan, 'collateral_name');

    if (!['Active', 'Originated'].includes(loan.status)) {
      throw new Error(`Cannot estimate liquidation for loan with status: ${loan.status}`);
    }

    // Get latest exchange rate for estimate
    const exchangeRateRows = await this.sql`
      SELECT
        id,
        bid_price,
        ask_price,
        source_date
      FROM exchange_rates
      WHERE collateral_token_id = ${loan.collateral_currency_token_id}
        AND source_date <= ${estimateDate.toISOString()}
      ORDER BY source_date DESC
      LIMIT 1
    `;

    if (exchangeRateRows.length === 0) {
      throw new Error('Exchange rate not found for collateral currency');
    }

    const exchangeRate = exchangeRateRows[0];
    assertDefined(exchangeRate, 'Exchange rate validation failed');
    assertProp(check(isString, isNumber), exchangeRate, 'id');
    assertProp(check(isString, isNumber), exchangeRate, 'bid_price');
    assertProp(check(isString, isNumber), exchangeRate, 'ask_price');
    assertProp(isInstanceOf(Date), exchangeRate, 'source_date');

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
        loanId: String(loanId),
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
            valuationDate: estimateDate,
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
    const { loanId, borrowerUserId, acknowledgment, requestDate } = params;
    const acknowledgmentText = acknowledgment ? 'true' : 'false';

    const tx = await this.beginTransaction();
    try {
      // Get loan details and validate borrower access
      const loanRows = await tx.sql`
        SELECT
          l.id,
          l.status
        FROM loans l
        JOIN loan_applications la ON l.loan_application_id = la.id
        WHERE l.id = ${loanId} AND la.borrower_user_id = ${borrowerUserId}
      `;

      if (loanRows.length === 0) {
        throw new Error('Loan not found or access denied');
      }

      const loan = loanRows[0];
      assertDefined(loan, 'Loan validation failed');
      assertProp(check(isString, isNumber), loan, 'id');
      assertPropString(loan, 'status');

      if (!['Active', 'Originated'].includes(loan.status)) {
        throw new Error(`Cannot request liquidation for loan with status: ${loan.status}`);
      }

      // Check if liquidation already exists
      const existingLiquidationRows = await tx.sql`
        SELECT loan_id FROM loan_liquidations WHERE loan_id = ${loanId}
      `;

      if (existingLiquidationRows.length > 0) {
        throw new Error('Liquidation request already exists for this loan');
      }

      // Create liquidation record with placeholder target amount (to be updated by service layer)
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
          ${loanId},
          'Borrower',
          '0',
          'DefaultProvider',
          'DEFAULT',
          ${`borrower_liquidation_${loanId}_${Date.now()}`},
          'Pending',
          ${requestDate.toISOString()},
          ${acknowledgmentText}
        )
      `;

      await tx.commitTransaction();

      return {
        success: true,
        message: 'Early liquidation request submitted successfully',
        data: {
          loanId: String(loanId),
          liquidationRequestDate: requestDate,
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
    const { loanId, borrowerUserId } = params;

    const loanRows = await this.sql`
      SELECT
        l.id,
        l.repayment_amount,
        l.premi_amount,
        l.liquidation_fee_amount,
        l.principal_amount,
        l.interest_amount,
        l.status
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      WHERE l.id = ${loanId} AND la.borrower_user_id = ${borrowerUserId}
    `;

    if (loanRows.length === 0) {
      throw new Error('Loan not found or access denied');
    }

    const loan = loanRows[0];
    assertDefined(loan, 'Loan validation failed');
    assertProp(check(isString, isNumber), loan, 'id');
    assertProp(check(isString, isNumber), loan, 'repayment_amount');
    assertProp(check(isString, isNumber), loan, 'premi_amount');
    assertProp(check(isString, isNumber), loan, 'liquidation_fee_amount');
    assertProp(check(isString, isNumber), loan, 'principal_amount');
    assertProp(check(isString, isNumber), loan, 'interest_amount');
    assertPropString(loan, 'status');

    return {
      loanId: String(loan.id),
      repaymentAmount: String(loan.repayment_amount),
      premiAmount: String(loan.premi_amount),
      liquidationFeeAmount: String(loan.liquidation_fee_amount),
      principalAmount: String(loan.principal_amount),
      interestAmount: String(loan.interest_amount),
      status: loan.status,
    };
  }

  /**
   * Data-only method: Update liquidation target amount with pre-calculated value
   */
  async systemUpdatesLiquidationTargetAmount(
    params: SystemUpdatesLiquidationTargetAmountParams,
  ): Promise<SystemUpdatesLiquidationTargetAmountResult> {
    const { loanId, liquidationTargetAmount } = params;

    const tx = await this.beginTransaction();
    try {
      const updateRows = await tx.sql`
        UPDATE loan_liquidations
        SET liquidation_target_amount = ${liquidationTargetAmount}
        WHERE loan_id = ${loanId}
        RETURNING loan_id, liquidation_target_amount
      `;

      if (updateRows.length === 0) {
        throw new Error(`Liquidation record not found for loan ${loanId}`);
      }

      const updatedRecord = updateRows[0];
      assertDefined(updatedRecord, 'Liquidation update failed');
      assertProp(check(isString, isNumber), updatedRecord, 'loan_id');
      assertProp(check(isString, isNumber), updatedRecord, 'liquidation_target_amount');

      await tx.commitTransaction();

      return {
        loanId: String(updatedRecord.loan_id),
        liquidationTargetAmount: String(updatedRecord.liquidation_target_amount),
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async borrowerRequestsEarlyRepayment(
    params: BorrowerRequestsEarlyRepaymentParams,
  ): Promise<BorrowerRequestsEarlyRepaymentResult> {
    const {
      loanId,
      borrowerUserId,
      acknowledgment,
      requestDate,
      repaymentWalletDerivationPath,
      repaymentWalletAddress,
    } = params;
    const acknowledgmentText = acknowledgment ? 'true' : 'false';

    const tx = await this.beginTransaction();
    try {
      // Get loan details and validate borrower access
      const loanRows = await tx.sql`
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
        WHERE l.id = ${loanId} AND la.borrower_user_id = ${borrowerUserId}
      `;

      if (loanRows.length === 0) {
        throw new Error('Loan not found or access denied');
      }

      const loan = loanRows[0];
      assertDefined(loan, 'Loan validation failed');
      assertProp(check(isString, isNumber), loan, 'id');
      assertProp(check(isString, isNumber), loan, 'principal_amount');
      assertProp(check(isString, isNumber), loan, 'interest_amount');
      assertProp(check(isString, isNumber), loan, 'premi_amount');
      assertProp(check(isString, isNumber), loan, 'repayment_amount');
      assertPropString(loan, 'principal_currency_blockchain_key');
      assertPropString(loan, 'principal_currency_token_id');
      assertPropString(loan, 'status');
      assertProp(check(isString, isNumber), loan, 'borrower_user_id');
      assertProp(isInstanceOf(Date), loan, 'origination_date');
      assertProp(isInstanceOf(Date), loan, 'maturity_date');
      assertProp(check(isString, isNumber), loan, 'term_in_months');
      assertProp(check(isString, isNumber), loan, 'decimals');
      assertPropString(loan, 'symbol');
      assertPropString(loan, 'name');

      if (loan.status !== 'Active') {
        throw new Error(`Cannot request early repayment for loan with status: ${loan.status}`);
      }

      // NOTE: Early repayment calculations should be done in service layer using LoanCalculationService
      // Repository should only handle data storage and retrieval
      const totalRepaymentAmount = loan.repayment_amount; // Use raw amount, calculations in service layer

      // Use provided wallet information for early repayment invoice

      // Create early repayment invoice
      const invoiceRows = await tx.sql`
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
          ${borrowerUserId},
          ${loan.principal_currency_blockchain_key},
          ${loan.principal_currency_token_id},
          ${totalRepaymentAmount},
          ${repaymentWalletDerivationPath},
          ${repaymentWalletAddress},
          'LoanEarlyRepayment',
          'Pending',
          ${requestDate.toISOString()},
          ${requestDate.toISOString()},
          ${new Date(requestDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()}, -- 3 days to pay for early repayment
          ${loanId}
        )
        RETURNING 
          id,
          invoiced_amount,
          status,
          invoice_date,
          due_date,
          expired_date,
          paid_date
      `;

      const invoice = invoiceRows[0];
      assertDefined(invoice, 'Early repayment invoice creation failed');
      assertProp(check(isString, isNumber), invoice, 'id');
      assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
      assertPropString(invoice, 'status');
      assertProp(isInstanceOf(Date), invoice, 'invoice_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'due_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'expired_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'paid_date');

      // Create or update loan repayment record
      await tx.sql`
        INSERT INTO loan_repayments (
          loan_id,
          repayment_initiator,
          repayment_invoice_id,
          repayment_invoice_date,
          acknowledgment
        )
        VALUES (
          ${loanId},
          'Borrower',
          ${invoice.id},
          ${requestDate.toISOString()},
          ${acknowledgmentText}
        )
        ON CONFLICT (loan_id) DO UPDATE SET
          repayment_initiator = 'Borrower',
          repayment_invoice_id = ${invoice.id},
          repayment_invoice_date = ${requestDate.toISOString()},
          acknowledgment = ${acknowledgmentText}
      `;

      await tx.commitTransaction();

      return {
        success: true,
        message: 'Early repayment request processed successfully',
        data: {
          loanId: String(loanId),
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
              earlyRepaymentDate: requestDate,
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
              new Date(requestDate.getTime() + 3 * 24 * 60 * 60 * 1000),
            paidDate: invoice.paid_date || undefined,
          },
        },
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw new Error(`Early repayment request failed: ${error}`);
    }
  }
}
