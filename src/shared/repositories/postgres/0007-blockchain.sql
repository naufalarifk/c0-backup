CREATE TABLE IF NOT EXISTS blockchains (
  key VARCHAR(64) PRIMARY KEY, -- specification: https://chainagnostic.org/CAIPs/caip-2
  name VARCHAR(64) NOT NULL,
  short_name VARCHAR(16) NOT NULL,
  image TEXT NOT NULL,
  indexer_earliest_block BIGINT NOT NULL DEFAULT 0,
  indexer_latest_block BIGINT NOT NULL DEFAULT 0
);


--- PLATFORM FIXED DATA ---

-- Insert supported blockchains as defined in SRS-CD-v2.3-EN.md Section 1.2.1
INSERT INTO blockchains (key, name, short_name, image) VALUES
  ('eip155:1', 'Ethereum Mainnet', 'ETH', 'https://cryptologos.cc/logos/ethereum-eth-logo.png'),
  ('bip122:000000000019d6689c085ae165831e93', 'Bitcoin', 'BTC', 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'),
  ('eip155:56', 'Binance Smart Chain', 'BSC', 'https://cryptologos.cc/logos/bnb-bnb-logo.png'),
  ('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'Solana', 'SOL', 'https://cryptologos.cc/logos/solana-sol-logo.png')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  image = EXCLUDED.image;
