import { assertDefined, assertProp, assertPropString, check, isNumber, isString } from 'typeshaper';

import { PricefeedRepository } from './pricefeed.repository';

/**
 * LoanTestRepository <- PricefeedRepository <- FinanceRepository <- UserRepository <- DatabaseRepository
 */
export abstract class LoanTestRepository extends PricefeedRepository {
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
      assertProp(check(isString, isNumber), priceFeed, 'id');
      const priceFeedId = String(priceFeed.id);

      // Insert exchange rate
      const exchangeRateRows = await tx.sql`
        INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
        VALUES (${priceFeedId}, ${bidPrice}, ${askPrice}, ${sourceDate.toISOString()}, ${sourceDate.toISOString()})
        RETURNING id
      `;

      const exchangeRate = exchangeRateRows[0];
      assertDefined(exchangeRate, 'Exchange rate creation failed');
      assertProp(check(isString, isNumber), exchangeRate, 'id');
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

  async testPublishesLoanApplication(params: {
    loanApplicationId: string;
    publishedDate: Date;
  }): Promise<void> {
    const { loanApplicationId, publishedDate } = params;

    await this.sql`
      UPDATE loan_applications
      SET status = 'Published', published_date = ${publishedDate.toISOString()}
      WHERE id = ${loanApplicationId}
    `;
  }

  async testPaysLoanOfferFundingInvoice(params: {
    loanOfferId: string;
    paymentDate: Date;
    amount?: string;
    paymentHash?: string;
  }): Promise<{ invoiceId: string; amount: string; paymentHash: string }> {
    const { loanOfferId, paymentDate, amount, paymentHash } = params;

    const loanOfferRows = await this.sql`
      SELECT
        lo.lender_user_id,
        lo.offered_principal_amount,
        lo.principal_currency_blockchain_key,
        lo.principal_currency_token_id,
        i.id AS invoice_id
      FROM loan_offers lo
      JOIN invoices i ON i.loan_offer_id = lo.id AND i.invoice_type = 'LoanPrincipal'
      WHERE lo.id = ${loanOfferId}
    `;

    if (loanOfferRows.length === 0) {
      throw new Error(`No principal invoice found for loan offer ${loanOfferId}`);
    }

    const loanOffer = loanOfferRows[0];
    assertDefined(loanOffer, 'Loan offer validation failed');
    assertProp(check(isString, isNumber), loanOffer, 'lender_user_id');
    assertProp(check(isString, isNumber), loanOffer, 'offered_principal_amount');
    assertPropString(loanOffer, 'principal_currency_blockchain_key');
    assertPropString(loanOffer, 'principal_currency_token_id');
    assertProp(check(isString, isNumber), loanOffer, 'invoice_id');

    const ensuredInvoiceId = String(loanOffer.invoice_id);
    const ensuredAmount = amount ?? String(loanOffer.offered_principal_amount);
    const ensuredPaymentHash = paymentHash ?? `test_payment_hash_${ensuredInvoiceId}_${Date.now()}`;
    const paymentDateIso = paymentDate.toISOString();

    const tx = await this.beginTransaction();
    try {
      await tx.sql`
        INSERT INTO account_mutation_entries (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          account_type,
          mutation_type,
          mutation_date,
          amount
        ) VALUES (
          ${loanOffer.lender_user_id},
          ${loanOffer.principal_currency_blockchain_key},
          ${loanOffer.principal_currency_token_id},
          'User',
          'AdminManualAdjustment',
          ${paymentDateIso},
          ${ensuredAmount}
        )
      `;

      await tx.sql`
        INSERT INTO invoice_payments (
          invoice_id,
          payment_date,
          payment_hash,
          amount
        ) VALUES (
          ${ensuredInvoiceId},
          ${paymentDateIso},
          ${ensuredPaymentHash},
          ${ensuredAmount}
        )
      `;

      await tx.commitTransaction();
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }

    return {
      invoiceId: ensuredInvoiceId,
      amount: ensuredAmount,
      paymentHash: ensuredPaymentHash,
    };
  }

