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
  ('crosschain', 'iso4217:usd', 'iso4217:usd', 'random'),

  -- Testnet / Devnet price feeds for cg:testnet (mock blockchain)
  -- Mockchain Coin (MCK) against Mockchain Dollar (MUSD)
  ('cg:testnet', 'mock:native', 'mock:usd', 'random')
ON CONFLICT (blockchain_key, base_currency_token_id, quote_currency_token_id, source) DO NOTHING;

-- Insert initial exchange rates for testnet mock currencies
-- These are needed for loan application creation to calculate LTV ratios
DO $$
DECLARE
  mock_price_feed_id BIGINT;
BEGIN
  -- Get the price feed ID for mock:native to mock:usd
  SELECT id INTO mock_price_feed_id
  FROM price_feeds
  WHERE blockchain_key = 'cg:testnet'
    AND base_currency_token_id = 'mock:native'
    AND quote_currency_token_id = 'mock:usd'
    AND source = 'random';

  -- Only insert if we found the price feed and no rate exists yet
  IF mock_price_feed_id IS NOT NULL THEN
    INSERT INTO exchange_rates (price_feed_id, bid_price, ask_price, retrieval_date, source_date)
    SELECT mock_price_feed_id, 1000000000000000000, 1000000000000000000, NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM exchange_rates WHERE price_feed_id = mock_price_feed_id
    );
  END IF;
END $$;
