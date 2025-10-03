import { equal, ok } from 'node:assert/strict';
import { describe, suite } from 'node:test';

import { createEarlyExitNodeTestIt } from '../utils/node-test';
import { PricefeedRepository } from './pricefeed.repository';

export async function runPricefeedRepositoryTestSuite(
  createRepo: () => Promise<PricefeedRepository>,
  teardownRepo: (repo: PricefeedRepository) => Promise<void>,
): Promise<void> {
  const { afterEach, beforeEach, it } = createEarlyExitNodeTestIt();
  await suite('PricefeedRepository', function () {
    let repo: PricefeedRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('Exchange Rate Management', function () {
      it('should retrieve exchange rates with filters', async function () {
        // First create some test data with valid currency combinations on same blockchain
        await repo.testCreatesPriceFeeds({
          priceFeeds: [
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'coinbase',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:714',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'coinbase',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:501',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
          ],
        });

        const ethBinancePriceFeedResult = await repo.testViewsPriceFeedId({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
          quoteCurrencyTokenId: 'iso4217:usd',
          source: 'binance',
        });
        const ethBinancePriceFeedId = ethBinancePriceFeedResult.id;

        const ethCoinbasePriceFeedResult = await repo.testViewsPriceFeedId({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
          quoteCurrencyTokenId: 'iso4217:usd',
          source: 'coinbase',
        });
        const ethCoinbasePriceFeedId = ethCoinbasePriceFeedResult.id;

        await repo.testCreatesExchangeRates({
          exchangeRates: [
            {
              priceFeedId: ethBinancePriceFeedId,
              bidPrice: '2999.00',
              askPrice: '3009.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
            {
              priceFeedId: ethCoinbasePriceFeedId,
              bidPrice: '3000.00',
              askPrice: '3010.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
          ],
        });

        const result = await repo.platformRetrievesExchangeRates({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
        });

        equal(result.exchangeRates.length, 2);
        const binanceRate = result.exchangeRates.find(r => r.source === 'binance');
        ok(binanceRate, 'Binance rate should exist');
        equal(binanceRate.blockchain, 'crosschain');
        equal(binanceRate.baseCurrency, 'slip44:60');
        equal(binanceRate.quoteCurrency, 'iso4217:usd');
        equal(binanceRate.bidPrice, '2999.000000000000');
        equal(binanceRate.askPrice, '3009.000000000000');
        equal(binanceRate.source, 'binance');
        equal(typeof binanceRate.id, 'string');
        ok(binanceRate.retrievalDate instanceof Date);
        ok(binanceRate.sourceDate instanceof Date);
      });

      it('should retrieve all exchange rates without filters', async function () {
        // Create test data with valid currency combinations
        await repo.testCreatesPriceFeeds({
          priceFeeds: [
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:714',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
          ],
        });

        const ethPriceFeedId = (
          await repo.testViewsPriceFeedId({
            blockchainKey: 'crosschain',
            baseCurrencyTokenId: 'slip44:60',
            quoteCurrencyTokenId: 'iso4217:usd',
          })
        ).id;

        const bnbPriceFeedId = (
          await repo.testViewsPriceFeedId({
            blockchainKey: 'crosschain',
            baseCurrencyTokenId: 'slip44:714',
            quoteCurrencyTokenId: 'iso4217:usd',
          })
        ).id;

        await repo.testCreatesExchangeRates({
          exchangeRates: [
            {
              priceFeedId: ethPriceFeedId,
              bidPrice: '3000.00',
              askPrice: '3010.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
            {
              priceFeedId: bnbPriceFeedId,
              bidPrice: '500.00',
              askPrice: '502.00',
              retrievalDate: '2024-01-01T10:00:00Z',
              sourceDate: '2024-01-01T09:59:30Z',
            },
          ],
        });

        const result = await repo.platformRetrievesExchangeRates({});

        // Should include at least the rates from this test
        ok(result.exchangeRates.length >= 2);

        const ethRate = result.exchangeRates.find(r => r.baseCurrency === 'slip44:60');
        const bnbRate = result.exchangeRates.find(r => r.baseCurrency === 'slip44:714');

        ok(ethRate, 'ETH rate should exist');
        ok(bnbRate, 'BNB rate should exist');
      });

      it('should return empty array when no matching exchange rates', async function () {
        const result = await repo.platformRetrievesExchangeRates({
          blockchainKey: 'nonexistent',
        });

        equal(result.exchangeRates.length, 0);
      });

      it('should update exchange rate', async function () {
        // First create a price feed for testing with valid currency combination
        await repo.testCreatesPriceFeeds({
          priceFeeds: [
            {
              blockchainKey: 'crosschain',
              baseCurrencyTokenId: 'slip44:60',
              quoteCurrencyTokenId: 'iso4217:usd',
              source: 'binance',
            },
          ],
        });

        // Get the price feed
        const priceFeedResult = await repo.testViewsPriceFeedId({
          blockchainKey: 'crosschain',
          baseCurrencyTokenId: 'slip44:60',
          quoteCurrencyTokenId: 'iso4217:usd',
        });
        const priceFeedId = priceFeedResult.id;

        const retrievalDate = new Date('2024-01-01T11:00:00Z');
        const sourceDate = new Date('2024-01-01T10:59:30Z');

        const result = await repo.platformFeedsExchangeRate({
          priceFeedId,
          bidPrice: '3100.00',
          askPrice: '3110.00',
          retrievalDate,
          sourceDate,
        });

        equal(result.priceFeedId, priceFeedId);
        equal(result.bidPrice, '3100.000000000000');
        equal(result.askPrice, '3110.000000000000');
        equal(result.retrievalDate.getTime(), retrievalDate.getTime());
        equal(result.sourceDate.getTime(), sourceDate.getTime());
        equal(typeof result.id, 'string');
      });
    });
  });
}
