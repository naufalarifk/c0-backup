import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isNumber,
  isString,
} from 'typeshaper';

import { FinanceRepository } from './finance.repository';
import {
  PlatformFeedsExchangeRateParams,
  PlatformFeedsExchangeRateResult,
  PlatformRetrievesActivePriceFeedsResult,
  PlatformRetrievesExchangeRatesParams,
  PlatformRetrievesExchangeRatesResult,
} from './pricefeed.types';

/**
 * PricefeedRepository <- FinanceRepository <- UserRepository <- BaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as balance calculations, exchange rate validations, etc.
 * should be handled by services that use this repository.
 */

export abstract class PricefeedRepository extends FinanceRepository {
  // Price Feed Management Methods
  async platformRetrievesActivePriceFeeds(): Promise<PlatformRetrievesActivePriceFeedsResult> {
    const rows = await this.sql`
      SELECT
        pf.id,
        pf.blockchain_key,
        pf.base_currency_token_id,
        pf.quote_currency_token_id,
        pf.source,
        qc.decimals as quote_currency_decimals
      FROM price_feeds pf
      JOIN currencies qc ON pf.blockchain_key = qc.blockchain_key
        AND pf.quote_currency_token_id = qc.token_id
      ORDER BY pf.blockchain_key, pf.base_currency_token_id, pf.quote_currency_token_id
    `;

    const priceFeeds = rows.map(function (row: unknown) {
      assertDefined(row, 'Price feed record is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertPropString(row, 'blockchain_key');
      assertPropString(row, 'base_currency_token_id');
      assertPropString(row, 'quote_currency_token_id');
      assertPropString(row, 'source');
      assertProp(check(isString, isNumber), row, 'quote_currency_decimals');

      return {
        id: String(row.id),
        blockchainKey: row.blockchain_key,
        baseCurrencyTokenId: row.base_currency_token_id,
        quoteCurrencyTokenId: row.quote_currency_token_id,
        source: row.source,
        quoteCurrencyDecimals: Number(row.quote_currency_decimals),
      };
    });

    return { priceFeeds };
  }

  // Exchange Rate Management Methods
  async platformRetrievesExchangeRates(
    params: PlatformRetrievesExchangeRatesParams,
  ): Promise<PlatformRetrievesExchangeRatesResult> {
    const { blockchainKey, baseCurrencyTokenId, quoteCurrencyTokenId } = params;

    const rows = await this.sql`
          SELECT
            er.id,
            er.price_feed_id,
            er.bid_price,
            er.ask_price,
            er.retrieval_date,
            er.source_date,
            pf.blockchain_key,
            pf.base_currency_token_id,
            pf.quote_currency_token_id,
            pf.source
          FROM exchange_rates er
          JOIN price_feeds pf ON er.price_feed_id = pf.id
          WHERE (${blockchainKey}::text IS NULL OR pf.blockchain_key = ${blockchainKey})
            AND (${baseCurrencyTokenId}::text IS NULL OR pf.base_currency_token_id = ${baseCurrencyTokenId})
            AND (${quoteCurrencyTokenId}::text IS NULL OR pf.quote_currency_token_id = ${quoteCurrencyTokenId})
          ORDER BY er.retrieval_date DESC
        `;

    const exchangeRates = rows;

    return {
      exchangeRates: exchangeRates.map(function (rate: unknown) {
        assertDefined(rate, 'Exchange rate record is undefined');
        assertProp(check(isString, isNumber), rate, 'id');
        assertProp(check(isString, isNumber), rate, 'price_feed_id');
        assertProp(check(isString, isNumber), rate, 'bid_price');
        assertProp(check(isString, isNumber), rate, 'ask_price');
        assertProp(isInstanceOf(Date), rate, 'retrieval_date');
        assertProp(isInstanceOf(Date), rate, 'source_date');
        assertPropString(rate, 'blockchain_key');
        assertPropString(rate, 'base_currency_token_id');
        assertPropString(rate, 'quote_currency_token_id');
        assertPropString(rate, 'source');
        return {
          id: String(rate.id),
          priceFeedId: String(rate.price_feed_id),
          bidPrice: String(rate.bid_price),
          askPrice: String(rate.ask_price),
          retrievalDate: rate.retrieval_date,
          sourceDate: rate.source_date,
          blockchain: rate.blockchain_key,
          baseCurrency: rate.base_currency_token_id,
          quoteCurrency: rate.quote_currency_token_id,
          source: rate.source,
        };
      }),
    };
  }

  async platformFeedsExchangeRate(
    params: PlatformFeedsExchangeRateParams,
  ): Promise<PlatformFeedsExchangeRateResult> {
    const { priceFeedId, bidPrice, askPrice, retrievalDate, sourceDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
            INSERT INTO exchange_rates (
              price_feed_id,
              bid_price,
              ask_price,
              retrieval_date,
              source_date
            )
            VALUES (
              ${priceFeedId},
              ${bidPrice},
              ${askPrice},
              ${retrievalDate.toISOString()},
              ${sourceDate.toISOString()}
            )
            RETURNING id, price_feed_id, bid_price, ask_price, retrieval_date, source_date
          `;

      const exchangeRate = rows[0];
      assertDefined(exchangeRate, 'Exchange rate update failed');
      assertProp(check(isString, isNumber), exchangeRate, 'id');
      assertProp(check(isString, isNumber), exchangeRate, 'price_feed_id');
      assertProp(check(isString, isNumber), exchangeRate, 'bid_price');
      assertProp(check(isString, isNumber), exchangeRate, 'ask_price');
      assertProp(isInstanceOf(Date), exchangeRate, 'retrieval_date');
      assertProp(isInstanceOf(Date), exchangeRate, 'source_date');

      await tx.commitTransaction();

      return {
        id: String(exchangeRate.id),
        priceFeedId: String(exchangeRate.price_feed_id),
        bidPrice: String(exchangeRate.bid_price),
        askPrice: String(exchangeRate.ask_price),
        retrievalDate: exchangeRate.retrieval_date,
        sourceDate: exchangeRate.source_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async systemCreatesTestPriceFeeds(params: {
    priceFeeds: Array<{
      blockchainKey: string;
      baseCurrencyTokenId: string;
      quoteCurrencyTokenId: string;
      source: string;
    }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const pf of params.priceFeeds) {
        await this.sql`
          INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
          VALUES (${pf.blockchainKey}, ${pf.baseCurrencyTokenId}, ${pf.quoteCurrencyTokenId}, ${pf.source})
        `;
      }
      await tx.commitTransaction();
      return { priceFeedsCreated: params.priceFeeds.length };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async systemCreatesTestExchangeRates(params: {
    exchangeRates: Array<{
      priceFeedId: string;
      bidPrice: string;
      askPrice: string;
      retrievalDate: string;
      sourceDate: string;
    }>;
  }) {
    const tx = await this.beginTransaction();
    try {
      for (const er of params.exchangeRates) {
        await this.sql`
          INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
          VALUES (${er.priceFeedId}, ${er.bidPrice}, ${er.askPrice}, ${er.retrievalDate}, ${er.sourceDate})
        `;
      }
      await tx.commitTransaction();
      return { exchangeRatesCreated: params.exchangeRates.length };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async systemFindsTestPriceFeedId(params: {
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
    source?: string;
  }) {
    const sourceParam = params.source ?? null;

    const rows = await this.sql`
      SELECT id FROM price_feeds
      WHERE blockchain_key = ${params.blockchainKey}
        AND base_currency_token_id = ${params.baseCurrencyTokenId}
        AND quote_currency_token_id = ${params.quoteCurrencyTokenId}
        AND (${sourceParam}::text IS NULL OR source = ${sourceParam})
    `;

    if (rows.length === 0) {
      throw new Error('Price feed not found');
    }

    const row = rows[0];
    assertDefined(row, 'Price feed is undefined');
    assertProp(check(isString, isNumber), row, 'id');

    return { id: String(row.id) };
  }
}
