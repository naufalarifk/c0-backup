import {
  assertArrayOf,
  assertDefined,
  assertPropDate,
  assertPropNullableDate,
  assertPropNullableString,
  assertPropNullableStringOrNumber,
  assertPropString,
  assertPropStringOrNumber,
  hasPropArray,
} from '../utils/assertions';
import { FinanceRepository } from './finance.repository';
import {
  BorrowerCalculatesLoanRequirementsParams,
  BorrowerCalculatesLoanRequirementsResult,
  BorrowerCreatesLoanApplicationParams,
  BorrowerCreatesLoanApplicationResult,
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
  LenderClosesLoanOfferParams,
  LenderClosesLoanOfferResult,
  LenderCreatesLoanOfferParams,
  LenderCreatesLoanOfferResult,
  LenderViewsMyLoanOffersParams,
  LenderViewsMyLoanOffersResult,
} from './loan.types';

function assertPlatformConfig(config: unknown) {
  assertDefined(config, 'Platform config is undefined');
  assertPropStringOrNumber(config, 'loan_provision_rate');
  assertPropStringOrNumber(config, 'loan_min_ltv_ratio');
  assertPropStringOrNumber(config, 'loan_max_ltv_ratio');
  return config;
}

/**
 * LoanRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
export abstract class LoanRepository extends FinanceRepository {
  async lenderCreatesLoanOffer(
    params: LenderCreatesLoanOfferParams,
  ): Promise<LenderCreatesLoanOfferResult> {
    const {
      lenderUserId,
      principalBlockchainKey,
      principalTokenId,
      offeredPrincipalAmount,
      minLoanPrincipalAmount,
      maxLoanPrincipalAmount,
      interestRate,
      termInMonthsOptions,
      expirationDate,
      createdDate,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // First, validate that the currency exists
      const currencyRows = await tx.sql`
        SELECT blockchain_key, token_id, decimals, symbol, name
        FROM currencies
        WHERE blockchain_key = ${principalBlockchainKey} AND token_id = ${principalTokenId}
      `;

      if (currencyRows.length === 0) {
        throw new Error(`Currency ${principalBlockchainKey}:${principalTokenId} does not exist`);
      }

      const currency = currencyRows[0];
      assertDefined(currency, 'Currency validation failed');
      assertPropString(currency, 'blockchain_key');
      assertPropString(currency, 'token_id');
      assertPropStringOrNumber(currency, 'decimals');
      assertPropString(currency, 'symbol');
      assertPropString(currency, 'name');

      // Create the loan offer
      const loanOfferRows = await tx.sql`
        INSERT INTO loan_offers (
          lender_user_id,
          principal_currency_blockchain_key,
          principal_currency_token_id,
          offered_principal_amount,
          min_loan_principal_amount,
          max_loan_principal_amount,
          interest_rate,
          term_in_months_options,
          status,
          created_date,
          expired_date
        )
        VALUES (
          ${lenderUserId},
          ${principalBlockchainKey},
          ${principalTokenId},
          ${offeredPrincipalAmount},
          ${minLoanPrincipalAmount},
          ${maxLoanPrincipalAmount},
          ${interestRate},
          ${termInMonthsOptions},
          'Funding',
          ${createdDate.toISOString()},
          ${expirationDate.toISOString()}
        )
        RETURNING 
          id,
          lender_user_id,
          offered_principal_amount,
          available_principal_amount,
          min_loan_principal_amount,
          max_loan_principal_amount,
          interest_rate,
          term_in_months_options,
          status,
          created_date,
          expired_date
      `;

      const loanOffer = loanOfferRows[0];
      assertDefined(loanOffer, 'Loan offer creation failed');
      assertPropStringOrNumber(loanOffer, 'id');
      assertPropStringOrNumber(loanOffer, 'lender_user_id');
      assertPropStringOrNumber(loanOffer, 'offered_principal_amount');
      assertPropStringOrNumber(loanOffer, 'available_principal_amount');
      assertPropStringOrNumber(loanOffer, 'min_loan_principal_amount');
      assertPropStringOrNumber(loanOffer, 'max_loan_principal_amount');
      assertPropStringOrNumber(loanOffer, 'interest_rate');
      assertPropString(loanOffer, 'status');
      assertPropDate(loanOffer, 'created_date');
      assertPropDate(loanOffer, 'expired_date');

      // Generate unique wallet derivation path for funding invoice
      const walletDerivationPath = `m/44'/0'/0'/0/${Date.now()}`;
      const walletAddress = `funding_address_${loanOffer.id}_${Date.now()}`;

      // Create funding invoice
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
          loan_offer_id
        )
        VALUES (
          ${lenderUserId},
          ${principalBlockchainKey},
          ${principalTokenId},
          ${offeredPrincipalAmount},
          ${walletDerivationPath},
          ${walletAddress},
          'LoanPrincipal',
          'Pending',
          ${createdDate.toISOString()},
          ${createdDate.toISOString()},
          ${expirationDate.toISOString()},
          ${loanOffer.id}
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
      assertDefined(invoice, 'Funding invoice creation failed');
      assertPropStringOrNumber(invoice, 'id');
      assertPropStringOrNumber(invoice, 'invoiced_amount');
      assertPropString(invoice, 'status');
      assertPropDate(invoice, 'invoice_date');
      assertPropNullableDate(invoice, 'due_date');
      assertPropNullableDate(invoice, 'expired_date');
      assertPropNullableDate(invoice, 'paid_date');

      await tx.commitTransaction();

      return {
        id: String(loanOffer.id),
        lenderUserId: String(loanOffer.lender_user_id),
        principalCurrency: {
          blockchainKey: currency.blockchain_key,
          tokenId: currency.token_id,
          decimals: Number(currency.decimals),
          symbol: currency.symbol,
          name: currency.name,
        },
        offeredPrincipalAmount: String(loanOffer.offered_principal_amount),
        availablePrincipalAmount: String(loanOffer.available_principal_amount),
        minLoanPrincipalAmount: String(loanOffer.min_loan_principal_amount),
        maxLoanPrincipalAmount: String(loanOffer.max_loan_principal_amount),
        interestRate: Number(loanOffer.interest_rate),
        termInMonthsOptions: hasPropArray(loanOffer, 'term_in_months_options')
          ? loanOffer.term_in_months_options.map(Number)
          : [],
        status: loanOffer.status as 'Funding' | 'Published' | 'Closed' | 'Expired',
        createdDate: loanOffer.created_date,
        expirationDate: loanOffer.expired_date,
        fundingInvoice: {
          id: String(invoice.id),
          amount: String(invoice.invoiced_amount),
          currency: {
            blockchainKey: currency.blockchain_key,
            tokenId: currency.token_id,
            decimals: Number(currency.decimals),
            symbol: currency.symbol,
            name: currency.name,
          },
          status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
          createdDate: invoice.invoice_date,
          expiryDate: invoice.due_date || invoice.expired_date || expirationDate,
          paidDate: invoice.paid_date || undefined,
        },
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async lenderClosesLoanOffer(
    params: LenderClosesLoanOfferParams,
  ): Promise<LenderClosesLoanOfferResult> {
    const { loanOfferId, lenderUserId, closedDate: updateDate, closureReason } = params;

    const tx = await this.beginTransaction();
    try {
      // Get current loan offer status to validate transition
      const currentOfferRows = await tx.sql`
        SELECT status 
        FROM loan_offers 
        WHERE id = ${loanOfferId} AND lender_user_id = ${lenderUserId}
      `;

      if (currentOfferRows.length === 0) {
        throw new Error('Loan offer not found or access denied');
      }

      const currentOffer = currentOfferRows[0];
      assertDefined(currentOffer, 'Current offer validation failed');
      assertPropString(currentOffer, 'status');

      let newStatus: string;
      let closedDate: Date | null = null;

      if (['Funding', 'Published'].includes(currentOffer.status)) {
        newStatus = 'Closed';
        closedDate = updateDate;
      } else {
        throw new Error(`Cannot close offer from status: ${currentOffer.status}`);
      }

      // Update loan offer
      const updateRows = await tx.sql`
        UPDATE loan_offers
        SET 
          status = ${newStatus},
          closed_date = ${closedDate?.toISOString()},
          closure_reason = ${closureReason || null}
        WHERE id = ${loanOfferId} AND lender_user_id = ${lenderUserId}
        RETURNING 
          id,
          status,
          closed_date,
          closure_reason
      `;

      if (updateRows.length === 0) {
        throw new Error('Loan offer update failed');
      }

      const updatedOffer = updateRows[0];
      assertDefined(updatedOffer, 'Updated offer validation failed');
      assertPropStringOrNumber(updatedOffer, 'id');
      assertPropString(updatedOffer, 'status');
      assertPropNullableDate(updatedOffer, 'closed_date');
      assertPropNullableString(updatedOffer, 'closure_reason');

      await tx.commitTransaction();

      return {
        id: String(updatedOffer.id),
        status: updatedOffer.status as 'Funding' | 'Published' | 'Closed' | 'Expired',
        closedDate: updateDate,
        closureReason: updatedOffer.closure_reason || undefined,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async lenderViewsMyLoanOffers(
    params: LenderViewsMyLoanOffersParams,
  ): Promise<LenderViewsMyLoanOffersResult> {
    const { lenderUserId, page = 1, limit = 20, status } = params;

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM loan_offers
      WHERE lender_user_id = ${lenderUserId}
        AND (${status}::text IS NULL OR status = ${status})
    `;

    const countRow = countRows[0];
    assertDefined(countRow, 'Count query failed');
    assertPropStringOrNumber(countRow, 'total');
    const totalCount = Number(countRow.total);

    // Get loan offers with currency details
    const offerRows = await this.sql`
      SELECT 
        lo.id,
        lo.offered_principal_amount,
        lo.available_principal_amount,
        lo.disbursed_principal_amount,
        lo.reserved_principal_amount,
        lo.min_loan_principal_amount,
        lo.max_loan_principal_amount,
        lo.interest_rate,
        lo.term_in_months_options,
        lo.status,
        lo.created_date,
        lo.expired_date,
        lo.published_date,
        lo.closed_date,
        lo.closure_reason,
        c.blockchain_key,
        c.token_id,
        c.decimals,
        c.symbol,
        c.name
      FROM loan_offers lo
      JOIN currencies c ON lo.principal_currency_blockchain_key = c.blockchain_key 
        AND lo.principal_currency_token_id = c.token_id
      WHERE lo.lender_user_id = ${lenderUserId}
        AND (${status}::text IS NULL OR lo.status = ${status})
      ORDER BY lo.created_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const loanOffers = offerRows.map(function (row: unknown) {
      assertDefined(row, 'Loan offer row is undefined');
      assertPropStringOrNumber(row, 'id');
      assertPropStringOrNumber(row, 'offered_principal_amount');
      assertPropStringOrNumber(row, 'available_principal_amount');
      assertPropStringOrNumber(row, 'disbursed_principal_amount');
      assertPropStringOrNumber(row, 'reserved_principal_amount');
      assertPropStringOrNumber(row, 'min_loan_principal_amount');
      assertPropStringOrNumber(row, 'max_loan_principal_amount');
      assertPropStringOrNumber(row, 'interest_rate');
      assertPropString(row, 'status');
      assertPropDate(row, 'created_date');
      assertPropDate(row, 'expired_date');
      assertPropNullableDate(row, 'published_date');
      assertPropNullableDate(row, 'closed_date');
      assertPropNullableString(row, 'closure_reason');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'token_id');
      assertPropStringOrNumber(row, 'decimals');
      assertPropString(row, 'symbol');
      assertPropString(row, 'name');

      return {
        id: String(row.id),
        principalCurrency: {
          blockchainKey: row.blockchain_key,
          tokenId: row.token_id,
          decimals: Number(row.decimals),
          symbol: row.symbol,
          name: row.name,
        },
        offeredPrincipalAmount: String(row.offered_principal_amount),
        availablePrincipalAmount: String(row.available_principal_amount),
        disbursedPrincipalAmount: String(row.disbursed_principal_amount),
        reservedPrincipalAmount: String(row.reserved_principal_amount),
        minLoanPrincipalAmount: String(row.min_loan_principal_amount),
        maxLoanPrincipalAmount: String(row.max_loan_principal_amount),
        interestRate: Number(row.interest_rate),
        termInMonthsOptions: hasPropArray(row, 'term_in_months_options')
          ? row.term_in_months_options.map(Number)
          : [],
        status: row.status as 'Funding' | 'Published' | 'Closed' | 'Expired',
        createdDate: row.created_date,
        expirationDate: row.expired_date,
        publishedDate: row.published_date || undefined,
        closedDate: row.closed_date || undefined,
        closureReason: row.closure_reason || undefined,
      };
    });

    const totalPages = Math.ceil(totalCount / validatedLimit);

    return {
      loanOffers,
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

  async borrowerCalculatesLoanRequirements(
    params: BorrowerCalculatesLoanRequirementsParams,
  ): Promise<BorrowerCalculatesLoanRequirementsResult> {
    const {
      collateralBlockchainKey,
      collateralTokenId,
      principalBlockchainKey,
      principalTokenId,
      principalAmount,
      termInMonths,
      calculationDate,
    } = params;

    // Get currency details for both principal and collateral
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
      return { success: false } as BorrowerCalculatesLoanRequirementsResult;
    }

    const currencies = currencyRows[0];
    assertDefined(currencies, 'Currency validation failed');
    assertPropString(currencies, 'principal_blockchain_key');
    assertPropString(currencies, 'principal_token_id');
    assertPropStringOrNumber(currencies, 'principal_decimals');
    assertPropString(currencies, 'principal_symbol');
    assertPropString(currencies, 'principal_name');
    assertPropString(currencies, 'collateral_blockchain_key');
    assertPropString(currencies, 'collateral_token_id');
    assertPropStringOrNumber(currencies, 'collateral_decimals');
    assertPropString(currencies, 'collateral_symbol');
    assertPropString(currencies, 'collateral_name');

    // Get platform configuration for LTV ratios and provision rate
    const platformConfigRows = await this.sql`
      SELECT 
        loan_provision_rate,
        loan_min_ltv_ratio,
        loan_max_ltv_ratio
      FROM platform_configs
      WHERE effective_date <= ${calculationDate.toISOString()}
      ORDER BY effective_date DESC
      LIMIT 1
    `;

    if (platformConfigRows.length === 0) {
      throw new Error('Platform configuration not found');
    }

    const platformConfig = platformConfigRows[0];
    assertDefined(platformConfig, 'Platform config validation failed');
    assertPropStringOrNumber(platformConfig, 'loan_provision_rate');
    assertPropStringOrNumber(platformConfig, 'loan_min_ltv_ratio');
    assertPropStringOrNumber(platformConfig, 'loan_max_ltv_ratio');

    // Get latest exchange rate for collateral to principal conversion
    const exchangeRateRows = await this.sql`
      SELECT 
        er.id,
        er.bid_price,
        er.ask_price,
        er.source_date
      FROM exchange_rates er
      JOIN price_feeds pf ON er.price_feed_id = pf.id
      WHERE pf.blockchain_key = ${collateralBlockchainKey}
        AND ((pf.base_currency_token_id = ${collateralTokenId} AND pf.quote_currency_token_id = ${principalTokenId})
             OR (pf.base_currency_token_id = ${principalTokenId} AND pf.quote_currency_token_id = ${collateralTokenId}))
      ORDER BY er.source_date DESC
      LIMIT 1
    `;

    if (exchangeRateRows.length === 0) {
      throw new Error('Exchange rate not found for currency pair');
    }

    const exchangeRate = exchangeRateRows[0];
    assertDefined(exchangeRate, 'Exchange rate validation failed');
    assertPropStringOrNumber(exchangeRate, 'id');
    assertPropStringOrNumber(exchangeRate, 'bid_price');
    assertPropStringOrNumber(exchangeRate, 'ask_price');
    assertPropDate(exchangeRate, 'source_date');

    // Calculate collateral requirements
    const provisionRate = Number(platformConfig.loan_provision_rate);
    const minLtvRatio = Number(platformConfig.loan_min_ltv_ratio) / 100; // Convert percentage to decimal
    const maxLtvRatio = Number(platformConfig.loan_max_ltv_ratio) / 100;
    const provisionAmount = Math.floor(Number(principalAmount) * (provisionRate / 100));

    // Calculate required collateral using minimum LTV ratio (more conservative)
    const exchangeRateValue = Number(exchangeRate.bid_price); // Use bid price for conservative estimate
    const requiredCollateralAmount = Math.ceil(
      Number(principalAmount) / (minLtvRatio * exchangeRateValue),
    );

    // Calculate expiration date (default to 30 days from calculation)
    const expirationDate = new Date(calculationDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      success: true,
      data: {
        principalAmount,
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
        requiredCollateralAmount: String(requiredCollateralAmount),
        minLtvRatio: Number(platformConfig.loan_min_ltv_ratio),
        maxLtvRatio: Number(platformConfig.loan_max_ltv_ratio),
        provisionAmount: String(provisionAmount),
        provisionRate,
        exchangeRate: {
          id: String(exchangeRate.id),
          rate: String(exchangeRateValue),
          timestamp: exchangeRate.source_date,
        },
        termInMonths,
        expirationDate,
      },
    };
  }

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
      maxInterestRate,
      termInMonths,
      liquidationMode,
      appliedDate,
      expirationDate,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Validate currencies exist
      const currencyRows = await tx.sql`
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
      assertPropStringOrNumber(currencies, 'principal_decimals');
      assertPropString(currencies, 'principal_symbol');
      assertPropString(currencies, 'principal_name');
      assertPropString(currencies, 'collateral_blockchain_key');
      assertPropString(currencies, 'collateral_token_id');
      assertPropStringOrNumber(currencies, 'collateral_decimals');
      assertPropString(currencies, 'collateral_symbol');
      assertPropString(currencies, 'collateral_name');

      // Get platform configuration
      const platformConfigRows = await tx.sql`
        SELECT 
          loan_provision_rate,
          loan_min_ltv_ratio,
          loan_max_ltv_ratio
        FROM platform_configs
        WHERE effective_date <= ${appliedDate.toISOString()}
        ORDER BY effective_date DESC
        LIMIT 1
      `;

      assertArrayOf(platformConfigRows, assertPlatformConfig);
      const [platformConfig] = platformConfigRows;

      // Get latest exchange rate for collateral deposit calculation
      const exchangeRateRows = await tx.sql`
        SELECT 
          er.id,
          er.bid_price,
          er.ask_price,
          er.source_date
        FROM exchange_rates er
        JOIN price_feeds pf ON er.price_feed_id = pf.id
        WHERE pf.blockchain_key = ${collateralBlockchainKey}
          AND ((pf.base_currency_token_id = ${collateralTokenId} AND pf.quote_currency_token_id = ${principalTokenId})
               OR (pf.base_currency_token_id = ${principalTokenId} AND pf.quote_currency_token_id = ${collateralTokenId}))
        ORDER BY er.source_date DESC
        LIMIT 1
      `;

      if (exchangeRateRows.length === 0) {
        throw new Error('Exchange rate not found for currency pair');
      }

      const exchangeRate = exchangeRateRows[0];
      assertDefined(exchangeRate, 'Exchange rate validation failed');
      assertPropStringOrNumber(exchangeRate, 'id');
      assertPropStringOrNumber(exchangeRate, 'bid_price');

      // Calculate provision amount and collateral deposit
      const provisionRate = Number(platformConfig.loan_provision_rate);
      const minLtvRatio = Number(platformConfig.loan_min_ltv_ratio) / 100;
      const maxLtvRatio = Number(platformConfig.loan_max_ltv_ratio) / 100;
      const provisionAmount = Math.floor(Number(principalAmount) * (provisionRate / 100));
      const exchangeRateValue = Number(exchangeRate.bid_price);
      const collateralDepositAmount = Math.ceil(
        Number(principalAmount) / (minLtvRatio * exchangeRateValue),
      );

      // Create loan application
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
          ${exchangeRate.id},
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
      assertPropStringOrNumber(loanApplication, 'id');
      assertPropStringOrNumber(loanApplication, 'borrower_user_id');
      assertPropNullableStringOrNumber(loanApplication, 'loan_offer_id');
      assertPropStringOrNumber(loanApplication, 'principal_amount');
      assertPropStringOrNumber(loanApplication, 'provision_amount');
      assertPropStringOrNumber(loanApplication, 'max_interest_rate');
      assertPropStringOrNumber(loanApplication, 'min_ltv_ratio');
      assertPropStringOrNumber(loanApplication, 'max_ltv_ratio');
      assertPropStringOrNumber(loanApplication, 'term_in_months');
      assertPropString(loanApplication, 'liquidation_mode');
      assertPropStringOrNumber(loanApplication, 'collateral_deposit_amount');
      assertPropString(loanApplication, 'status');
      assertPropDate(loanApplication, 'applied_date');
      assertPropDate(loanApplication, 'expired_date');

      // Generate unique wallet derivation path for collateral deposit invoice
      const walletDerivationPath = `m/44'/0'/0'/0/${Date.now()}`;
      const walletAddress = `collateral_address_${loanApplication.id}_${Date.now()}`;

      // Create collateral deposit invoice
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
          loan_application_id
        )
        VALUES (
          ${borrowerUserId},
          ${collateralBlockchainKey},
          ${collateralTokenId},
          ${collateralDepositAmount},
          ${walletDerivationPath},
          ${walletAddress},
          'LoanCollateral',
          'Pending',
          ${appliedDate.toISOString()},
          ${appliedDate.toISOString()},
          ${expirationDate.toISOString()},
          ${loanApplication.id}
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

      assertArrayOf(invoiceRows, function (invoice) {
        assertDefined(invoice, 'Invoice row is undefined');
        assertPropStringOrNumber(invoice, 'id');
        assertPropStringOrNumber(invoice, 'invoiced_amount');
        assertPropString(invoice, 'status');
        assertPropDate(invoice, 'invoice_date');
        assertPropNullableDate(invoice, 'due_date');
        assertPropNullableDate(invoice, 'expired_date');
        assertPropNullableDate(invoice, 'paid_date');
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
        principalCurrency: {
          blockchainKey: currencies.principal_blockchain_key,
          tokenId: currencies.principal_token_id,
          decimals: Number(currencies.principal_decimals),
          symbol: currencies.principal_symbol,
          name: currencies.principal_name,
        },
        principalAmount: String(loanApplication.principal_amount),
        provisionAmount: String(loanApplication.provision_amount),
        maxInterestRate: Number(loanApplication.max_interest_rate),
        minLtvRatio: Number(loanApplication.min_ltv_ratio),
        maxLtvRatio: Number(loanApplication.max_ltv_ratio),
        termInMonths: Number(loanApplication.term_in_months),
        liquidationMode: loanApplication.liquidation_mode as 'Partial' | 'Full',
        collateralCurrency: {
          blockchainKey: currencies.collateral_blockchain_key,
          tokenId: currencies.collateral_token_id,
          decimals: Number(currencies.collateral_decimals),
          symbol: currencies.collateral_symbol,
          name: currencies.collateral_name,
        },
        collateralDepositAmount: String(loanApplication.collateral_deposit_amount),
        status: loanApplication.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Closed'
          | 'Expired',
        appliedDate: loanApplication.applied_date,
        expirationDate: loanApplication.expired_date,
        collateralDepositInvoice: {
          id: String(invoice.id),
          amount: String(invoice.invoiced_amount),
          currency: {
            blockchainKey: currencies.collateral_blockchain_key,
            tokenId: currencies.collateral_token_id,
            decimals: Number(currencies.collateral_decimals),
            symbol: currencies.collateral_symbol,
            name: currencies.collateral_name,
          },
          status: invoice.status as 'Pending' | 'Paid' | 'Expired' | 'Cancelled',
          createdDate: invoice.invoice_date,
          expiryDate: invoice.due_date || invoice.expired_date || expirationDate,
          paidDate: invoice.paid_date || undefined,
        },
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
      assertPropNullableDate(currentApplication, 'expired_date');

      let newStatus: string;
      let closedDate: Date | null = null;
      let newExpirationDate: Date | null = null;

      switch (action) {
        case 'cancel':
          if (!['PendingCollateral', 'Published'].includes(currentApplication.status)) {
            throw new Error(`Cannot cancel application from status: ${currentApplication.status}`);
          }
          newStatus = 'Closed';
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
      assertPropStringOrNumber(updatedApplication, 'id');
      assertPropString(updatedApplication, 'status');
      assertPropNullableDate(updatedApplication, 'closed_date');
      assertPropNullableString(updatedApplication, 'closure_reason');
      assertPropDate(updatedApplication, 'expired_date');

      await tx.commitTransaction();

      return {
        id: String(updatedApplication.id),
        status: updatedApplication.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
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
    assertPropStringOrNumber(countRow, 'total');
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
      assertPropStringOrNumber(row, 'id');
      assertPropNullableString(row, 'loan_offer_id');
      assertPropString(row, 'principal_blockchain_key');
      assertPropString(row, 'principal_token_id');
      assertPropStringOrNumber(row, 'principal_decimals');
      assertPropString(row, 'principal_symbol');
      assertPropString(row, 'principal_name');
      assertPropStringOrNumber(row, 'principal_amount');
      assertPropStringOrNumber(row, 'provision_amount');
      assertPropStringOrNumber(row, 'max_interest_rate');
      assertPropStringOrNumber(row, 'min_ltv_ratio');
      assertPropStringOrNumber(row, 'max_ltv_ratio');
      assertPropStringOrNumber(row, 'term_in_months');
      assertPropString(row, 'liquidation_mode');
      assertPropString(row, 'collateral_blockchain_key');
      assertPropString(row, 'collateral_token_id');
      assertPropStringOrNumber(row, 'collateral_decimals');
      assertPropString(row, 'collateral_symbol');
      assertPropString(row, 'collateral_name');
      assertPropStringOrNumber(row, 'collateral_deposit_amount');
      assertPropString(row, 'status');
      assertPropDate(row, 'applied_date');
      assertPropDate(row, 'expired_date');
      assertPropNullableDate(row, 'published_date');
      assertPropNullableDate(row, 'matched_date');
      assertPropNullableString(row, 'matched_loan_offer_id');
      assertPropNullableDate(row, 'closed_date');
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
        status: row.status as 'PendingCollateral' | 'Published' | 'Matched' | 'Closed' | 'Expired',
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
    const { loanId, borrowerUserId, repaymentDate } = params;

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
      assertPropStringOrNumber(loan, 'id');
      assertPropString(loan, 'principal_currency_blockchain_key');
      assertPropString(loan, 'principal_currency_token_id');
      assertPropStringOrNumber(loan, 'repayment_amount');
      assertPropString(loan, 'status');
      assertPropStringOrNumber(loan, 'borrower_user_id');
      assertPropStringOrNumber(loan, 'decimals');
      assertPropString(loan, 'symbol');
      assertPropString(loan, 'name');

      if (loan.status !== 'Active') {
        throw new Error(`Cannot repay loan with status: ${loan.status}`);
      }

      // Generate unique wallet derivation path for repayment invoice
      const walletDerivationPath = `m/44'/0'/0'/0/${Date.now()}`;
      const walletAddress = `repayment_address_${loanId}_${Date.now()}`;

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
          ${walletDerivationPath},
          ${walletAddress},
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
      assertPropStringOrNumber(invoice, 'id');
      assertPropStringOrNumber(invoice, 'invoiced_amount');
      assertPropString(invoice, 'status');
      assertPropDate(invoice, 'invoice_date');
      assertPropNullableDate(invoice, 'due_date');
      assertPropNullableDate(invoice, 'expired_date');
      assertPropNullableDate(invoice, 'paid_date');

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

    // Get loan details and validate borrower access
    const loanRows = await this.sql`
      SELECT 
        l.id,
        l.principal_amount,
        l.interest_amount,
        l.premi_amount,
        l.liquidation_fee_amount,
        l.repayment_amount,
        l.collateral_currency_blockchain_key,
        l.collateral_currency_token_id,
        l.collateral_amount,
        l.liquidation_mode,
        l.status,
        la.borrower_user_id,
        cc.decimals as collateral_decimals,
        cc.symbol as collateral_symbol,
        cc.name as collateral_name
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      JOIN currencies cc ON l.collateral_currency_blockchain_key = cc.blockchain_key
        AND l.collateral_currency_token_id = cc.token_id
      WHERE l.id = ${loanId} AND la.borrower_user_id = ${borrowerUserId}
    `;

    if (loanRows.length === 0) {
      throw new Error('Loan not found or access denied');
    }

    const loan = loanRows[0];
    assertDefined(loan, 'Loan validation failed');
    assertPropStringOrNumber(loan, 'id');
    assertPropStringOrNumber(loan, 'principal_amount');
    assertPropStringOrNumber(loan, 'interest_amount');
    assertPropStringOrNumber(loan, 'premi_amount');
    assertPropStringOrNumber(loan, 'liquidation_fee_amount');
    assertPropStringOrNumber(loan, 'repayment_amount');
    assertPropString(loan, 'collateral_currency_blockchain_key');
    assertPropString(loan, 'collateral_currency_token_id');
    assertPropStringOrNumber(loan, 'collateral_amount');
    assertPropString(loan, 'liquidation_mode');
    assertPropString(loan, 'status');
    assertPropStringOrNumber(loan, 'borrower_user_id');
    assertPropStringOrNumber(loan, 'collateral_decimals');
    assertPropString(loan, 'collateral_symbol');
    assertPropString(loan, 'collateral_name');

    if (!['Active', 'Originated'].includes(loan.status)) {
      throw new Error(`Cannot estimate liquidation for loan with status: ${loan.status}`);
    }

    // Get latest exchange rate for collateral valuation
    const exchangeRateRows = await this.sql`
      SELECT 
        er.id,
        er.bid_price,
        er.ask_price,
        er.source_date
      FROM exchange_rates er
      JOIN price_feeds pf ON er.price_feed_id = pf.id
      WHERE pf.blockchain_key = ${loan.collateral_currency_blockchain_key}
        AND pf.base_currency_token_id = ${loan.collateral_currency_token_id}
      ORDER BY er.source_date DESC
      LIMIT 1
    `;

    if (exchangeRateRows.length === 0) {
      throw new Error('Exchange rate not found for collateral currency');
    }

    const exchangeRate = exchangeRateRows[0];
    assertDefined(exchangeRate, 'Exchange rate validation failed');
    assertPropStringOrNumber(exchangeRate, 'id');
    assertPropStringOrNumber(exchangeRate, 'bid_price');

    // Calculate liquidation breakdown
    const totalOutstandingAmount =
      Number(loan.principal_amount) +
      Number(loan.interest_amount) +
      Number(loan.premi_amount) +
      Number(loan.liquidation_fee_amount);
    const currentValuationAmount = Number(loan.collateral_amount) * Number(exchangeRate.bid_price);
    const currentLtvRatio = Number(loan.principal_amount) / currentValuationAmount;
    const estimatedSlippage = 0.02; // 2% estimated market slippage
    const estimatedLiquidationAmount = currentValuationAmount * (1 - estimatedSlippage);
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
              blockchainKey: loan.collateral_currency_blockchain_key,
              tokenId: loan.collateral_currency_token_id,
              decimals: Number(loan.collateral_decimals),
              symbol: loan.collateral_symbol,
              name: loan.collateral_name,
            },
            currentCollateralAmount: String(loan.collateral_amount),
            currentValuationAmount: String(Math.floor(currentValuationAmount)),
            currentLtvRatio,
            estimatedLiquidationAmount: String(Math.floor(estimatedLiquidationAmount)),
            estimatedSurplusDeficit: String(Math.floor(estimatedSurplusDeficit)),
          },
          calculationDetails: {
            exchangeRateId: String(exchangeRate.id),
            valuationDate: estimateDate,
            liquidationMode: loan.liquidation_mode as 'Partial' | 'Full',
            marketProvider: 'DefaultProvider',
            estimatedSlippage,
          },
        },
      },
    };
  }

  async borrowerRequestsEarlyLiquidation(
    params: BorrowerRequestsEarlyLiquidationParams,
  ): Promise<BorrowerRequestsEarlyLiquidationResult> {
    const { loanId, borrowerUserId, acknowledgment, requestDate } = params;

    const tx = await this.beginTransaction();
    try {
      // Get loan details and validate borrower access
      const loanRows = await tx.sql`
        SELECT 
          l.id,
          l.status,
          l.repayment_amount,
          l.premi_amount,
          l.liquidation_fee_amount
        FROM loans l
        JOIN loan_applications la ON l.loan_application_id = la.id
        WHERE l.id = ${loanId} AND la.borrower_user_id = ${borrowerUserId}
      `;

      if (loanRows.length === 0) {
        throw new Error('Loan not found or access denied');
      }

      const loan = loanRows[0];
      assertDefined(loan, 'Loan validation failed');
      assertPropStringOrNumber(loan, 'id');
      assertPropString(loan, 'status');
      assertPropStringOrNumber(loan, 'repayment_amount');
      assertPropStringOrNumber(loan, 'premi_amount');
      assertPropStringOrNumber(loan, 'liquidation_fee_amount');

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

      // Calculate liquidation target amount
      const liquidationTargetAmount =
        Number(loan.repayment_amount) +
        Number(loan.premi_amount) +
        Number(loan.liquidation_fee_amount);

      // Create liquidation record
      await tx.sql`
        INSERT INTO loan_liquidations (
          loan_id,
          liquidation_initiator,
          liquidation_target_amount,
          market_provider,
          market_symbol,
          order_ref,
          status,
          order_date
        )
        VALUES (
          ${loanId},
          'Borrower',
          ${liquidationTargetAmount},
          'DefaultProvider',
          'DEFAULT',
          ${`borrower_liquidation_${loanId}_${Date.now()}`},
          'Pending',
          ${requestDate.toISOString()}
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

  async borrowerRequestsEarlyRepayment(
    params: BorrowerRequestsEarlyRepaymentParams,
  ): Promise<BorrowerRequestsEarlyRepaymentResult> {
    const { loanId, borrowerUserId, acknowledgment, requestDate } = params;

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
      assertPropStringOrNumber(loan, 'id');
      assertPropStringOrNumber(loan, 'principal_amount');
      assertPropStringOrNumber(loan, 'interest_amount');
      assertPropStringOrNumber(loan, 'premi_amount');
      assertPropStringOrNumber(loan, 'repayment_amount');
      assertPropString(loan, 'principal_currency_blockchain_key');
      assertPropString(loan, 'principal_currency_token_id');
      assertPropString(loan, 'status');
      assertPropStringOrNumber(loan, 'borrower_user_id');
      assertPropDate(loan, 'origination_date');
      assertPropDate(loan, 'maturity_date');
      assertPropStringOrNumber(loan, 'term_in_months');
      assertPropStringOrNumber(loan, 'decimals');
      assertPropString(loan, 'symbol');
      assertPropString(loan, 'name');

      if (loan.status !== 'Active') {
        throw new Error(`Cannot request early repayment for loan with status: ${loan.status}`);
      }

      // Calculate early repayment details
      const originationDate = new Date(loan.origination_date);
      const maturityDate = new Date(loan.maturity_date);
      const termInMonths = Number(loan.term_in_months);
      const totalTermDays = Math.ceil(
        (maturityDate.getTime() - originationDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const elapsedDays = Math.ceil(
        (requestDate.getTime() - originationDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const remainingTermDays = Math.max(0, totalTermDays - elapsedDays);

      // For early repayment, borrower still pays full interest (as per common lending practice)
      const fullInterestCharged = true;
      const totalRepaymentAmount = Number(loan.repayment_amount); // Full repayment amount

      // Generate unique wallet derivation path for early repayment invoice
      const walletDerivationPath = `m/44'/0'/0'/0/${Date.now()}`;
      const walletAddress = `early_repayment_address_${loanId}_${Date.now()}`;

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
          ${walletDerivationPath},
          ${walletAddress},
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
      assertPropStringOrNumber(invoice, 'id');
      assertPropStringOrNumber(invoice, 'invoiced_amount');
      assertPropString(invoice, 'status');
      assertPropDate(invoice, 'invoice_date');
      assertPropNullableDate(invoice, 'due_date');
      assertPropNullableDate(invoice, 'expired_date');
      assertPropNullableDate(invoice, 'paid_date');

      // Create or update loan repayment record
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
          ${requestDate.toISOString()}
        )
        ON CONFLICT (loan_id) DO UPDATE SET
          repayment_initiator = 'Borrower',
          repayment_invoice_id = ${invoice.id},
          repayment_invoice_date = ${requestDate.toISOString()}
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
              fullInterestCharged,
              remainingTermDays,
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
      throw new Error(`Early repayment request failed`, { cause: error });
    }
  }

  async testSetupPriceFeeds(params: {
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
    source: string;
    bidPrice: number;
    askPrice: number;
    sourceDate: Date;
  }): Promise<{ priceFeedId: string; exchangeRateId: string }> {
    const {
      blockchainKey,
      baseCurrencyTokenId,
      quoteCurrencyTokenId,
      source,
      bidPrice,
      askPrice,
      sourceDate,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Verify that the specified currencies exist
      const baseCurrencyRows = await tx.sql`
        SELECT blockchain_key, token_id, symbol, decimals FROM currencies 
        WHERE blockchain_key = ${blockchainKey} AND token_id = ${baseCurrencyTokenId}
      `;

      if (baseCurrencyRows.length === 0) {
        throw new Error(`Base currency not found: ${blockchainKey}:${baseCurrencyTokenId}`);
      }

      const quoteCurrencyRows = await tx.sql`
        SELECT blockchain_key, token_id, symbol, decimals FROM currencies 
        WHERE blockchain_key = ${blockchainKey} AND token_id = ${quoteCurrencyTokenId}
      `;

      if (quoteCurrencyRows.length === 0) {
        throw new Error(`Quote currency not found: ${blockchainKey}:${quoteCurrencyTokenId}`);
      }

      const baseCurrency = baseCurrencyRows[0];
      const quoteCurrency = quoteCurrencyRows[0];

      assertDefined(baseCurrency, 'Base currency not found');
      assertPropString(baseCurrency, 'blockchain_key');
      assertPropString(baseCurrency, 'token_id');
      assertPropString(baseCurrency, 'symbol');

      assertDefined(quoteCurrency, 'Quote currency not found');
      assertPropString(quoteCurrency, 'blockchain_key');
      assertPropString(quoteCurrency, 'token_id');
      assertPropString(quoteCurrency, 'symbol');

      // Insert price feed using the specified currencies
      const priceFeedRows = await tx.sql`
        INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
        VALUES (${blockchainKey}, ${baseCurrencyTokenId}, ${quoteCurrencyTokenId}, ${source})
        RETURNING id
      `;

      const priceFeed = priceFeedRows[0];
      assertDefined(priceFeed, 'Price feed creation failed');
      assertPropStringOrNumber(priceFeed, 'id');
      const priceFeedId = String(priceFeed.id);

      // Insert exchange rate
      const exchangeRateRows = await tx.sql`
        INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
        VALUES (${priceFeedId}, ${bidPrice}, ${askPrice}, ${sourceDate.toISOString()}, ${sourceDate.toISOString()})
        RETURNING id
      `;

      const exchangeRate = exchangeRateRows[0];
      assertDefined(exchangeRate, 'Exchange rate creation failed');
      assertPropStringOrNumber(exchangeRate, 'id');
      const exchangeRateId = String(exchangeRate.id);

      await tx.commitTransaction();
      return { priceFeedId, exchangeRateId };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async testSetupPlatformConfig(params: {
    effectiveDate: Date;
    adminUserId: number;
    loanProvisionRate: number;
    loanIndividualRedeliveryFeeRate: number;
    loanInstitutionRedeliveryFeeRate: number;
    loanMinLtvRatio: number;
    loanMaxLtvRatio: number;
    loanRepaymentDurationInDays: number;
  }): Promise<void> {
    const {
      effectiveDate,
      adminUserId,
      loanProvisionRate,
      loanIndividualRedeliveryFeeRate,
      loanInstitutionRedeliveryFeeRate,
      loanMinLtvRatio,
      loanMaxLtvRatio,
      loanRepaymentDurationInDays,
    } = params;

    await this.sql`
      INSERT INTO platform_configs (
        effective_date, admin_user_id, loan_provision_rate,
        loan_individual_redelivery_fee_rate, loan_institution_redelivery_fee_rate,
        loan_min_ltv_ratio, loan_max_ltv_ratio, loan_repayment_duration_in_days
      ) VALUES (
        ${effectiveDate.toISOString()}, ${adminUserId}, ${loanProvisionRate},
        ${loanIndividualRedeliveryFeeRate}, ${loanInstitutionRedeliveryFeeRate},
        ${loanMinLtvRatio}, ${loanMaxLtvRatio}, ${loanRepaymentDurationInDays}
      )
    `;
  }

  async testPublishesLoanOffer(params: {
    loanOfferId: string;
    publishedDate: Date;
  }): Promise<void> {
    const { loanOfferId, publishedDate } = params;

    await this.sql`
      UPDATE loan_offers 
      SET status = 'Published', published_date = ${publishedDate.toISOString()}
      WHERE id = ${loanOfferId}
    `;
  }
}