  async testPaysLoanApplicationCollateralInvoice(params: {
    loanApplicationId: string;
    paymentDate: Date;
    amount?: string;
    paymentHash?: string;
  }): Promise<{ invoiceId: string; amount: string; paymentHash: string }> {
    const { loanApplicationId, paymentDate, amount, paymentHash } = params;

    const loanApplicationRows = await this.sql`
      SELECT
        la.borrower_user_id,
        la.collateral_deposit_amount,
        la.collateral_currency_blockchain_key,
        la.collateral_currency_token_id,
        i.id AS invoice_id
      FROM loan_applications la
      JOIN invoices i ON i.loan_application_id = la.id AND i.invoice_type = 'LoanCollateral'
      WHERE la.id = ${loanApplicationId}
    `;

    if (loanApplicationRows.length === 0) {
      throw new Error(`No collateral invoice found for loan application ${loanApplicationId}`);
    }

    const loanApplication = loanApplicationRows[0];
    assertDefined(loanApplication, 'Loan application validation failed');
    assertProp(check(isString, isNumber), loanApplication, 'borrower_user_id');
    assertProp(check(isString, isNumber), loanApplication, 'collateral_deposit_amount');
    assertPropString(loanApplication, 'collateral_currency_blockchain_key');
    assertPropString(loanApplication, 'collateral_currency_token_id');
    assertProp(check(isString, isNumber), loanApplication, 'invoice_id');

    const ensuredInvoiceId = String(loanApplication.invoice_id);
    const ensuredAmount = amount ?? String(loanApplication.collateral_deposit_amount);
    const ensuredPaymentHash = paymentHash ?? `test_payment_hash_${ensuredInvoiceId}_${Date.now()}`;
    const paymentDateIso = paymentDate.toISOString();

    const tx = await this.beginTransaction();
    try {
      await tx.sql`
        INSERT INTO account_mutation_entries (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          account_type,
          mutation_type,
          mutation_date,
          amount
        ) VALUES (
          ${loanApplication.borrower_user_id},
          ${loanApplication.collateral_currency_blockchain_key},
          ${loanApplication.collateral_currency_token_id},
          'User',
          'AdminManualAdjustment',
          ${paymentDateIso},
          ${ensuredAmount}
        )
      `;

      await tx.sql`
        INSERT INTO invoice_payments (
          invoice_id,
          payment_date,
          payment_hash,
          amount
        ) VALUES (
          ${ensuredInvoiceId},
          ${paymentDateIso},
          ${ensuredPaymentHash},
          ${ensuredAmount}
        )
      `;

      await tx.commitTransaction();
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }

    return {
      invoiceId: ensuredInvoiceId,
      amount: ensuredAmount,
      paymentHash: ensuredPaymentHash,
    };
  }

