import {
  assertArrayOf,
  assertDefined,
  assertPropDate,
  assertPropNullableDate,
  assertPropNullableString,
  assertPropString,
  assertPropStringOrNumber,
  hasPropArray,
} from '../utils/assertions';
import {
  PlatformDisbursesPrincipalParams,
  PlatformDisbursesPrincipalResult,
  PlatformLiquidatesCollateralParams,
  PlatformLiquidatesCollateralResult,
  PlatformListsAvailableLoanOffersParams,
  PlatformListsAvailableLoanOffersResult,
  PlatformMatchesLoanOffersParams,
  PlatformMatchesLoanOffersResult,
  PlatformMonitorsLtvRatiosParams,
  PlatformMonitorsLtvRatiosResult,
  PlatformOriginatesLoanParams,
  PlatformOriginatesLoanResult,
  PlatformPublishesLoanApplicationParams,
  PlatformPublishesLoanApplicationResult,
  PlatformPublishesLoanOfferParams,
  PlatformPublishesLoanOfferResult,
  PlatformUpdatesLoanValuationsParams,
  PlatformUpdatesLoanValuationsResult,
} from './loan.types';
import { LoanUserRepository } from './loan-user.repository';

export abstract class LoanPlatformRepository extends LoanUserRepository {
  async platformPublishesLoanOffer(
    params: PlatformPublishesLoanOfferParams,
  ): Promise<PlatformPublishesLoanOfferResult> {
    const { loanOfferId, publishedDate } = params;

    const tx = await this.beginTransaction();
    try {
      // Validate that the loan offer exists and is in 'Funding' status
      const loanOfferRows = await tx.sql`
        SELECT id, status FROM loan_offers WHERE id = ${loanOfferId}
      `;

      if (loanOfferRows.length === 0) {
        throw new Error('Loan offer not found');
      }

      const loanOffer = loanOfferRows[0];
      assertDefined(loanOffer, 'Loan offer validation failed');
      assertPropStringOrNumber(loanOffer, 'id');
      assertPropString(loanOffer, 'status');

      if (loanOffer.status !== 'Funding') {
        throw new Error(`Cannot publish loan offer from status: ${loanOffer.status}`);
      }

      // Update the loan offer to 'Published' status
      const updateRows = await tx.sql`
        UPDATE loan_offers
        SET status = 'Published', published_date = ${publishedDate.toISOString()}
        WHERE id = ${loanOfferId}
        RETURNING id, status, published_date
      `;

      if (updateRows.length === 0) {
        throw new Error('Failed to publish loan offer');
      }

      const updatedOffer = updateRows[0];
      assertDefined(updatedOffer, 'Updated loan offer validation failed');
      assertPropStringOrNumber(updatedOffer, 'id');
      assertPropString(updatedOffer, 'status');
      assertPropDate(updatedOffer, 'published_date');

      await tx.commitTransaction();

      return {
        id: String(updatedOffer.id),
        status: updatedOffer.status as 'Funding' | 'Published' | 'Closed' | 'Expired',
        publishedDate: updatedOffer.published_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformPublishesLoanApplication(
    params: PlatformPublishesLoanApplicationParams,
  ): Promise<PlatformPublishesLoanApplicationResult> {
    const { loanApplicationId, publishedDate } = params;

    const tx = await this.beginTransaction();
    try {
      // Validate that the loan application exists and is in 'PendingCollateral' status
      const applicationRows = await tx.sql`
        SELECT id, status FROM loan_applications WHERE id = ${loanApplicationId}
      `;

      if (applicationRows.length === 0) {
        throw new Error('Loan application not found');
      }

      const application = applicationRows[0];
      assertDefined(application, 'Loan application validation failed');
      assertPropStringOrNumber(application, 'id');
      assertPropString(application, 'status');

      if (application.status !== 'PendingCollateral') {
        throw new Error(`Cannot publish loan application from status: ${application.status}`);
      }

      // Update the loan application to 'Published' status
      const updateRows = await tx.sql`
        UPDATE loan_applications
        SET status = 'Published', published_date = ${publishedDate.toISOString()}
        WHERE id = ${loanApplicationId}
        RETURNING id, status, published_date
      `;

      if (updateRows.length === 0) {
        throw new Error('Failed to publish loan application');
      }

      const updatedApplication = updateRows[0];
      assertDefined(updatedApplication, 'Updated loan application validation failed');
      assertPropStringOrNumber(updatedApplication, 'id');
      assertPropString(updatedApplication, 'status');
      assertPropDate(updatedApplication, 'published_date');

      await tx.commitTransaction();

      return {
        id: String(updatedApplication.id),
        status: updatedApplication.status as
          | 'PendingCollateral'
          | 'Published'
          | 'Matched'
          | 'Closed'
          | 'Expired',
        publishedDate: updatedApplication.published_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformListsAvailableLoanOffers(
    params: PlatformListsAvailableLoanOffersParams,
  ): Promise<PlatformListsAvailableLoanOffersResult> {
    const {
      collateralBlockchainKey,
      collateralTokenId,
      principalBlockchainKey,
      principalTokenId,
      page = 1,
      limit = 20,
    } = params;

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Build dynamic WHERE conditions
    const whereConditions: string[] = [
      "lo.status = 'Published'",
      'lo.available_principal_amount > 0',
    ];
    const queryParams: unknown[] = [];

    if (principalBlockchainKey && principalTokenId) {
      whereConditions.push(`lo.principal_currency_blockchain_key = $${queryParams.length + 1}`);
      queryParams.push(principalBlockchainKey);
      whereConditions.push(`lo.principal_currency_token_id = $${queryParams.length + 1}`);
      queryParams.push(principalTokenId);
    }

    // Get total count
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM loan_offers lo
      JOIN currencies c ON lo.principal_currency_blockchain_key = c.blockchain_key 
        AND lo.principal_currency_token_id = c.token_id
      WHERE lo.status = 'Published'
        AND lo.available_principal_amount > 0
        AND (${principalBlockchainKey}::text IS NULL OR lo.principal_currency_blockchain_key = ${principalBlockchainKey})
        AND (${principalTokenId}::text IS NULL OR lo.principal_currency_token_id = ${principalTokenId})
    `;

    const countRow = countRows[0];
    assertDefined(countRow, 'Count query failed');
    assertPropStringOrNumber(countRow, 'total');
    const totalCount = Number(countRow.total);

    // Get loan offers with currency details
    const offerRows = await this.sql`
      SELECT 
        lo.id,
        lo.lender_user_id,
        lo.available_principal_amount,
        lo.min_loan_principal_amount,
        lo.max_loan_principal_amount,
        lo.interest_rate,
        lo.term_in_months_options,
        lo.expired_date,
        lo.published_date,
        c.blockchain_key,
        c.token_id,
        c.decimals,
        c.symbol,
        c.name
      FROM loan_offers lo
      JOIN currencies c ON lo.principal_currency_blockchain_key = c.blockchain_key 
        AND lo.principal_currency_token_id = c.token_id
      WHERE lo.status = 'Published'
        AND lo.available_principal_amount > 0
        AND (${principalBlockchainKey}::text IS NULL OR lo.principal_currency_blockchain_key = ${principalBlockchainKey})
        AND (${principalTokenId}::text IS NULL OR lo.principal_currency_token_id = ${principalTokenId})
      ORDER BY lo.interest_rate ASC, lo.published_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const loanOffers = offerRows.map(function (row: unknown) {
      assertDefined(row, 'Loan offer row is undefined');
      assertPropStringOrNumber(row, 'id');
      assertPropStringOrNumber(row, 'lender_user_id');
      assertPropStringOrNumber(row, 'available_principal_amount');
      assertPropStringOrNumber(row, 'min_loan_principal_amount');
      assertPropStringOrNumber(row, 'max_loan_principal_amount');
      assertPropStringOrNumber(row, 'interest_rate');
      assertPropDate(row, 'expired_date');
      assertPropDate(row, 'published_date');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'token_id');
      assertPropStringOrNumber(row, 'decimals');
      assertPropString(row, 'symbol');
      assertPropString(row, 'name');

      return {
        id: String(row.id),
        lenderUserId: String(row.lender_user_id),
        principalCurrency: {
          blockchainKey: row.blockchain_key,
          tokenId: row.token_id,
          decimals: Number(row.decimals),
          symbol: row.symbol,
          name: row.name,
        },
        availablePrincipalAmount: String(row.available_principal_amount),
        minLoanPrincipalAmount: String(row.min_loan_principal_amount),
        maxLoanPrincipalAmount: String(row.max_loan_principal_amount),
        interestRate: Number(row.interest_rate),
        termInMonthsOptions: hasPropArray(row, 'term_in_months_options')
          ? row.term_in_months_options.map(Number)
          : [],
        expirationDate: row.expired_date,
        publishedDate: row.published_date,
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

  async platformMatchesLoanOffers(
    params: PlatformMatchesLoanOffersParams,
  ): Promise<PlatformMatchesLoanOffersResult> {
    const {
      loanApplicationId,
      loanOfferId,
      matchedDate,
      matchedLtvRatio,
      matchedCollateralValuationAmount,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Validate loan application exists and is in 'Published' status
      const applicationRows = await tx.sql`
        SELECT id, status, principal_amount, borrower_user_id
        FROM loan_applications
        WHERE id = ${loanApplicationId} AND status = 'Published'
      `;

      if (applicationRows.length === 0) {
        throw new Error('Loan application not found or not in Published status');
      }

      const application = applicationRows[0];
      assertDefined(application, 'Application validation failed');
      assertPropStringOrNumber(application, 'id');
      assertPropString(application, 'status');
      assertPropStringOrNumber(application, 'principal_amount');
      assertPropStringOrNumber(application, 'borrower_user_id');

      // Validate loan offer exists, is published, and has available principal
      const offerRows = await tx.sql`
        SELECT id, status, available_principal_amount, lender_user_id
        FROM loan_offers
        WHERE id = ${loanOfferId} AND status = 'Published' AND available_principal_amount >= ${application.principal_amount}
      `;

      if (offerRows.length === 0) {
        throw new Error('Loan offer not found, not published, or insufficient available principal');
      }

      const offer = offerRows[0];
      assertDefined(offer, 'Offer validation failed');
      assertPropStringOrNumber(offer, 'id');
      assertPropString(offer, 'status');
      assertPropStringOrNumber(offer, 'available_principal_amount');
      assertPropStringOrNumber(offer, 'lender_user_id');

      // Ensure borrower and lender are different users
      if (application.borrower_user_id === offer.lender_user_id) {
        throw new Error('Borrower and lender cannot be the same user');
      }

      // Update loan application to 'Matched' status
      await tx.sql`
        UPDATE loan_applications
        SET 
          status = 'Matched',
          matched_date = ${matchedDate.toISOString()},
          matched_loan_offer_id = ${loanOfferId},
          matched_ltv_ratio = ${matchedLtvRatio},
          matched_collateral_valuation_amount = ${matchedCollateralValuationAmount}
        WHERE id = ${loanApplicationId}
      `;

      // Reserve principal amount in loan offer
      await tx.sql`
        UPDATE loan_offers
        SET reserved_principal_amount = reserved_principal_amount + ${application.principal_amount}
        WHERE id = ${loanOfferId}
      `;

      await tx.commitTransaction();

      return {
        loanApplicationId: String(loanApplicationId),
        loanOfferId: String(loanOfferId),
        matchedDate,
        matchedLtvRatio,
        matchedCollateralValuationAmount,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformOriginatesLoan(
    params: PlatformOriginatesLoanParams,
  ): Promise<PlatformOriginatesLoanResult> {
    const {
      loanOfferId,
      loanApplicationId,
      principalAmount,
      interestAmount,
      repaymentAmount,
      redeliveryFeeAmount,
      redeliveryAmount,
      premiAmount,
      liquidationFeeAmount,
      minCollateralValuation,
      mcLtvRatio,
      collateralAmount,
      legalDocumentPath,
      legalDocumentHash,
      originationDate,
      maturityDate,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Get loan application and offer details for validation and currency info
      const detailRows = await tx.sql`
        SELECT 
          la.id as app_id,
          la.status as app_status,
          la.principal_currency_blockchain_key,
          la.principal_currency_token_id,
          la.collateral_currency_blockchain_key,
          la.collateral_currency_token_id,
          lo.id as offer_id,
          lo.status as offer_status,
          pc.decimals as principal_decimals,
          pc.symbol as principal_symbol,
          pc.name as principal_name,
          cc.decimals as collateral_decimals,
          cc.symbol as collateral_symbol,
          cc.name as collateral_name
        FROM loan_applications la
        JOIN loan_offers lo ON la.matched_loan_offer_id = lo.id
        JOIN currencies pc ON la.principal_currency_blockchain_key = pc.blockchain_key
          AND la.principal_currency_token_id = pc.token_id
        JOIN currencies cc ON la.collateral_currency_blockchain_key = cc.blockchain_key
          AND la.collateral_currency_token_id = cc.token_id
        WHERE la.id = ${loanApplicationId}
          AND lo.id = ${loanOfferId}
          AND la.status = 'Matched'
          AND lo.status = 'Published'
      `;

      if (detailRows.length === 0) {
        throw new Error(
          'Loan application and offer not found or not in correct status for origination',
        );
      }

      const details = detailRows[0];
      assertDefined(details, 'Loan details validation failed');
      assertPropStringOrNumber(details, 'app_id');
      assertPropString(details, 'app_status');
      assertPropString(details, 'principal_currency_blockchain_key');
      assertPropString(details, 'principal_currency_token_id');
      assertPropString(details, 'collateral_currency_blockchain_key');
      assertPropString(details, 'collateral_currency_token_id');
      assertPropStringOrNumber(details, 'offer_id');
      assertPropString(details, 'offer_status');
      assertPropStringOrNumber(details, 'principal_decimals');
      assertPropString(details, 'principal_symbol');
      assertPropString(details, 'principal_name');
      assertPropStringOrNumber(details, 'collateral_decimals');
      assertPropString(details, 'collateral_symbol');
      assertPropString(details, 'collateral_name');

      // Create the loan record
      const loanRows = await tx.sql`
        INSERT INTO loans (
          loan_offer_id,
          loan_application_id,
          principal_currency_blockchain_key,
          principal_currency_token_id,
          principal_amount,
          interest_amount,
          repayment_amount,
          redelivery_fee_amount,
          redelivery_amount,
          premi_amount,
          liquidation_fee_amount,
          min_collateral_valuation,
          mc_ltv_ratio,
          collateral_currency_blockchain_key,
          collateral_currency_token_id,
          collateral_amount,
          legal_document_path,
          legal_document_hash,
          legal_document_created_date,
          status,
          origination_date,
          maturity_date
        )
        VALUES (
          ${loanOfferId},
          ${loanApplicationId},
          ${details.principal_currency_blockchain_key},
          ${details.principal_currency_token_id},
          ${principalAmount},
          ${interestAmount},
          ${repaymentAmount},
          ${redeliveryFeeAmount},
          ${redeliveryAmount},
          ${premiAmount},
          ${liquidationFeeAmount},
          ${minCollateralValuation},
          ${mcLtvRatio},
          ${details.collateral_currency_blockchain_key},
          ${details.collateral_currency_token_id},
          ${collateralAmount},
          ${legalDocumentPath || null},
          ${legalDocumentHash || null},
          ${legalDocumentPath ? originationDate.toISOString() : null},
          'Originated',
          ${originationDate.toISOString()},
          ${maturityDate.toISOString()}
        )
        RETURNING 
          id,
          loan_offer_id,
          loan_application_id,
          principal_amount,
          interest_amount,
          repayment_amount,
          collateral_amount,
          status,
          origination_date,
          maturity_date,
          mc_ltv_ratio,
          legal_document_path
      `;

      const loan = loanRows[0];
      assertDefined(loan, 'Loan creation failed');
      assertPropStringOrNumber(loan, 'id');
      assertPropStringOrNumber(loan, 'loan_offer_id');
      assertPropStringOrNumber(loan, 'loan_application_id');
      assertPropStringOrNumber(loan, 'principal_amount');
      assertPropStringOrNumber(loan, 'interest_amount');
      assertPropStringOrNumber(loan, 'repayment_amount');
      assertPropStringOrNumber(loan, 'collateral_amount');
      assertPropString(loan, 'status');
      assertPropDate(loan, 'origination_date');
      assertPropDate(loan, 'maturity_date');
      assertPropStringOrNumber(loan, 'mc_ltv_ratio');
      assertPropNullableString(loan, 'legal_document_path');

      // Update loan offer reserved and disbursed amounts
      await tx.sql`
        UPDATE loan_offers
        SET 
          reserved_principal_amount = reserved_principal_amount - ${principalAmount},
          disbursed_principal_amount = disbursed_principal_amount + ${principalAmount}
        WHERE id = ${loanOfferId}
      `;

      await tx.commitTransaction();

      return {
        id: String(loan.id),
        loanOfferId: String(loan.loan_offer_id),
        loanApplicationId: String(loan.loan_application_id),
        principalCurrency: {
          blockchainKey: details.principal_currency_blockchain_key,
          tokenId: details.principal_currency_token_id,
          decimals: Number(details.principal_decimals),
          symbol: details.principal_symbol,
          name: details.principal_name,
        },
        principalAmount: String(loan.principal_amount),
        interestAmount: String(loan.interest_amount),
        repaymentAmount: String(loan.repayment_amount),
        collateralCurrency: {
          blockchainKey: details.collateral_currency_blockchain_key,
          tokenId: details.collateral_currency_token_id,
          decimals: Number(details.collateral_decimals),
          symbol: details.collateral_symbol,
          name: details.collateral_name,
        },
        collateralAmount: String(loan.collateral_amount),
        status: loan.status as 'Originated' | 'Active' | 'Liquidated' | 'Repaid' | 'Defaulted',
        originationDate: loan.origination_date,
        maturityDate: loan.maturity_date,
        mcLtvRatio: Number(loan.mc_ltv_ratio),
        legalDocumentPath: loan.legal_document_path || undefined,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformDisbursesPrincipal(
    params: PlatformDisbursesPrincipalParams,
  ): Promise<PlatformDisbursesPrincipalResult> {
    const { loanId, disbursementDate } = params;

    const tx = await this.beginTransaction();
    try {
      // Validate loan exists and is in 'Originated' status
      const loanRows = await tx.sql`
        SELECT id, status FROM loans WHERE id = ${loanId}
      `;

      if (loanRows.length === 0) {
        throw new Error('Loan not found');
      }

      const loan = loanRows[0];
      assertDefined(loan, 'Loan validation failed');
      assertPropStringOrNumber(loan, 'id');
      assertPropString(loan, 'status');

      if (loan.status !== 'Originated') {
        throw new Error(`Cannot disburse principal for loan with status: ${loan.status}`);
      }

      // Update loan to 'Active' status with disbursement date
      const updateRows = await tx.sql`
        UPDATE loans
        SET 
          status = 'Active',
          disbursement_date = ${disbursementDate.toISOString()}
        WHERE id = ${loanId}
        RETURNING id, status, disbursement_date
      `;

      if (updateRows.length === 0) {
        throw new Error('Failed to update loan disbursement');
      }

      const updatedLoan = updateRows[0];
      assertDefined(updatedLoan, 'Updated loan validation failed');
      assertPropStringOrNumber(updatedLoan, 'id');
      assertPropString(updatedLoan, 'status');
      assertPropDate(updatedLoan, 'disbursement_date');

      await tx.commitTransaction();

      return {
        id: String(updatedLoan.id),
        status: updatedLoan.status as
          | 'Originated'
          | 'Active'
          | 'Liquidated'
          | 'Repaid'
          | 'Defaulted',
        disbursementDate: updatedLoan.disbursement_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformUpdatesLoanValuations(
    params: PlatformUpdatesLoanValuationsParams,
  ): Promise<PlatformUpdatesLoanValuationsResult> {
    const { loanId, exchangeRateId, valuationDate, ltvRatio, collateralValuationAmount } = params;

    const tx = await this.beginTransaction();
    try {
      // Validate loan exists
      const loanRows = await tx.sql`
        SELECT id FROM loans WHERE id = ${loanId}
      `;

      if (loanRows.length === 0) {
        throw new Error('Loan not found');
      }

      // Validate exchange rate exists
      const exchangeRateRows = await tx.sql`
        SELECT id FROM exchange_rates WHERE id = ${exchangeRateId}
      `;

      if (exchangeRateRows.length === 0) {
        throw new Error('Exchange rate not found');
      }

      // Insert or update loan valuation
      await tx.sql`
        INSERT INTO loan_valuations (
          loan_id,
          exchange_rate_id,
          valuation_date,
          ltv_ratio,
          collateral_valuation_amount
        )
        VALUES (
          ${loanId},
          ${exchangeRateId},
          ${valuationDate.toISOString()},
          ${ltvRatio},
          ${collateralValuationAmount}
        )
        ON CONFLICT (loan_id, exchange_rate_id) DO UPDATE SET
          valuation_date = ${valuationDate.toISOString()},
          ltv_ratio = ${ltvRatio},
          collateral_valuation_amount = ${collateralValuationAmount}
      `;

      // Update current LTV ratio in loans table
      await tx.sql`
        UPDATE loans
        SET current_ltv_ratio = ${ltvRatio}
        WHERE id = ${loanId}
      `;

      await tx.commitTransaction();

      return {
        loanId: String(loanId),
        exchangeRateId: String(exchangeRateId),
        valuationDate,
        ltvRatio,
        collateralValuationAmount,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async platformMonitorsLtvRatios(
    params: PlatformMonitorsLtvRatiosParams,
  ): Promise<PlatformMonitorsLtvRatiosResult> {
    const { monitoringDate, ltvThreshold } = params;

    // Get platform config for default LTV threshold if not provided
    const configRows = await this.sql`
      SELECT loan_max_ltv_ratio
      FROM platform_configs
      WHERE effective_date <= ${monitoringDate.toISOString()}
      ORDER BY effective_date DESC
      LIMIT 1
    `;

    let threshold = ltvThreshold;
    if (!threshold && configRows.length > 0) {
      const config = configRows[0];
      assertDefined(config, 'Platform config validation failed');
      assertPropStringOrNumber(config, 'loan_max_ltv_ratio');
      threshold = Number(config.loan_max_ltv_ratio) / 100; // Convert percentage to decimal
    }

    if (!threshold) {
      throw new Error('LTV threshold not provided and no platform config found');
    }

    // Get loans with current LTV ratios exceeding the threshold
    const breachedLoanRows = await this.sql`
      SELECT 
        l.id,
        la.borrower_user_id,
        l.current_ltv_ratio,
        l.mc_ltv_ratio
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      WHERE l.status IN ('Active', 'Originated')
        AND l.current_ltv_ratio IS NOT NULL
        AND l.current_ltv_ratio > ${threshold}
      ORDER BY l.current_ltv_ratio DESC
    `;

    const breachedLoans = breachedLoanRows.map(function (row: unknown) {
      assertDefined(row, 'Breached loan row is undefined');
      assertPropStringOrNumber(row, 'id');
      assertPropStringOrNumber(row, 'borrower_user_id');
      assertPropStringOrNumber(row, 'current_ltv_ratio');
      assertPropStringOrNumber(row, 'mc_ltv_ratio');

      return {
        loanId: String(row.id),
        borrowerUserId: String(row.borrower_user_id),
        currentLtvRatio: Number(row.current_ltv_ratio),
        mcLtvRatio: Number(row.mc_ltv_ratio),
        breachDate: monitoringDate,
      };
    });

    // Get total processed loans count
    const totalLoanRows = await this.sql`
      SELECT COUNT(*) as total
      FROM loans l
      WHERE l.status IN ('Active', 'Originated')
    `;

    const totalRow = totalLoanRows[0];
    assertDefined(totalRow, 'Total loans count validation failed');
    assertPropStringOrNumber(totalRow, 'total');
    const processedLoans = Number(totalRow.total);

    return {
      processedLoans,
      breachedLoans,
    };
  }

  async platformLiquidatesCollateral(
    params: PlatformLiquidatesCollateralParams,
  ): Promise<PlatformLiquidatesCollateralResult> {
    const {
      loanId,
      liquidationTargetAmount,
      marketProvider,
      marketSymbol,
      orderRef,
      orderQuantity,
      orderPrice,
      orderDate,
      liquidationInitiator,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // Validate loan exists and is in Active status
      const loanRows = await tx.sql`
        SELECT id, status FROM loans WHERE id = ${loanId}
      `;

      if (loanRows.length === 0) {
        throw new Error('Loan not found');
      }

      const loan = loanRows[0];
      assertDefined(loan, 'Loan validation failed');
      assertPropStringOrNumber(loan, 'id');
      assertPropString(loan, 'status');

      if (!['Active', 'Originated'].includes(loan.status)) {
        throw new Error(`Cannot liquidate collateral for loan with status: ${loan.status}`);
      }

      // Check if liquidation already exists
      const existingLiquidationRows = await tx.sql`
        SELECT loan_id FROM loan_liquidations WHERE loan_id = ${loanId}
      `;

      if (existingLiquidationRows.length > 0) {
        throw new Error('Liquidation already exists for this loan');
      }

      // Create liquidation record
      await tx.sql`
        INSERT INTO loan_liquidations (
          loan_id,
          liquidation_initiator,
          liquidation_target_amount,
          market_provider,
          market_symbol,
          order_ref,
          order_quantity,
          order_price,
          status,
          order_date
        )
        VALUES (
          ${loanId},
          ${liquidationInitiator},
          ${liquidationTargetAmount},
          ${marketProvider},
          ${marketSymbol},
          ${orderRef},
          ${orderQuantity},
          ${orderPrice},
          'Pending',
          ${orderDate.toISOString()}
        )
      `;

      await tx.commitTransaction();

      return {
        loanId: String(loanId),
        liquidationStatus: 'Pending',
        orderRef,
        orderDate,
        liquidationTargetAmount,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }
}
