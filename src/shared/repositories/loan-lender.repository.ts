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
  LenderClosesLoanOfferParams,
  LenderClosesLoanOfferResult,
  LenderCreatesLoanOfferParams,
  LenderCreatesLoanOfferResult,
  LenderViewsMyLoanOffersParams,
  LenderViewsMyLoanOffersResult,
} from './loan.types';
import { LoanTestRepository } from './loan-test.repository';

/**
 * LoanLenderRepository <- LoanTestRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
export abstract class LoanLenderRepository extends LoanTestRepository {
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
      fundingInvoiceId,
      fundingInvoicePrepaidAmount,
      fundingAccountBlockchainKey,
      fundingAccountTokenId,
      fundingInvoiceDate,
      fundingInvoiceDueDate,
      fundingInvoiceExpiredDate,
      fundingWalletDerivationPath,
      fundingWalletAddress,
    } = params;

    const tx = await this.beginTransaction();
    try {
      // First, validate that the currency exists and get user info
      const currencyUserRows = await tx.sql`
        SELECT
          c.blockchain_key, c.token_id, c.decimals, c.symbol, c.name,
          u.user_type, u.name as user_name, u.profile_picture as profile_picture_url,
          ia.business_type, ia.business_description
        FROM currencies c
        CROSS JOIN users u
        LEFT JOIN institution_applications ia ON u.id = ia.applicant_user_id AND ia.status = 'Approved'
        WHERE c.blockchain_key = ${principalBlockchainKey}
          AND c.token_id = ${principalTokenId}
          AND u.id = ${lenderUserId}
      `;

      if (currencyUserRows.length === 0) {
        throw new Error(
          `Currency ${principalBlockchainKey}:${principalTokenId} does not exist or user not found`,
        );
      }

      const currencyUser = currencyUserRows[0];
      assertDefined(currencyUser, 'Currency and user validation failed');
      assertPropString(currencyUser, 'blockchain_key');
      assertPropString(currencyUser, 'token_id');
      assertProp(check(isString, isNumber), currencyUser, 'decimals');
      assertPropString(currencyUser, 'symbol');
      assertPropString(currencyUser, 'name');
      assertPropString(currencyUser, 'user_type');
      assertPropString(currencyUser, 'user_name');

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
      assertProp(check(isString, isNumber), loanOffer, 'id');
      assertProp(check(isString, isNumber), loanOffer, 'lender_user_id');
      assertProp(check(isString, isNumber), loanOffer, 'offered_principal_amount');
      assertProp(check(isString, isNumber), loanOffer, 'available_principal_amount');
      assertProp(check(isString, isNumber), loanOffer, 'min_loan_principal_amount');
      assertProp(check(isString, isNumber), loanOffer, 'max_loan_principal_amount');
      assertProp(check(isString, isNumber), loanOffer, 'interest_rate');
      assertPropString(loanOffer, 'status');
      assertProp(isInstanceOf(Date), loanOffer, 'created_date');
      assertProp(isInstanceOf(Date), loanOffer, 'expired_date');

      // Create funding invoice
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
          loan_offer_id
        )
        VALUES (
          ${fundingInvoiceId},
          ${lenderUserId},
          ${principalBlockchainKey},
          ${principalTokenId},
          ${fundingAccountBlockchainKey ?? null},
          ${fundingAccountTokenId ?? null},
          ${offeredPrincipalAmount},
          ${fundingInvoicePrepaidAmount},
          ${fundingWalletDerivationPath},
          ${fundingWalletAddress},
          'LoanPrincipal',
          'Pending',
          ${fundingInvoiceDate.toISOString()},
          ${fundingInvoiceDate.toISOString()},
          ${fundingInvoiceDueDate.toISOString()},
          ${fundingInvoiceExpiredDate.toISOString()},
          ${loanOffer.id}
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

      const invoice = invoiceRows[0];
      assertDefined(invoice, 'Funding invoice creation failed');
      assertProp(check(isString, isNumber), invoice, 'id');
      assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
      assertProp(check(isString, isNumber), invoice, 'prepaid_amount');
      assertPropString(invoice, 'status');
      assertProp(isInstanceOf(Date), invoice, 'invoice_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'due_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'expired_date');
      assertProp(check(isNullable, isInstanceOf(Date)), invoice, 'paid_date');

      await tx.commitTransaction();

      return {
        id: String(loanOffer.id),
        lenderUserId: String(loanOffer.lender_user_id),
        lenderUserType: currencyUser.user_type as 'Individual' | 'Institution',
        lenderUserName: currencyUser.user_name,
        lenderProfilePictureUrl:
          'profile_picture_url' in currencyUser &&
          typeof currencyUser.profile_picture_url === 'string'
            ? currencyUser.profile_picture_url
            : undefined,
        lenderBusinessType:
          'business_type' in currencyUser && typeof currencyUser.business_type === 'string'
            ? currencyUser.business_type
            : undefined,
        lenderBusinessDescription:
          'business_description' in currencyUser &&
          typeof currencyUser.business_description === 'string'
            ? currencyUser.business_description
            : undefined,
        principalCurrency: {
          blockchainKey: currencyUser.blockchain_key,
          tokenId: currencyUser.token_id,
          decimals: Number(currencyUser.decimals),
          symbol: currencyUser.symbol,
          name: currencyUser.name,
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
            blockchainKey: currencyUser.blockchain_key,
            tokenId: currencyUser.token_id,
            decimals: Number(currencyUser.decimals),
            symbol: currencyUser.symbol,
            name: currencyUser.name,
          },
          // Prepaid amount will reduce payable amount but repository currently exposes invoiced total
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
      assertProp(check(isString, isNumber), updatedOffer, 'id');
      assertPropString(updatedOffer, 'status');
      assertProp(check(isNullable, isInstanceOf(Date)), updatedOffer, 'closed_date');
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
    assertProp(check(isString, isNumber), countRow, 'total');
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
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'offered_principal_amount');
      assertProp(check(isString, isNumber), row, 'available_principal_amount');
      assertProp(check(isString, isNumber), row, 'disbursed_principal_amount');
      assertProp(check(isString, isNumber), row, 'reserved_principal_amount');
      assertProp(check(isString, isNumber), row, 'min_loan_principal_amount');
      assertProp(check(isString, isNumber), row, 'max_loan_principal_amount');
      assertProp(check(isString, isNumber), row, 'interest_rate');
      assertPropString(row, 'status');
      assertProp(isInstanceOf(Date), row, 'created_date');
      assertProp(isInstanceOf(Date), row, 'expired_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'published_date');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'closed_date');
      assertPropNullableString(row, 'closure_reason');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'token_id');
      assertProp(check(isString, isNumber), row, 'decimals');
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

  async lenderGetsLoanOfferById(params: { loanOfferId: string }) {
    const { loanOfferId } = params;

    const rows = await this.sql`
      SELECT
        lo.id,
        lo.lender_user_id,
        u.user_type as lender_user_type,
        u.name as lender_name,
        ia.business_type as lender_business_type,
        ia.business_description as lender_business_description,
        lo.offered_principal_amount,
        lo.available_principal_amount,
        lo.disbursed_principal_amount,
        lo.interest_rate,
        lo.term_in_months_options,
        lo.status,
        lo.created_date,
        lo.published_date,
        lo.expired_date,
        c.blockchain_key,
        c.token_id,
        c.decimals,
        c.symbol,
        c.name as currency_name,
        i.id as invoice_id,
        i.invoiced_amount as invoice_amount,
        i.wallet_address as invoice_wallet_address,
        i.due_date as invoice_due_date,
        i.paid_date as invoice_paid_date,
        i.expired_date as invoice_expired_date
      FROM loan_offers lo
      JOIN currencies c ON lo.principal_currency_blockchain_key = c.blockchain_key
        AND lo.principal_currency_token_id = c.token_id
      JOIN users u ON lo.lender_user_id = u.id
      LEFT JOIN institution_applications ia ON ia.applicant_user_id = u.id AND ia.status = 'Approved'
      LEFT JOIN invoices i ON i.loan_offer_id = lo.id AND i.invoice_type = 'LoanPrincipal'
      WHERE lo.id = ${loanOfferId}
    `;

    if (rows.length === 0) {
      throw new Error('Loan offer not found');
    }

    const row = rows[0];
    assertDefined(row);
    const r = row as {
      id: string | number;
      lender_user_id: string | number;
      lender_user_type: string;
      lender_name: string;
      lender_business_type?: string | null;
      lender_business_description?: string | null;
      offered_principal_amount: string | number;
      available_principal_amount: string | number;
      disbursed_principal_amount?: string | number | null;
      interest_rate: string | number;
      term_in_months_options?: unknown;
      status: string;
      created_date: Date;
      published_date?: Date | null;
      expired_date: Date;
      blockchain_key: string;
      token_id: string;
      decimals: string | number;
      symbol: string;
      currency_name: string;
      invoice_id?: string | number | null;
      invoice_amount?: string | number;
      invoice_wallet_address?: string | null;
      invoice_due_date?: Date | null;
      invoice_paid_date?: Date | null;
      invoice_expired_date?: Date | null;
    };

    return {
      id: String(r.id),
      lenderUserId: String(r.lender_user_id),
      lenderUserType: r.lender_user_type,
      lenderUserName: r.lender_name,
      lenderBusinessType: r.lender_business_type || undefined,
      lenderBusinessDescription: r.lender_business_description || undefined,
      principalCurrency: {
        blockchainKey: r.blockchain_key,
        tokenId: r.token_id,
        decimals: Number(r.decimals),
        symbol: r.symbol,
        name: r.currency_name,
      },
      offeredPrincipalAmount: String(r.offered_principal_amount),
      availablePrincipalAmount: String(r.available_principal_amount),
      disbursedPrincipalAmount: String(r.disbursed_principal_amount || '0'),
      interestRate: Number(r.interest_rate),
      termInMonthsOptions: r.term_in_months_options || [],
      status: r.status,
      createdDate: r.created_date,
      publishedDate: r.published_date || undefined,
      expirationDate: r.expired_date,
      fundingInvoice: r.invoice_id
        ? {
            id: String(r.invoice_id),
            amount: String(r.invoice_amount),
            currency: {
              blockchainKey: r.blockchain_key,
              tokenId: r.token_id,
              name: r.currency_name,
              symbol: r.symbol,
              decimals: Number(r.decimals),
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