  async testNormalizesLoanOfferAmounts(params: { loanOfferId: string }): Promise<{
    offeredPrincipalAmount: string;
    minLoanPrincipalAmount: string;
    maxLoanPrincipalAmount: string;
    availablePrincipalAmount: string;
    reservedPrincipalAmount: string;
    disbursedPrincipalAmount: string;
    decimals: number;
    scaleFactor: string;
    normalized: boolean;
  }> {
    const { loanOfferId } = params;

    const loanOfferRows = await this.sql`
      SELECT
        lo.id,
        lo.offered_principal_amount,
        lo.min_loan_principal_amount,
        lo.max_loan_principal_amount,
        lo.available_principal_amount,
        lo.reserved_principal_amount,
        lo.disbursed_principal_amount,
        lo.principal_currency_blockchain_key,
        lo.principal_currency_token_id,
        c.decimals
      FROM loan_offers lo
      JOIN currencies c ON c.blockchain_key = lo.principal_currency_blockchain_key
        AND c.token_id = lo.principal_currency_token_id
      WHERE lo.id = ${loanOfferId}
    `;

    if (loanOfferRows.length === 0) {
      throw new Error(`Loan offer ${loanOfferId} not found`);
    }

    const loanOffer = loanOfferRows[0];
    assertDefined(loanOffer, 'Loan offer normalization failed');
    assertProp(check(isString, isNumber), loanOffer, 'offered_principal_amount');
    assertProp(check(isString, isNumber), loanOffer, 'min_loan_principal_amount');
    assertProp(check(isString, isNumber), loanOffer, 'max_loan_principal_amount');
    assertProp(check(isString, isNumber), loanOffer, 'available_principal_amount');
    assertProp(check(isString, isNumber), loanOffer, 'reserved_principal_amount');
    assertProp(check(isString, isNumber), loanOffer, 'disbursed_principal_amount');
    assertProp(check(isString, isNumber), loanOffer, 'decimals');

    const decimals = Number(loanOffer.decimals);
    const scaleFactor = BigInt(10) ** BigInt(decimals);

    if (decimals === 0) {
      return {
        offeredPrincipalAmount: String(loanOffer.offered_principal_amount),
        minLoanPrincipalAmount: String(loanOffer.min_loan_principal_amount),
        maxLoanPrincipalAmount: String(loanOffer.max_loan_principal_amount),
        availablePrincipalAmount: String(loanOffer.available_principal_amount),
        reservedPrincipalAmount: String(loanOffer.reserved_principal_amount),
        disbursedPrincipalAmount: String(loanOffer.disbursed_principal_amount),
        decimals,
        scaleFactor: scaleFactor.toString(),
        normalized: false,
      };
    }

    const offeredPrincipalAmount = BigInt(String(loanOffer.offered_principal_amount));
    const minLoanPrincipalAmount = BigInt(String(loanOffer.min_loan_principal_amount));
    const maxLoanPrincipalAmount = BigInt(String(loanOffer.max_loan_principal_amount));
    const availablePrincipalAmount = BigInt(String(loanOffer.available_principal_amount));
    const reservedPrincipalAmount = BigInt(String(loanOffer.reserved_principal_amount));
    const disbursedPrincipalAmount = BigInt(String(loanOffer.disbursed_principal_amount));

    const alreadyNormalized =
      offeredPrincipalAmount % scaleFactor === BigInt(0) &&
      minLoanPrincipalAmount % scaleFactor === BigInt(0) &&
      maxLoanPrincipalAmount % scaleFactor === BigInt(0) &&
      availablePrincipalAmount % scaleFactor === BigInt(0) &&
      reservedPrincipalAmount % scaleFactor === BigInt(0) &&
      disbursedPrincipalAmount % scaleFactor === BigInt(0);

    if (alreadyNormalized) {
      return {
        offeredPrincipalAmount: offeredPrincipalAmount.toString(),
        minLoanPrincipalAmount: minLoanPrincipalAmount.toString(),
        maxLoanPrincipalAmount: maxLoanPrincipalAmount.toString(),
        availablePrincipalAmount: availablePrincipalAmount.toString(),
        reservedPrincipalAmount: reservedPrincipalAmount.toString(),
        disbursedPrincipalAmount: disbursedPrincipalAmount.toString(),
        decimals,
        scaleFactor: scaleFactor.toString(),
        normalized: false,
      };
    }

    const normalizedOffered = (offeredPrincipalAmount * scaleFactor).toString();
    const normalizedMin = (minLoanPrincipalAmount * scaleFactor).toString();
    const normalizedMax = (maxLoanPrincipalAmount * scaleFactor).toString();
    const normalizedReserved = (reservedPrincipalAmount * scaleFactor).toString();
    const normalizedDisbursed = (disbursedPrincipalAmount * scaleFactor).toString();
    const normalizedAvailable = (
      BigInt(normalizedOffered) -
      BigInt(normalizedDisbursed) -
      BigInt(normalizedReserved)
    ).toString();

    const tx = await this.beginTransaction();
    try {
      await tx.sql`
        UPDATE loan_offers
        SET
          offered_principal_amount = ${normalizedOffered},
          min_loan_principal_amount = ${normalizedMin},
          max_loan_principal_amount = ${normalizedMax},
          reserved_principal_amount = ${normalizedReserved},
          disbursed_principal_amount = ${normalizedDisbursed}
        WHERE id = ${loanOfferId}
      `;

      await tx.sql`
        UPDATE invoices
        SET invoiced_amount = ${normalizedOffered}
        WHERE loan_offer_id = ${loanOfferId} AND invoice_type = 'LoanPrincipal'
      `;

      await tx.commitTransaction();
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }

    return {
      offeredPrincipalAmount: normalizedOffered,
      minLoanPrincipalAmount: normalizedMin,
      maxLoanPrincipalAmount: normalizedMax,
      availablePrincipalAmount: normalizedAvailable,
      reservedPrincipalAmount: normalizedReserved,
      disbursedPrincipalAmount: normalizedDisbursed,
      decimals,
      scaleFactor: scaleFactor.toString(),
      normalized: true,
    };
  }

