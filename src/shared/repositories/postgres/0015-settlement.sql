-- Settlement logs table for tracking automated settlement transactions
-- Records all settlement operations from hot wallets to target network (Binance)

CREATE TABLE IF NOT EXISTS settlement_logs (
  id BIGSERIAL PRIMARY KEY,
  blockchain_key VARCHAR(64) NOT NULL REFERENCES blockchains (key),
  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,
  
  -- Balance tracking (in smallest unit: wei, satoshi, lamports, etc.)
  original_balance DECIMAL(78, 0) NOT NULL,
  settlement_amount DECIMAL(78, 0) NOT NULL,
  remaining_balance DECIMAL(78, 0) NOT NULL,
  
  -- Transaction details
  transaction_hash VARCHAR(255),
  sender_address VARCHAR(255),
  recipient_address VARCHAR(255) NOT NULL,
  
  -- Binance integration
  binance_asset VARCHAR(16),
  binance_network VARCHAR(16),
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent', 'Verified', 'Failed')),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  
  -- Timestamps
  settled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  verified_at TIMESTAMP,
  failed_at TIMESTAMP,
  
  -- Verification details
  verified BOOLEAN DEFAULT false,
  verification_error TEXT,
  verification_details JSONB,
  
  FOREIGN KEY (currency_blockchain_key, currency_token_id) REFERENCES currencies (blockchain_key, token_id)
);

-- Settlement verification records table
-- Tracks detailed verification of each settlement transaction
CREATE TABLE IF NOT EXISTS settlement_verifications (
  id BIGSERIAL PRIMARY KEY,
  settlement_log_id BIGINT NOT NULL REFERENCES settlement_logs (id),
  
  -- Verification checks
  blockchain_confirmed BOOLEAN NOT NULL DEFAULT false,
  binance_matched BOOLEAN NOT NULL DEFAULT false,
  amount_matches BOOLEAN NOT NULL DEFAULT false,
  tx_hash_matches BOOLEAN NOT NULL DEFAULT false,
  sender_address_matches BOOLEAN NOT NULL DEFAULT false,
  recipient_address_matches BOOLEAN NOT NULL DEFAULT false,
  
  -- Binance deposit details
  binance_deposit_id VARCHAR(64),
  binance_status VARCHAR(20), -- 'pending', 'credited', 'success'
  binance_confirmations VARCHAR(16), -- e.g., "12/12"
  binance_insert_time BIGINT,
  
  -- Verification result
  overall_matched BOOLEAN NOT NULL DEFAULT false,
  verification_message TEXT,
  verification_errors TEXT[],
  
  -- Metadata
  verified_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verification_attempt INT NOT NULL DEFAULT 1
);

