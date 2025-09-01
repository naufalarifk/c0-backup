--- SCHEMA ---

CREATE TABLE IF NOT EXISTS price_feeds (
  id BIGSERIAL PRIMARY KEY,
  -- currency pair
  -- base and quote are ordered using ascending string comparison
  blockchain_key VARCHAR(64) NOT NULL REFERENCES blockchains (key),
  base_currency_token_id VARCHAR(64) NOT NULL,
  quote_currency_token_id VARCHAR(64) NOT NULL,
  source VARCHAR(32) NOT NULL,
  FOREIGN KEY (blockchain_key, base_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (blockchain_key, quote_currency_token_id) REFERENCES currencies (blockchain_key, token_id)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  price_feed_id BIGINT NOT NULL REFERENCES price_feeds (id),
  bid_price NUMERIC(30, 12) NOT NULL,
  ask_price NUMERIC(30, 12) NOT NULL,
  retrieval_date TIMESTAMP NOT NULL,
  source_date TIMESTAMP NOT NULL
);