  async testNormalizesLoanApplicationAmounts(params: { loanApplicationId: string }): Promise<{
    principalAmount: string;
    provisionAmount: string;
    collateralDepositAmount: string;
    collateralPrepaidAmount?: string;
    principalDecimals: number;
    collateralDecimals: number;
    principalScaleFactor: string;
    collateralScaleFactor: string;
    normalized: boolean;
  }> {
    const { loanApplicationId } = params;

    const applicationRows = await this.sql`
      SELECT
        la.id,
        la.principal_amount,
        la.provision_amount,
        la.collateral_deposit_amount,
        la.collateral_prepaid_amount,
        la.principal_currency_blockchain_key,
        la.principal_currency_token_id,
        la.collateral_currency_blockchain_key,
        la.collateral_currency_token_id,
        pc.decimals AS principal_decimals,
        cc.decimals AS collateral_decimals
      FROM loan_applications la
      JOIN currencies pc ON pc.blockchain_key = la.principal_currency_blockchain_key
        AND pc.token_id = la.principal_currency_token_id
      JOIN currencies cc ON cc.blockchain_key = la.collateral_currency_blockchain_key
        AND cc.token_id = la.collateral_currency_token_id
      WHERE la.id = ${loanApplicationId}
    `;

    if (applicationRows.length === 0) {
      throw new Error(`Loan application ${loanApplicationId} not found`);
    }

    const application = applicationRows[0];
    assertDefined(application, 'Loan application normalization failed');
    assertProp(check(isString, isNumber), application, 'principal_amount');
    assertProp(check(isString, isNumber), application, 'provision_amount');
    assertProp(check(isString, isNumber), application, 'collateral_deposit_amount');
    assertProp(check(isString, isNumber), application, 'principal_decimals');
    assertProp(check(isString, isNumber), application, 'collateral_decimals');

    const principalDecimals = Number(application.principal_decimals);
    const collateralDecimals = Number(application.collateral_decimals);
    const principalScaleFactor = BigInt(10) ** BigInt(principalDecimals);
    const collateralScaleFactor = BigInt(10) ** BigInt(collateralDecimals);

    const principalAmount = BigInt(String(application.principal_amount));
    const provisionAmount = BigInt(String(application.provision_amount));
    const collateralDepositAmount = BigInt(String(application.collateral_deposit_amount));
    const collateralPrepaidRaw = (
      application as {
        collateral_prepaid_amount?: string | number | null;
      }
    ).collateral_prepaid_amount;
    const collateralPrepaidAmount =
      collateralPrepaidRaw === null || collateralPrepaidRaw === undefined
        ? null
        : BigInt(String(collateralPrepaidRaw));

    const principalAlreadyNormalized =
      principalDecimals === 0 || principalAmount % principalScaleFactor === BigInt(0);
    const provisionAlreadyNormalized =
      principalDecimals === 0 || provisionAmount % principalScaleFactor === BigInt(0);
    const collateralAlreadyNormalized =
      collateralDecimals === 0 || collateralDepositAmount % collateralScaleFactor === BigInt(0);
    const collateralPrepaidAlreadyNormalized =
      collateralPrepaidAmount === null ||
      collateralDecimals === 0 ||
      collateralPrepaidAmount % collateralScaleFactor === BigInt(0);

    const normalizedPrincipal = principalAlreadyNormalized
      ? principalAmount
      : principalAmount * principalScaleFactor;
    const normalizedProvision = provisionAlreadyNormalized
      ? provisionAmount
      : provisionAmount * principalScaleFactor;
    const normalizedCollateral = collateralAlreadyNormalized
      ? collateralDepositAmount
      : collateralDepositAmount * collateralScaleFactor;
    const normalizedCollateralPrepaid =
      collateralPrepaidAmount === null
        ? null
        : collateralPrepaidAlreadyNormalized
          ? collateralPrepaidAmount
          : collateralPrepaidAmount * collateralScaleFactor;

    const requiresUpdate =
      normalizedPrincipal !== principalAmount ||
      normalizedProvision !== provisionAmount ||
      normalizedCollateral !== collateralDepositAmount ||
      (collateralPrepaidAmount ?? null) !== (normalizedCollateralPrepaid ?? null);

    if (!requiresUpdate) {
      return {
        principalAmount: principalAmount.toString(),
        provisionAmount: provisionAmount.toString(),
        collateralDepositAmount: collateralDepositAmount.toString(),
        collateralPrepaidAmount: collateralPrepaidAmount?.toString(),
        principalDecimals,
        collateralDecimals,
        principalScaleFactor: principalScaleFactor.toString(),
        collateralScaleFactor: collateralScaleFactor.toString(),
        normalized: false,
      };
    }

    const tx = await this.beginTransaction();
    try {
      await tx.sql`
        UPDATE loan_applications
        SET
          principal_amount = ${normalizedPrincipal.toString()},
          provision_amount = ${normalizedProvision.toString()},
          collateral_deposit_amount = ${normalizedCollateral.toString()},
          collateral_prepaid_amount = ${
            normalizedCollateralPrepaid === null ? null : normalizedCollateralPrepaid.toString()
          }
        WHERE id = ${loanApplicationId}
      `;

      await tx.sql`
        UPDATE invoices
        SET invoiced_amount = ${normalizedCollateral.toString()}
        WHERE loan_application_id = ${loanApplicationId} AND invoice_type = 'LoanCollateral'
      `;

      await tx.commitTransaction();
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }

    return {
      principalAmount: normalizedPrincipal.toString(),
      provisionAmount: normalizedProvision.toString(),
      collateralDepositAmount: normalizedCollateral.toString(),
      collateralPrepaidAmount: normalizedCollateralPrepaid?.toString(),
      principalDecimals,
      collateralDecimals,
      principalScaleFactor: principalScaleFactor.toString(),
      collateralScaleFactor: collateralScaleFactor.toString(),
      normalized: true,
    };
  }
}
