-- Settlement logs table for tracking automated settlement transactions
-- Records all settlement operations from hot wallets to target network (Binance)

CREATE TABLE IF NOT EXISTS settlement_logs (
  id BIGSERIAL PRIMARY KEY,
  blockchain_key VARCHAR(64) NOT NULL REFERENCES blockchains (key),
  original_balance DECIMAL(78, 0) NOT NULL,
  settlement_amount DECIMAL(78, 0) NOT NULL,
  remaining_balance DECIMAL(78, 0) NOT NULL,
  transaction_hash VARCHAR(255),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  settled_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for querying settlements by blockchain
CREATE INDEX IF NOT EXISTS idx_settlement_logs_blockchain ON settlement_logs(blockchain_key);

-- Index for querying settlements by timestamp (most recent first)
CREATE INDEX IF NOT EXISTS idx_settlement_logs_settled_at ON settlement_logs(settled_at DESC);

-- Index for querying failed settlements
CREATE INDEX IF NOT EXISTS idx_settlement_logs_failed ON settlement_logs(success) WHERE success = false;

-- Comments for documentation
COMMENT ON TABLE settlement_logs IS 'Logs all automated settlement transactions from blockchain hot wallets to Binance network';
COMMENT ON COLUMN settlement_logs.blockchain_key IS 'Source blockchain network (CAIP-2 format)';
COMMENT ON COLUMN settlement_logs.original_balance IS 'Original balance before settlement in smallest unit (wei, satoshi, etc.)';
COMMENT ON COLUMN settlement_logs.settlement_amount IS 'Amount transferred in settlement in smallest unit';
COMMENT ON COLUMN settlement_logs.remaining_balance IS 'Remaining balance after settlement in smallest unit';
COMMENT ON COLUMN settlement_logs.transaction_hash IS 'Blockchain transaction hash for the settlement transfer';
COMMENT ON COLUMN settlement_logs.success IS 'Whether the settlement was successful';
COMMENT ON COLUMN settlement_logs.error_message IS 'Error message if settlement failed';
COMMENT ON COLUMN settlement_logs.settled_at IS 'Timestamp when settlement was executed';
