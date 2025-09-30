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
  UserViewsLoanDetailsParams,
  UserViewsLoanDetailsResult,
  UserViewsLoansParams,
  UserViewsLoansResult,
  UserViewsLoanValuationHistoryParams,
  UserViewsLoanValuationHistoryResult,
} from './loan.types';
import { LoanBorrowerRepository } from './loan-borrower.repository';

/**
 * LoanUserRepository <- LoanBorrowerRepository <- LoanLenderRepository <- LoanTestRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
export abstract class LoanUserRepository extends LoanBorrowerRepository {
  async userViewsLoanDetails(
    params: UserViewsLoanDetailsParams,
  ): Promise<UserViewsLoanDetailsResult> {
    const { loanId, userId } = params;

    const loanRows = await this.sql`
      SELECT 
        l.id,
        l.loan_offer_id,
        l.loan_application_id,
        l.principal_currency_blockchain_key,
        l.principal_currency_token_id,
        l.principal_amount,
        l.interest_amount,
        l.repayment_amount,
        l.redelivery_fee_amount,
        l.redelivery_amount,
        l.premi_amount,
        l.liquidation_fee_amount,
        l.min_collateral_valuation,
        l.collateral_currency_blockchain_key,
        l.collateral_currency_token_id,
        l.collateral_amount,
        l.status,
        l.origination_date,
        l.disbursement_date,
        l.maturity_date,
        l.concluded_date,
        l.conclusion_reason,
        l.current_ltv_ratio,
        l.mc_ltv_ratio,
        l.mc_ltv_ratio_date,
        l.legal_document_path,
        l.legal_document_hash,
        l.legal_document_created_date,
        la.borrower_user_id,
        lo.lender_user_id,
        pc.decimals as principal_decimals,
        pc.symbol as principal_symbol,
        pc.name as principal_name,
        cc.decimals as collateral_decimals,
        cc.symbol as collateral_symbol,
        cc.name as collateral_name
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      JOIN loan_offers lo ON l.loan_offer_id = lo.id
      JOIN currencies pc ON l.principal_currency_blockchain_key = pc.blockchain_key
        AND l.principal_currency_token_id = pc.token_id
      JOIN currencies cc ON l.collateral_currency_blockchain_key = cc.blockchain_key
        AND l.collateral_currency_token_id = cc.token_id
      WHERE l.id = ${loanId}
        AND (la.borrower_user_id = ${userId} OR lo.lender_user_id = ${userId})
    `;

    if (loanRows.length === 0) {
      throw new Error('Loan not found or access denied');
    }

    const loan = loanRows[0];
    assertDefined(loan, 'Loan validation failed');
    assertProp(check(isString, isNumber), loan, 'id');
    assertProp(check(isString, isNumber), loan, 'loan_offer_id');
    assertProp(check(isString, isNumber), loan, 'loan_application_id');
    assertPropString(loan, 'principal_currency_blockchain_key');
    assertPropString(loan, 'principal_currency_token_id');
    assertProp(check(isString, isNumber), loan, 'principal_amount');
    assertProp(check(isString, isNumber), loan, 'interest_amount');
    assertProp(check(isString, isNumber), loan, 'repayment_amount');
    assertProp(check(isString, isNumber), loan, 'redelivery_fee_amount');
    assertProp(check(isString, isNumber), loan, 'redelivery_amount');
    assertProp(check(isString, isNumber), loan, 'premi_amount');
    assertProp(check(isString, isNumber), loan, 'liquidation_fee_amount');
    assertProp(check(isString, isNumber), loan, 'min_collateral_valuation');
    assertPropString(loan, 'collateral_currency_blockchain_key');
    assertPropString(loan, 'collateral_currency_token_id');
    assertProp(check(isString, isNumber), loan, 'collateral_amount');
    assertPropString(loan, 'status');
    assertProp(isInstanceOf(Date), loan, 'origination_date');
    assertProp(check(isNullable, isInstanceOf(Date)), loan, 'disbursement_date');
    assertProp(isInstanceOf(Date), loan, 'maturity_date');
    assertProp(check(isNullable, isInstanceOf(Date)), loan, 'concluded_date');
    assertPropNullableString(loan, 'conclusion_reason');
    assertPropNullableString(loan, 'current_ltv_ratio');
    assertProp(check(isString, isNumber), loan, 'mc_ltv_ratio');
    assertProp(check(isNullable, isInstanceOf(Date)), loan, 'mc_ltv_ratio_date');
    assertPropNullableString(loan, 'legal_document_path');
    assertPropNullableString(loan, 'legal_document_hash');
    assertProp(check(isNullable, isInstanceOf(Date)), loan, 'legal_document_created_date');
    assertProp(check(isString, isNumber), loan, 'borrower_user_id');
    assertProp(check(isString, isNumber), loan, 'lender_user_id');
    assertProp(check(isString, isNumber), loan, 'principal_decimals');
    assertPropString(loan, 'principal_symbol');
    assertPropString(loan, 'principal_name');
    assertProp(check(isString, isNumber), loan, 'collateral_decimals');
    assertPropString(loan, 'collateral_symbol');
    assertPropString(loan, 'collateral_name');

    return {
      id: String(loan.id),
      loanOfferId: String(loan.loan_offer_id),
      loanApplicationId: String(loan.loan_application_id),
      borrowerUserId: String(loan.borrower_user_id),
      lenderUserId: String(loan.lender_user_id),
      principalCurrency: {
        blockchainKey: loan.principal_currency_blockchain_key,
        tokenId: loan.principal_currency_token_id,
        decimals: Number(loan.principal_decimals),
        symbol: loan.principal_symbol,
        name: loan.principal_name,
      },
      principalAmount: String(loan.principal_amount),
      interestAmount: String(loan.interest_amount),
      repaymentAmount: String(loan.repayment_amount),
      redeliveryFeeAmount: String(loan.redelivery_fee_amount),
      redeliveryAmount: String(loan.redelivery_amount),
      premiAmount: String(loan.premi_amount),
      liquidationFeeAmount: String(loan.liquidation_fee_amount),
      minCollateralValuation: String(loan.min_collateral_valuation),
      collateralCurrency: {
        blockchainKey: loan.collateral_currency_blockchain_key,
        tokenId: loan.collateral_currency_token_id,
        decimals: Number(loan.collateral_decimals),
        symbol: loan.collateral_symbol,
        name: loan.collateral_name,
      },
      collateralAmount: String(loan.collateral_amount),
      status: loan.status as 'Originated' | 'Active' | 'Liquidated' | 'Repaid' | 'Defaulted',
      originationDate: loan.origination_date,
      disbursementDate: loan.disbursement_date || undefined,
      maturityDate: loan.maturity_date,
      concludedDate: loan.concluded_date || undefined,
      conclusionReason: loan.conclusion_reason || undefined,
      currentLtvRatio: loan.current_ltv_ratio ? Number(loan.current_ltv_ratio) : undefined,
      mcLtvRatio: Number(loan.mc_ltv_ratio),
      mcLtvRatioDate: loan.mc_ltv_ratio_date || undefined,
      legalDocumentPath: loan.legal_document_path || undefined,
      legalDocumentHash: loan.legal_document_hash || undefined,
      legalDocumentCreatedDate: loan.legal_document_created_date || undefined,
    };
  }

  async userViewsLoans(params: UserViewsLoansParams): Promise<UserViewsLoansResult> {
    const { userId, role, page = 1, limit = 20, status } = params;

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      JOIN loan_offers lo ON l.loan_offer_id = lo.id
      WHERE (la.borrower_user_id = ${userId} OR lo.lender_user_id = ${userId})
        AND (${role}::text IS NULL 
             OR (${role} = 'borrower' AND la.borrower_user_id = ${userId})
             OR (${role} = 'lender' AND lo.lender_user_id = ${userId}))
        AND (${status}::text IS NULL OR l.status = ${status})
    `;

    const countRow = countRows[0];
    assertDefined(countRow, 'Count query failed');
    assertProp(check(isString, isNumber), countRow, 'total');
    const totalCount = Number(countRow.total);

    // Get loans with details
    const loanRows = await this.sql`
      SELECT 
        l.id,
        l.loan_offer_id,
        l.loan_application_id,
        l.principal_currency_blockchain_key,
        l.principal_currency_token_id,
        l.principal_amount,
        l.interest_amount,
        l.repayment_amount,
        l.collateral_currency_blockchain_key,
        l.collateral_currency_token_id,
        l.collateral_amount,
        l.status,
        l.origination_date,
        l.disbursement_date,
        l.maturity_date,
        l.concluded_date,
        l.current_ltv_ratio,
        l.mc_ltv_ratio,
        la.borrower_user_id,
        lo.lender_user_id,
        lo.interest_rate,
        la.term_in_months,
        pc.decimals as principal_decimals,
        pc.symbol as principal_symbol,
        pc.name as principal_name,
        cc.decimals as collateral_decimals,
        cc.symbol as collateral_symbol,
        cc.name as collateral_name
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      JOIN loan_offers lo ON l.loan_offer_id = lo.id
      JOIN currencies pc ON l.principal_currency_blockchain_key = pc.blockchain_key
        AND l.principal_currency_token_id = pc.token_id
      JOIN currencies cc ON l.collateral_currency_blockchain_key = cc.blockchain_key
        AND l.collateral_currency_token_id = cc.token_id
      WHERE (la.borrower_user_id = ${userId} OR lo.lender_user_id = ${userId})
        AND (${role}::text IS NULL 
             OR (${role} = 'borrower' AND la.borrower_user_id = ${userId})
             OR (${role} = 'lender' AND lo.lender_user_id = ${userId}))
        AND (${status}::text IS NULL OR l.status = ${status})
      ORDER BY l.origination_date DESC
      LIMIT ${validatedLimit}
      OFFSET ${offset}
    `;

    const loans = loanRows.map(function (row: unknown) {
      assertDefined(row, 'Loan row is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'loan_offer_id');
      assertProp(check(isString, isNumber), row, 'loan_application_id');
      assertPropString(row, 'principal_currency_blockchain_key');
      assertPropString(row, 'principal_currency_token_id');
      assertProp(check(isString, isNumber), row, 'principal_amount');
      assertProp(check(isString, isNumber), row, 'interest_amount');
      assertProp(check(isString, isNumber), row, 'repayment_amount');
      assertPropString(row, 'collateral_currency_blockchain_key');
      assertPropString(row, 'collateral_currency_token_id');
      assertProp(check(isString, isNumber), row, 'collateral_amount');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'origination_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'disbursement_date');
      assertProp(isInstanceOf(Date), row, 'maturity_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'concluded_date');
      assertPropNullableString(row, 'current_ltv_ratio');
      assertProp(check(isString, isNumber), row, 'mc_ltv_ratio');
      assertProp(check(isString, isNumber), row, 'borrower_user_id');
      assertProp(check(isString, isNumber), row, 'lender_user_id');
      assertProp(check(isString, isNumber), row, 'interest_rate');
      assertProp(check(isString, isNumber), row, 'term_in_months');
      assertProp(check(isString, isNumber), row, 'principal_decimals');
      assertPropString(row, 'principal_symbol');
      assertPropString(row, 'principal_name');
      assertProp(check(isString, isNumber), row, 'collateral_decimals');
      assertPropString(row, 'collateral_symbol');
      assertPropString(row, 'collateral_name');
      return {
        id: String(row.id),
        loanOfferId: String(row.loan_offer_id),
        loanApplicationId: String(row.loan_application_id),
        borrowerUserId: String(row.borrower_user_id),
        lenderUserId: String(row.lender_user_id),
        principalCurrency: {
          blockchainKey: row.principal_currency_blockchain_key,
          tokenId: row.principal_currency_token_id,
          decimals: Number(row.principal_decimals),
          symbol: row.principal_symbol,
          name: row.principal_name,
        },
        principalAmount: String(row.principal_amount),
        interestAmount: String(row.interest_amount),
        repaymentAmount: String(row.repayment_amount),
        collateralCurrency: {
          blockchainKey: row.collateral_currency_blockchain_key,
          tokenId: row.collateral_currency_token_id,
          decimals: Number(row.collateral_decimals),
          symbol: row.collateral_symbol,
          name: row.collateral_name,
        },
        collateralAmount: String(row.collateral_amount),
        status: row.status as 'Originated' | 'Active' | 'Liquidated' | 'Repaid' | 'Defaulted',
        originationDate: row.origination_date,
        disbursementDate: row.disbursement_date || undefined,
        maturityDate: row.maturity_date,
        concludedDate: row.concluded_date || undefined,
        currentLtvRatio: row.current_ltv_ratio ? Number(row.current_ltv_ratio) : undefined,
        mcLtvRatio: Number(row.mc_ltv_ratio),
        interestRate: Number(row.interest_rate),
        termInMonths: Number(row.term_in_months),
      };
    });

    const totalPages = Math.ceil(totalCount / validatedLimit);

    return {
      loans,
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

  async userViewsLoanValuationHistory(
    params: UserViewsLoanValuationHistoryParams,
  ): Promise<UserViewsLoanValuationHistoryResult> {
    const { loanId, userId, limit = 50, startDate, endDate } = params;

    // First verify user has access to this loan
    const loanAccessRows = await this.sql`
      SELECT l.id
      FROM loans l
      JOIN loan_applications la ON l.loan_application_id = la.id
      JOIN loan_offers lo ON l.loan_offer_id = lo.id
      WHERE l.id = ${loanId}
        AND (la.borrower_user_id = ${userId} OR lo.lender_user_id = ${userId})
    `;

    if (loanAccessRows.length === 0) {
      throw new Error('Loan not found or access denied');
    }

    const validatedLimit = Math.min(Math.max(1, limit), 500);

    // Get loan valuation history with currency details
    const valuationRows = await this.sql`
      SELECT 
        lv.loan_id,
        lv.exchange_rate_id,
        lv.valuation_date,
        lv.ltv_ratio,
        lv.collateral_valuation_amount,
        l.collateral_currency_blockchain_key,
        l.collateral_currency_token_id,
        l.principal_currency_blockchain_key,
        l.principal_currency_token_id,
        cc.decimals as collateral_decimals,
        cc.symbol as collateral_symbol,
        cc.name as collateral_name,
        pc.decimals as principal_decimals,
        pc.symbol as principal_symbol,
        pc.name as principal_name
      FROM loan_valuations lv
      JOIN loans l ON lv.loan_id = l.id
      JOIN currencies cc ON l.collateral_currency_blockchain_key = cc.blockchain_key
        AND l.collateral_currency_token_id = cc.token_id
      JOIN currencies pc ON l.principal_currency_blockchain_key = pc.blockchain_key
        AND l.principal_currency_token_id = pc.token_id
      WHERE lv.loan_id = ${loanId}
        AND (${startDate}::timestamp IS NULL OR lv.valuation_date >= ${startDate?.toISOString()})
        AND (${endDate}::timestamp IS NULL OR lv.valuation_date <= ${endDate?.toISOString()})
      ORDER BY lv.valuation_date DESC
      LIMIT ${validatedLimit}
    `;

    const valuationHistory = valuationRows.map(function (row: unknown, index: number) {
      assertDefined(row, 'Valuation row is undefined');
      assertProp(check(isString, isNumber), row, 'loan_id');
      assertProp(check(isString, isNumber), row, 'exchange_rate_id');
      assertProp(isInstanceOf(Date), row, 'valuation_date');
      assertProp(check(isString, isNumber), row, 'ltv_ratio');
      assertProp(check(isString, isNumber), row, 'collateral_valuation_amount');
      assertPropString(row, 'collateral_currency_blockchain_key');
      assertPropString(row, 'collateral_currency_token_id');
      assertPropString(row, 'principal_currency_blockchain_key');
      assertPropString(row, 'principal_currency_token_id');
      assertProp(check(isString, isNumber), row, 'collateral_decimals');
      assertPropString(row, 'collateral_symbol');
      assertPropString(row, 'collateral_name');
      assertProp(check(isString, isNumber), row, 'principal_decimals');
      assertPropString(row, 'principal_symbol');
      assertPropString(row, 'principal_name');

      // Calculate LTV change from previous valuation
      let ltvChange: number | undefined;
      if (index > 0) {
        const prevRow = valuationRows[index - 1];
        assertDefined(prevRow, 'Previous valuation row is undefined');
        assertProp(check(isString, isNumber), prevRow, 'ltv_ratio');
        const currentLtv = Number(row.ltv_ratio);
        const prevLtv = Number(prevRow.ltv_ratio);
        ltvChange = ((currentLtv - prevLtv) / prevLtv) * 100; // Percentage change
      }

      return {
        loanId: String(row.loan_id),
        exchangeRateId: String(row.exchange_rate_id),
        valuationDate: row.valuation_date,
        ltvRatio: Number(row.ltv_ratio),
        collateralValuationAmount: String(row.collateral_valuation_amount),
        collateralCurrency: {
          blockchainKey: row.collateral_currency_blockchain_key,
          tokenId: row.collateral_currency_token_id,
          decimals: Number(row.collateral_decimals),
          symbol: row.collateral_symbol,
          name: row.collateral_name,
        },
        principalCurrency: {
          blockchainKey: row.principal_currency_blockchain_key,
          tokenId: row.principal_currency_token_id,
          decimals: Number(row.principal_decimals),
          symbol: row.principal_symbol,
          name: row.principal_name,
        },
        ltvChange,
      };
    });

    return {
      success: true,
      data: valuationHistory,
    };
  }
}
