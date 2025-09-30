--- SCHEMA ---

CREATE TABLE IF NOT EXISTS price_feeds (
  id BIGSERIAL PRIMARY KEY,
  -- currency pair
  -- base and quote are ordered using ascending string comparison
  blockchain_key VARCHAR(64) NOT NULL REFERENCES blockchains (key), -- e.g., CAIP-2 key of the blockchain
  base_currency_token_id VARCHAR(64) NOT NULL, -- CAIP-19 token ID of the base currency (e.g., BTC)
  quote_currency_token_id VARCHAR(64) NOT NULL, -- CAIP-19 token ID of the quote currency (e.g., USDT)
  source VARCHAR(32) NOT NULL, -- e.g., 'Binance', 'CoinGecko'
  FOREIGN KEY (blockchain_key, base_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (blockchain_key, quote_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  UNIQUE (blockchain_key, base_currency_token_id, quote_currency_token_id, source)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  price_feed_id BIGINT NOT NULL REFERENCES price_feeds (id),
  bid_price DECIMAL(78, 0) NOT NULL,
  ask_price DECIMAL(78, 0) NOT NULL,
  retrieval_date TIMESTAMP NOT NULL,
  source_date TIMESTAMP NOT NULL
);

-- @PriceFeed(PriceFeedSource.Binance)
-- class BinancePriceFeedProvider extends PriceFeedProvider {
--   async fetchExchangeRate(baseCurrency: Currency, quoteCurrency: Currency): Promise<ExchangeRate> {
--     // Implementasi pengambilan data dari API Binance
--     const symbol = `${baseCurrency.tokenId}${quoteCurrency.tokenId}`;
--     const response = await fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`);
--     const data = await response.json();

--     if (!data.bidPrice || !data.askPrice) {
--       throw new Error('Invalid response from Binance API');
--     }

--     return {
--       bidPrice: parseFloat(data.bidPrice),
--       askPrice: parseFloat(data.askPrice),
--       retrievalDate: new Date(),
--       sourceDate: new Date() // Binance tidak menyediakan timestamp khusus, jadi gunakan waktu saat ini
--     };
--   }
-- }

--- PLATFORM FIXED DATA ---

-- Insert price feeds for all collateral currencies against USDC (loan currency)
-- These are the markets used by loan applications for LTV calculations
INSERT INTO price_feeds (blockchain_key, base_currency_token_id, quote_currency_token_id, source) VALUES
  -- Cross-chain Bitcoin (BTC) price feeds against USD Token (for loans)
  ('crosschain', 'slip44:0', 'iso4217:usd', 'binance'),
  ('crosschain', 'slip44:0', 'iso4217:usd', 'coingecko'),
  ('crosschain', 'slip44:0', 'iso4217:usd', 'coinmarketcap'),
  ('crosschain', 'slip44:0', 'iso4217:usd', 'random'),

  -- Cross-chain Ethereum (ETH) price feeds against USD Token (for loans)
  ('crosschain', 'slip44:60', 'iso4217:usd', 'binance'),
  ('crosschain', 'slip44:60', 'iso4217:usd', 'coingecko'),
  ('crosschain', 'slip44:60', 'iso4217:usd', 'coinmarketcap'),
  ('crosschain', 'slip44:60', 'iso4217:usd', 'random'),

  -- Cross-chain BNB price feeds against USD Token (for loans)
  ('crosschain', 'slip44:714', 'iso4217:usd', 'binance'),
  ('crosschain', 'slip44:714', 'iso4217:usd', 'coingecko'),
  ('crosschain', 'slip44:714', 'iso4217:usd', 'coinmarketcap'),
  ('crosschain', 'slip44:714', 'iso4217:usd', 'random'),

  -- Cross-chain Solana (SOL) price feeds against USD Token (for loans)
  ('crosschain', 'slip44:501', 'iso4217:usd', 'binance'),
  ('crosschain', 'slip44:501', 'iso4217:usd', 'coingecko'),
  ('crosschain', 'slip44:501', 'iso4217:usd', 'coinmarketcap'),
  ('crosschain', 'slip44:501', 'iso4217:usd', 'random'),

  -- Cross-chain USDC against USD Token for conversion
  ('crosschain', 'iso4217:usd', 'iso4217:usd', 'binance'),
  ('crosschain', 'iso4217:usd', 'iso4217:usd', 'coingecko'),
  ('crosschain', 'iso4217:usd', 'iso4217:usd', 'coinmarketcap'),
  ('crosschain', 'iso4217:usd', 'iso4217:usd', 'random')
ON CONFLICT (blockchain_key, base_currency_token_id, quote_currency_token_id, source) DO NOTHING;
