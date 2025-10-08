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
  LoanApplicationStatus,
  PlatformDisbursesPrincipalParams,
  PlatformDisbursesPrincipalResult,
  PlatformLiquidatesCollateralParams,
  PlatformLiquidatesCollateralResult,
  PlatformListsAvailableLoanApplicationsParams,
  PlatformListsAvailableLoanApplicationsResult,
  PlatformListsAvailableLoanOffersParams,
  PlatformListsAvailableLoanOffersResult,
  PlatformListsMatchableLoanApplicationsParams,
  PlatformListsMatchableLoanApplicationsResult,
  PlatformMatchesLoanOffersParams,
  PlatformMatchesLoanOffersResult,
  PlatformMonitorsLtvRatiosParams,
  PlatformMonitorsLtvRatiosResult,
  PlatformOriginatesLoanParams,
  PlatformOriginatesLoanResult,
  PlatformUpdatesLoanValuationsParams,
  PlatformUpdatesLoanValuationsResult,
} from './loan.types';
import { LoanUserRepository } from './loan-user.repository';

/**
 * LoanPlatformRepository <- LoanUserRepository <- LoanBorrowerRepository <- LoanLenderRepository <- LoanTestRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
export abstract class LoanPlatformRepository extends LoanUserRepository {
  async platformListsAvailableLoanOffers(
    params: PlatformListsAvailableLoanOffersParams,
  ): Promise<PlatformListsAvailableLoanOffersResult> {
    const {
      collateralBlockchainKey: _collateralBlockchainKey,
      collateralTokenId: _collateralTokenId,
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
    assertProp(check(isString, isNumber), countRow, 'total');
    const totalCount = Number(countRow.total);

    // Get loan offers with currency details and lender info
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
        c.name,
        u.name AS lender_user_name,
        u.user_type AS lender_user_type
      FROM loan_offers lo
      JOIN currencies c ON lo.principal_currency_blockchain_key = c.blockchain_key
        AND lo.principal_currency_token_id = c.token_id
      LEFT JOIN users u ON lo.lender_user_id = u.id
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
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'lender_user_id');
      assertProp(check(isString, isNumber), row, 'available_principal_amount');
      assertProp(check(isString, isNumber), row, 'min_loan_principal_amount');
      assertProp(check(isString, isNumber), row, 'max_loan_principal_amount');
      assertProp(check(isString, isNumber), row, 'interest_rate');
      assertProp(isInstanceOf(Date), row, 'expired_date');
      assertProp(isInstanceOf(Date), row, 'published_date');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'token_id');
      assertProp(check(isString, isNumber), row, 'decimals');
      assertPropString(row, 'symbol');
      assertPropString(row, 'name');
      assertPropNullableString(row, 'lender_user_name');
      assertPropNullableString(row, 'lender_user_type');

      return {
        id: String(row.id),
        lenderUserId: String(row.lender_user_id),
        lenderUserName: row.lender_user_name || undefined,
        lenderUserType: row.lender_user_type || undefined,
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

  async platformListsAvailableLoanApplications(
    params: PlatformListsAvailableLoanApplicationsParams,
  ): Promise<PlatformListsAvailableLoanApplicationsResult> {
    const {
      collateralBlockchainKey,
      collateralTokenId,
      principalBlockchainKey,
      principalTokenId,
      minPrincipalAmount,
      maxPrincipalAmount,
      liquidationMode,
      page = 1,
      limit = 20,
    } = params;

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Count total published loan applications
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM loan_applications la
      JOIN currencies c1 ON la.principal_currency_blockchain_key = c1.blockchain_key 
        AND la.principal_currency_token_id = c1.token_id
      JOIN currencies c2 ON la.collateral_currency_blockchain_key = c2.blockchain_key 
        AND la.collateral_currency_token_id = c2.token_id
      WHERE la.status = 'Published'
        AND (${collateralBlockchainKey}::text IS NULL OR la.collateral_currency_blockchain_key = ${collateralBlockchainKey})
        AND (${collateralTokenId}::text IS NULL OR la.collateral_currency_token_id = ${collateralTokenId})
        AND (${principalBlockchainKey}::text IS NULL OR la.principal_currency_blockchain_key = ${principalBlockchainKey})
        AND (${principalTokenId}::text IS NULL OR la.principal_currency_token_id = ${principalTokenId})
        AND (${minPrincipalAmount}::numeric IS NULL OR la.principal_amount >= ${minPrincipalAmount})
        AND (${maxPrincipalAmount}::numeric IS NULL OR la.principal_amount <= ${maxPrincipalAmount})
        AND (${liquidationMode}::text IS NULL OR la.liquidation_mode = ${liquidationMode})
    `;

    assertArrayMapOf(countRows, function (row) {
      assertDefined(row);
      assertProp(check(isString, isNumber), row, 'total');
      return row;
    });

    const totalCount = Number(countRows[0].total);

    // Get paginated loan applications
    const applicationRows = await this.sql`
      SELECT 
        la.id,
        la.borrower_user_id,
        u.name as borrower_name,
        u.user_type as borrower_type,
        la.principal_amount,
        la.max_interest_rate,
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
        c2.name as collateral_name
      FROM loan_applications la
      JOIN users u ON la.borrower_user_id = u.id
      JOIN currencies c1 ON la.principal_currency_blockchain_key = c1.blockchain_key 
        AND la.principal_currency_token_id = c1.token_id
      JOIN currencies c2 ON la.collateral_currency_blockchain_key = c2.blockchain_key 
        AND la.collateral_currency_token_id = c2.token_id
      WHERE la.status = 'Published'
        AND (${collateralBlockchainKey}::text IS NULL OR la.collateral_currency_blockchain_key = ${collateralBlockchainKey})
        AND (${collateralTokenId}::text IS NULL OR la.collateral_currency_token_id = ${collateralTokenId})
        AND (${principalBlockchainKey}::text IS NULL OR la.principal_currency_blockchain_key = ${principalBlockchainKey})
        AND (${principalTokenId}::text IS NULL OR la.principal_currency_token_id = ${principalTokenId})
        AND (${minPrincipalAmount}::numeric IS NULL OR la.principal_amount >= ${minPrincipalAmount})
        AND (${maxPrincipalAmount}::numeric IS NULL OR la.principal_amount <= ${maxPrincipalAmount})
        AND (${liquidationMode}::text IS NULL OR la.liquidation_mode = ${liquidationMode})
      ORDER BY la.max_interest_rate DESC, la.applied_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const loanApplications = applicationRows.map(function (row: unknown) {
      assertDefined(row, 'Loan application row is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'borrower_user_id');
      assertPropNullableString(row, 'borrower_name');
      assertPropString(row, 'borrower_type');
      assertProp(check(isString, isNumber), row, 'principal_amount');
      assertProp(check(isString, isNumber), row, 'max_interest_rate');
      assertProp(check(isString, isNumber), row, 'term_in_months');
      assertPropString(row, 'liquidation_mode');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'applied_date');
      assertProp(check(isInstanceOf(Date), isNullable), row, 'published_date');
      assertProp(isInstanceOf(Date), row, 'expired_date');
      assertPropString(row, 'principal_blockchain_key');
      assertPropString(row, 'principal_token_id');
      assertProp(check(isString, isNumber), row, 'principal_decimals');
      assertPropString(row, 'principal_symbol');
      assertPropString(row, 'principal_name');
      assertPropString(row, 'collateral_blockchain_key');
      assertPropString(row, 'collateral_token_id');
      assertProp(check(isString, isNumber), row, 'collateral_decimals');
      assertPropString(row, 'collateral_symbol');
      assertPropString(row, 'collateral_name');

      return {
        id: String(row.id),
        borrowerUserId: String(row.borrower_user_id),
        borrower: {
          id: String(row.borrower_user_id),
          type: row.borrower_type as 'Individual' | 'Institution',
          name: row.borrower_name || 'Borrower User',
        },
        collateralCurrency: {
          blockchainKey: row.collateral_blockchain_key,
          tokenId: row.collateral_token_id,
          decimals: Number(row.collateral_decimals),
          symbol: row.collateral_symbol,
          name: row.collateral_name,
        },
        principalCurrency: {
          blockchainKey: row.principal_blockchain_key,
          tokenId: row.principal_token_id,
          decimals: Number(row.principal_decimals),
          symbol: row.principal_symbol,
          name: row.principal_name,
        },
        principalAmount: String(row.principal_amount),
        maxInterestRate: Number(row.max_interest_rate),
        termInMonths: Number(row.term_in_months),
        liquidationMode: row.liquidation_mode as 'Partial' | 'Full',
        status: row.status as 'Published',
        appliedDate: row.applied_date,
        publishedDate: row.published_date || undefined,
        expirationDate: row.expired_date,
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

  async platformListsMatchableLoanApplications(
    params: PlatformListsMatchableLoanApplicationsParams,
  ): Promise<PlatformListsMatchableLoanApplicationsResult> {
    const { page = 1, limit = 20 } = params;

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    const applicationRows = await this.sql`
      SELECT 
        la.id,
        la.borrower_user_id,
        la.loan_offer_id,
        la.principal_currency_blockchain_key,
        la.principal_currency_token_id,
        la.principal_amount,
        la.max_interest_rate,
        la.term_in_months,
        la.collateral_currency_blockchain_key,
        la.collateral_currency_token_id,
        la.collateral_deposit_amount,
        la.status,
        la.applied_date,
        la.expired_date,
        la.matched_loan_offer_id,
        pc.decimals as principal_decimals,
        pc.symbol as principal_symbol,
        pc.name as principal_name
      FROM loan_applications la
      JOIN currencies pc ON la.principal_currency_blockchain_key = pc.blockchain_key 
        AND la.principal_currency_token_id = pc.token_id
      WHERE la.status = 'Published' 
        AND la.matched_loan_offer_id IS NULL
        AND la.expired_date > NOW()
      ORDER BY la.applied_date ASC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const countResult = await this.sql`
      SELECT COUNT(*) as total
      FROM loan_applications la
      WHERE la.status = 'Published' 
        AND la.matched_loan_offer_id IS NULL
        AND la.expired_date > NOW()
    `;

    const countRow = countResult[0];
    assertDefined(countRow, 'Count result should be defined');
    assertProp(check(isString, isNumber), countRow, 'total');
    const totalCount = Number(countRow.total);
    const totalPages = Math.ceil(totalCount / validatedLimit);

    const loanApplications = applicationRows.map(function (row: unknown) {
      assertDefined(row, 'Row should be defined');
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'borrower_user_id');
      assertPropNullableString(row, 'loan_offer_id');
      assertPropString(row, 'principal_currency_blockchain_key');
      assertPropString(row, 'principal_currency_token_id');
      assertProp(check(isString, isNumber), row, 'principal_amount');
      assertProp(check(isString, isNumber), row, 'max_interest_rate');
      assertProp(check(isString, isNumber), row, 'term_in_months');
      assertPropString(row, 'collateral_currency_blockchain_key');
      assertPropString(row, 'collateral_currency_token_id');
      assertProp(check(isString, isNumber), row, 'collateral_deposit_amount');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'applied_date');
      assertProp(isInstanceOf(Date), row, 'expired_date');
      assertPropNullableString(row, 'matched_loan_offer_id');
      assertProp(check(isString, isNumber), row, 'principal_decimals');
      assertPropString(row, 'principal_symbol');
      assertPropString(row, 'principal_name');

      return {
        id: String(row.id),
        borrowerUserId: String(row.borrower_user_id),
        loanOfferId: row.loan_offer_id || undefined,
        principalCurrency: {
          blockchainKey: row.principal_currency_blockchain_key,
          tokenId: row.principal_currency_token_id,
          decimals: Number(row.principal_decimals),
          symbol: row.principal_symbol,
          name: row.principal_name,
        },
        principalAmount: String(row.principal_amount),
        maxInterestRate: Number(row.max_interest_rate),
        termInMonths: Number(row.term_in_months),
        collateralBlockchainKey: row.collateral_currency_blockchain_key,
        collateralTokenId: row.collateral_currency_token_id,
        collateralDepositAmount: String(row.collateral_deposit_amount),
        principalBlockchainKey: row.principal_currency_blockchain_key,
        principalTokenId: row.principal_currency_token_id,
        status: row.status as LoanApplicationStatus,
        appliedDate: row.applied_date,
        expirationDate: row.expired_date,
        matchedLoanOfferId: row.matched_loan_offer_id || undefined,
      };
    });

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
      assertProp(check(isString, isNumber), application, 'id');
      assertPropString(application, 'status');
      assertProp(check(isString, isNumber), application, 'principal_amount');
      assertProp(check(isString, isNumber), application, 'borrower_user_id');

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
      assertProp(check(isString, isNumber), offer, 'id');
      assertPropString(offer, 'status');
      assertProp(check(isString, isNumber), offer, 'available_principal_amount');
      assertProp(check(isString, isNumber), offer, 'lender_user_id');

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
      assertProp(check(isString, isNumber), details, 'app_id');
      assertPropString(details, 'app_status');
      assertPropString(details, 'principal_currency_blockchain_key');
      assertPropString(details, 'principal_currency_token_id');
      assertPropString(details, 'collateral_currency_blockchain_key');
      assertPropString(details, 'collateral_currency_token_id');
      assertProp(check(isString, isNumber), details, 'offer_id');
      assertPropString(details, 'offer_status');
      assertProp(check(isString, isNumber), details, 'principal_decimals');
      assertPropString(details, 'principal_symbol');
      assertPropString(details, 'principal_name');
      assertProp(check(isString, isNumber), details, 'collateral_decimals');
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
      assertProp(check(isString, isNumber), loan, 'id');
      assertProp(check(isString, isNumber), loan, 'loan_offer_id');
      assertProp(check(isString, isNumber), loan, 'loan_application_id');
      assertProp(check(isString, isNumber), loan, 'principal_amount');
      assertProp(check(isString, isNumber), loan, 'interest_amount');
      assertProp(check(isString, isNumber), loan, 'repayment_amount');
      assertProp(check(isString, isNumber), loan, 'collateral_amount');
      assertPropString(loan, 'status');
      assertProp(isInstanceOf(Date), loan, 'origination_date');
      assertProp(isInstanceOf(Date), loan, 'maturity_date');
      assertProp(check(isString, isNumber), loan, 'mc_ltv_ratio');
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
      assertProp(check(isString, isNumber), loan, 'id');
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
      assertProp(check(isString, isNumber), updatedLoan, 'id');
      assertPropString(updatedLoan, 'status');
      assertProp(isInstanceOf(Date), updatedLoan, 'disbursement_date');

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
      assertProp(check(isString, isNumber), config, 'loan_max_ltv_ratio');
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
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'borrower_user_id');
      assertProp(check(isString, isNumber), row, 'current_ltv_ratio');
      assertProp(check(isString, isNumber), row, 'mc_ltv_ratio');

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
    assertProp(check(isString, isNumber), totalRow, 'total');
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
      assertProp(check(isString, isNumber), loan, 'id');
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