-- Settlement reconciliation reports table
-- Stores daily/periodic reconciliation summaries
CREATE TABLE IF NOT EXISTS settlement_reconciliation_reports (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  
  -- Deposit statistics
  total_deposits INT NOT NULL DEFAULT 0,
  verified_deposits INT NOT NULL DEFAULT 0,
  failed_deposits INT NOT NULL DEFAULT 0,
  pending_deposits INT NOT NULL DEFAULT 0,
  
  -- Withdrawal statistics (for future use)
  total_withdrawals INT NOT NULL DEFAULT 0,
  verified_withdrawals INT NOT NULL DEFAULT 0,
  failed_withdrawals INT NOT NULL DEFAULT 0,
  pending_withdrawals INT NOT NULL DEFAULT 0,
  
  -- Financial summary (JSON by currency)
  total_amount_by_currency JSONB NOT NULL DEFAULT '{}',
  
  -- Discrepancies
  discrepancy_count INT NOT NULL DEFAULT 0,
  discrepancies JSONB,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

--- INDEXES ---

-- Settlement logs indexes
CREATE INDEX IF NOT EXISTS idx_settlement_logs_blockchain ON settlement_logs(blockchain_key);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_currency ON settlement_logs(currency_blockchain_key, currency_token_id);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_settled_at ON settlement_logs(settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_status ON settlement_logs(status);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_verified ON settlement_logs(verified);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_tx_hash ON settlement_logs(transaction_hash) WHERE transaction_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settlement_logs_failed ON settlement_logs(success) WHERE success = false;

-- Settlement verifications indexes
CREATE INDEX IF NOT EXISTS idx_settlement_verifications_log_id ON settlement_verifications(settlement_log_id);
CREATE INDEX IF NOT EXISTS idx_settlement_verifications_matched ON settlement_verifications(overall_matched);
CREATE INDEX IF NOT EXISTS idx_settlement_verifications_verified_at ON settlement_verifications(verified_at DESC);

-- Settlement reconciliation reports indexes
CREATE INDEX IF NOT EXISTS idx_settlement_reconciliation_reports_date ON settlement_reconciliation_reports(report_date DESC);

--- TRIGGERS ---

-- Update settlement_logs status based on verification
CREATE OR REPLACE FUNCTION update_settlement_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the settlement log status based on verification result
  UPDATE settlement_logs
  SET 
    status = CASE
      WHEN NEW.overall_matched = true THEN 'Verified'
      WHEN NEW.overall_matched = false AND NEW.verification_attempt >= 3 THEN 'Failed'
      ELSE status
    END,
    verified = NEW.overall_matched,
    verified_at = CASE WHEN NEW.overall_matched = true THEN NEW.verified_at ELSE verified_at END,
    verification_error = NEW.verification_message,
    verification_details = jsonb_build_object(
      'blockchain_confirmed', NEW.blockchain_confirmed,
      'binance_matched', NEW.binance_matched,
      'amount_matches', NEW.amount_matches,
      'tx_hash_matches', NEW.tx_hash_matches,
      'sender_address_matches', NEW.sender_address_matches,
      'recipient_address_matches', NEW.recipient_address_matches,
      'binance_status', NEW.binance_status,
      'errors', NEW.verification_errors
    )
  WHERE id = NEW.settlement_log_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_settlement_status ON settlement_verifications;
CREATE TRIGGER trg_update_settlement_status
  AFTER INSERT ON settlement_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_settlement_status();

-- Auto-update updated_at timestamp for reconciliation reports
CREATE OR REPLACE FUNCTION update_reconciliation_report_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_reconciliation_report_timestamp ON settlement_reconciliation_reports;
CREATE TRIGGER trg_update_reconciliation_report_timestamp
  BEFORE UPDATE ON settlement_reconciliation_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reconciliation_report_timestamp();

--- VIEWS ---

-- View for easy querying of settlement logs with verification status
CREATE OR REPLACE VIEW settlement_logs_with_verification AS
SELECT
  sl.id,
  sl.blockchain_key,
  sl.currency_blockchain_key,
  sl.currency_token_id,
  c.symbol AS currency_symbol,
  c.decimals AS currency_decimals,
  sl.original_balance,
  sl.settlement_amount,
  sl.remaining_balance,
  sl.transaction_hash,
  sl.sender_address,
  sl.recipient_address,
  sl.binance_asset,
  sl.binance_network,
  sl.status,
  sl.success,
  sl.error_message,
  sl.settled_at,
  sl.sent_at,
  sl.verified_at,
  sl.failed_at,
  sl.verified,
  sl.verification_error,
  sl.verification_details,
  sv.id AS verification_id,
  sv.overall_matched,
  sv.tx_hash_matches,
  sv.sender_address_matches,
  sv.recipient_address_matches,
  sv.amount_matches,
  sv.binance_status,
  sv.verification_errors,
  sv.verification_attempt
FROM settlement_logs sl
LEFT JOIN settlement_verifications sv ON sl.id = sv.settlement_log_id
LEFT JOIN currencies c ON sl.currency_blockchain_key = c.blockchain_key 
  AND sl.currency_token_id = c.token_id;

-- View for settlement statistics by currency
CREATE OR REPLACE VIEW settlement_stats_by_currency AS
SELECT
  sl.currency_blockchain_key,
  sl.currency_token_id,
  c.symbol AS currency_symbol,
  c.decimals AS currency_decimals,
  COUNT(*) AS total_settlements,
  COUNT(*) FILTER (WHERE sl.status = 'Verified') AS verified_count,
  COUNT(*) FILTER (WHERE sl.status = 'Failed') AS failed_count,
  COUNT(*) FILTER (WHERE sl.status = 'Pending') AS pending_count,
  SUM(sl.settlement_amount) AS total_amount_settled,
  SUM(sl.settlement_amount) FILTER (WHERE sl.status = 'Verified') AS total_amount_verified,
  MIN(sl.settled_at) AS first_settlement,
  MAX(sl.settled_at) AS last_settlement
FROM settlement_logs sl
LEFT JOIN currencies c ON sl.currency_blockchain_key = c.blockchain_key 
  AND sl.currency_token_id = c.token_id
GROUP BY sl.currency_blockchain_key, sl.currency_token_id, c.symbol, c.decimals;

-- View for recent unverified settlements (needs attention)
CREATE OR REPLACE VIEW unverified_settlements AS
SELECT
  sl.id,
  sl.blockchain_key,
  sl.currency_blockchain_key,
  sl.currency_token_id,
  c.symbol AS currency_symbol,
  sl.settlement_amount,
  sl.transaction_hash,
  sl.status,
  sl.settled_at,
  EXTRACT(EPOCH FROM (NOW() - sl.settled_at)) / 60 AS minutes_since_settlement,
  COALESCE(sv.verification_attempt, 0) AS verification_attempts
FROM settlement_logs sl
LEFT JOIN currencies c ON sl.currency_blockchain_key = c.blockchain_key 
  AND sl.currency_token_id = c.token_id
LEFT JOIN settlement_verifications sv ON sl.id = sv.settlement_log_id
WHERE sl.status IN ('Pending', 'Sent')
  AND sl.settled_at > NOW() - INTERVAL '24 hours'
ORDER BY sl.settled_at DESC;

--- COMMENTS ---

COMMENT ON TABLE settlement_logs IS 'Logs all automated settlement transactions from blockchain hot wallets to Binance network with per-chain, per-token tracking';
COMMENT ON TABLE settlement_verifications IS 'Detailed verification records for each settlement transaction, cross-referencing blockchain and Binance data';
COMMENT ON TABLE settlement_reconciliation_reports IS 'Daily reconciliation summary reports for settlement operations';

COMMENT ON COLUMN settlement_logs.blockchain_key IS 'Source blockchain network (CAIP-2 format)';
COMMENT ON COLUMN settlement_logs.currency_blockchain_key IS 'Currency blockchain network (may differ from source for tokens)';
COMMENT ON COLUMN settlement_logs.currency_token_id IS 'Token identifier (CAIP-19 format)';
COMMENT ON COLUMN settlement_logs.original_balance IS 'Original balance before settlement in smallest unit (wei, satoshi, lamports, etc.)';
COMMENT ON COLUMN settlement_logs.settlement_amount IS 'Amount transferred in settlement in smallest unit';
COMMENT ON COLUMN settlement_logs.remaining_balance IS 'Remaining balance after settlement in smallest unit';
COMMENT ON COLUMN settlement_logs.transaction_hash IS 'Blockchain transaction hash for the settlement transfer';
COMMENT ON COLUMN settlement_logs.sender_address IS 'Hot wallet address that sent the funds';
COMMENT ON COLUMN settlement_logs.recipient_address IS 'Binance deposit address that received the funds';
COMMENT ON COLUMN settlement_logs.binance_asset IS 'Binance asset symbol (e.g., BNB, USDT)';
COMMENT ON COLUMN settlement_logs.binance_network IS 'Binance network name (e.g., BSC, ETH, SOL)';
COMMENT ON COLUMN settlement_logs.status IS 'Settlement status: Pending, Sent, Verified, Failed';
COMMENT ON COLUMN settlement_logs.success IS 'Whether the settlement transaction was successfully sent';
COMMENT ON COLUMN settlement_logs.error_message IS 'Error message if settlement failed';
COMMENT ON COLUMN settlement_logs.settled_at IS 'Timestamp when settlement was initiated';
COMMENT ON COLUMN settlement_logs.sent_at IS 'Timestamp when transaction was sent to blockchain';
COMMENT ON COLUMN settlement_logs.verified_at IS 'Timestamp when settlement was verified in Binance';
COMMENT ON COLUMN settlement_logs.failed_at IS 'Timestamp when settlement failed';
COMMENT ON COLUMN settlement_logs.verified IS 'Whether settlement was verified in Binance deposit history';
COMMENT ON COLUMN settlement_logs.verification_error IS 'Error message from verification process';
COMMENT ON COLUMN settlement_logs.verification_details IS 'JSON object containing detailed verification results';

COMMENT ON COLUMN settlement_verifications.settlement_log_id IS 'Reference to the settlement log being verified';
COMMENT ON COLUMN settlement_verifications.blockchain_confirmed IS 'Whether transaction is confirmed on blockchain';
COMMENT ON COLUMN settlement_verifications.binance_matched IS 'Whether transaction found in Binance deposit history';
COMMENT ON COLUMN settlement_verifications.amount_matches IS 'Whether transfer amount matches Binance recorded amount';
COMMENT ON COLUMN settlement_verifications.tx_hash_matches IS 'Whether transaction hash matches Binance txId';
COMMENT ON COLUMN settlement_verifications.sender_address_matches IS 'Whether sender address matches expected hot wallet';
COMMENT ON COLUMN settlement_verifications.recipient_address_matches IS 'Whether recipient matches Binance deposit address';
COMMENT ON COLUMN settlement_verifications.binance_deposit_id IS 'Binance internal deposit ID';
COMMENT ON COLUMN settlement_verifications.binance_status IS 'Binance deposit status: pending, credited, success';
COMMENT ON COLUMN settlement_verifications.binance_confirmations IS 'Binance confirmation count (e.g., "12/12")';
COMMENT ON COLUMN settlement_verifications.overall_matched IS 'Whether all verification checks passed';
COMMENT ON COLUMN settlement_verifications.verification_message IS 'Human-readable verification result message';
COMMENT ON COLUMN settlement_verifications.verification_errors IS 'Array of verification error messages';
COMMENT ON COLUMN settlement_verifications.verification_attempt IS 'Number of verification attempts for this settlement';
