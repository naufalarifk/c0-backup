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
}
