-- Settlement distributions table for tracking multi-source settlement operations
-- Groups multiple settlement logs from different blockchains for a single settlement operation
CREATE TABLE IF NOT EXISTS settlement_distributions (
  id BIGSERIAL PRIMARY KEY,
  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,
  
  -- Distribution calculation
  total_platform_balance DECIMAL(78, 0) NOT NULL,
  binance_balance DECIMAL(78, 0) NOT NULL,
  target_balance DECIMAL(78, 0) NOT NULL,
  total_settlement_amount DECIMAL(78, 0) NOT NULL,
  
  -- Ratio tracking
  current_ratio DECIMAL(10, 4) NOT NULL,
  target_ratio DECIMAL(10, 4) NOT NULL DEFAULT 1.0000,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned', 'InProgress', 'Completed', 'PartiallyFailed', 'Failed')),
  sources_count INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  FOREIGN KEY (currency_blockchain_key, currency_token_id) REFERENCES currencies (blockchain_key, token_id)
);

-- Settlement logs table for tracking automated settlement transactions
-- Records all settlement operations from hot wallets to target network (Binance)

CREATE TABLE IF NOT EXISTS settlement_logs (
  distribution_id BIGINT REFERENCES settlement_distributions (id),
  id BIGSERIAL PRIMARY KEY,
  blockchain_key VARCHAR(64) NOT NULL REFERENCES blockchains (key),
  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,
  
  -- Balance tracking (in smallest unit: wei, satoshi, lamports, etc.)
  original_balance DECIMAL(78, 0) NOT NULL,
  settlement_amount DECIMAL(78, 0) NOT NULL,
  remaining_balance DECIMAL(78, 0) NOT NULL,
  
  -- Distribution tracking (for multi-source settlements)
  total_platform_balance DECIMAL(78, 0),
  target_balance DECIMAL(78, 0),
  distribution_percentage DECIMAL(5, 2),
  current_ratio DECIMAL(10, 4),
  
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

-- Settlement distributions indexes
CREATE INDEX IF NOT EXISTS idx_settlement_distributions_currency ON settlement_distributions(currency_blockchain_key, currency_token_id);
CREATE INDEX IF NOT EXISTS idx_settlement_distributions_created_at ON settlement_distributions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_distributions_status ON settlement_distributions(status);

-- Settlement logs indexes
CREATE INDEX IF NOT EXISTS idx_settlement_logs_distribution_id ON settlement_logs(distribution_id);
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

-- Update settlement_distributions status based on settlement_logs
CREATE OR REPLACE FUNCTION update_distribution_status()
RETURNS TRIGGER AS $$
DECLARE
  dist_id BIGINT;
  total_count INT;
  completed_count INT;
  failed_count INT;
BEGIN
  -- Get distribution_id from the changed settlement log
  dist_id := COALESCE(NEW.distribution_id, OLD.distribution_id);
  
  -- Skip if no distribution_id
  IF dist_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count settlements by status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'Verified'),
    COUNT(*) FILTER (WHERE status = 'Failed')
  INTO total_count, completed_count, failed_count
  FROM settlement_logs
  WHERE distribution_id = dist_id;
  
  -- Update distribution status
  UPDATE settlement_distributions
  SET
    completed_count = completed_count,
    failed_count = failed_count,
    status = CASE
      WHEN completed_count = sources_count THEN 'Completed'
      WHEN failed_count = sources_count THEN 'Failed'
      WHEN completed_count + failed_count = sources_count AND failed_count > 0 THEN 'PartiallyFailed'
      WHEN completed_count + failed_count < sources_count THEN 'InProgress'
      ELSE status
    END,
    completed_at = CASE
      WHEN completed_count + failed_count = sources_count THEN NOW()
      ELSE completed_at
    END
  WHERE id = dist_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_distribution_status ON settlement_logs;
CREATE TRIGGER trg_update_distribution_status
  AFTER INSERT OR UPDATE OF status ON settlement_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_distribution_status();

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
  sl.distribution_id,
  sl.blockchain_key,
  sl.currency_blockchain_key,
  sl.currency_token_id,
  c.symbol AS currency_symbol,
  c.decimals AS currency_decimals,
  sl.original_balance,
  sl.settlement_amount,
  sl.remaining_balance,
  sl.total_platform_balance,
  sl.target_balance,
  sl.distribution_percentage,
  sl.current_ratio,
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
  sv.verification_attempt,
  sd.total_settlement_amount AS distribution_total_amount,
  sd.sources_count AS distribution_sources_count,
  sd.status AS distribution_status
FROM settlement_logs sl
LEFT JOIN settlement_verifications sv ON sl.id = sv.settlement_log_id
LEFT JOIN settlement_distributions sd ON sl.distribution_id = sd.id
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

-- View for settlement distributions with detailed breakdown
CREATE OR REPLACE VIEW settlement_distributions_with_details AS
SELECT
  sd.id,
  sd.currency_blockchain_key,
  sd.currency_token_id,
  c.symbol AS currency_symbol,
  c.decimals AS currency_decimals,
  sd.total_platform_balance,
  sd.binance_balance,
  sd.target_balance,
  sd.total_settlement_amount,
  sd.current_ratio,
  sd.target_ratio,
  sd.status,
  sd.sources_count,
  sd.completed_count,
  sd.failed_count,
  sd.created_at,
  sd.started_at,
  sd.completed_at,
  jsonb_agg(
    jsonb_build_object(
      'blockchain_key', sl.blockchain_key,
      'settlement_amount', sl.settlement_amount,
      'distribution_percentage', sl.distribution_percentage,
      'transaction_hash', sl.transaction_hash,
      'status', sl.status,
      'settled_at', sl.settled_at
    ) ORDER BY sl.distribution_percentage DESC
  ) FILTER (WHERE sl.id IS NOT NULL) AS settlements
FROM settlement_distributions sd
LEFT JOIN settlement_logs sl ON sd.id = sl.distribution_id
LEFT JOIN currencies c ON sd.currency_blockchain_key = c.blockchain_key 
  AND sd.currency_token_id = c.token_id
GROUP BY sd.id, c.symbol, c.decimals;

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

COMMENT ON TABLE settlement_distributions IS 'Groups multiple settlement operations from different blockchains for a single multi-source settlement';
COMMENT ON TABLE settlement_logs IS 'Logs all automated settlement transactions from blockchain hot wallets to Binance network with per-chain, per-token tracking';
COMMENT ON TABLE settlement_verifications IS 'Detailed verification records for each settlement transaction, cross-referencing blockchain and Binance data';
COMMENT ON TABLE settlement_reconciliation_reports IS 'Daily reconciliation summary reports for settlement operations';

COMMENT ON COLUMN settlement_distributions.currency_blockchain_key IS 'Currency blockchain network for this distribution';
COMMENT ON COLUMN settlement_distributions.currency_token_id IS 'Token identifier being settled';
COMMENT ON COLUMN settlement_distributions.total_platform_balance IS 'Total balance across all platform sources at time of calculation';
COMMENT ON COLUMN settlement_distributions.binance_balance IS 'Binance balance at time of calculation';
COMMENT ON COLUMN settlement_distributions.target_balance IS 'Target balance for each side to achieve 1:1 ratio';
COMMENT ON COLUMN settlement_distributions.total_settlement_amount IS 'Total amount to be settled across all sources';
COMMENT ON COLUMN settlement_distributions.current_ratio IS 'Platform to Binance ratio before settlement (platform/binance)';
COMMENT ON COLUMN settlement_distributions.target_ratio IS 'Target ratio after settlement (always 1.0 for 1:1)';
COMMENT ON COLUMN settlement_distributions.status IS 'Distribution status: Planned, InProgress, Completed, PartiallyFailed, Failed';
COMMENT ON COLUMN settlement_distributions.sources_count IS 'Number of blockchain sources in this distribution';
COMMENT ON COLUMN settlement_distributions.completed_count IS 'Number of successfully completed settlements';
COMMENT ON COLUMN settlement_distributions.failed_count IS 'Number of failed settlements';

COMMENT ON COLUMN settlement_logs.distribution_id IS 'Reference to the parent distribution (for multi-source settlements)';
COMMENT ON COLUMN settlement_logs.blockchain_key IS 'Source blockchain network (CAIP-2 format)';
COMMENT ON COLUMN settlement_logs.currency_blockchain_key IS 'Currency blockchain network (may differ from source for tokens)';
COMMENT ON COLUMN settlement_logs.currency_token_id IS 'Token identifier (CAIP-19 format)';
COMMENT ON COLUMN settlement_logs.original_balance IS 'Original balance before settlement in smallest unit (wei, satoshi, lamports, etc.)';
COMMENT ON COLUMN settlement_logs.settlement_amount IS 'Amount transferred in settlement in smallest unit';
COMMENT ON COLUMN settlement_logs.remaining_balance IS 'Remaining balance after settlement in smallest unit';
COMMENT ON COLUMN settlement_logs.total_platform_balance IS 'Total platform balance across all sources when settlement was calculated';
COMMENT ON COLUMN settlement_logs.target_balance IS 'Target balance for 1:1 ratio (half of total)';
COMMENT ON COLUMN settlement_logs.distribution_percentage IS 'Percentage of total settlement this source contributed (0-100)';
COMMENT ON COLUMN settlement_logs.current_ratio IS 'Platform to Binance ratio at time of settlement';
COMMENT ON COLUMN settlement_logs.transaction_hash IS 'Blockchain transaction hash for the settlement transfer';
COMMENT ON COLUMN settlement_logs.sender_address IS 'Hot wallet address that sent the funds';
COMMENT ON COLUMN settlement_logs.recipient_address IS 'Binance deposit address that received the funds';
COMMENT ON COLUMN settlement_logs.binance_asset IS 'Binance asset symbol (e.g., BTC, BNB, ETH, SOL, USDT)';
COMMENT ON COLUMN settlement_logs.binance_network IS 'Binance network name (e.g., BTC, BSC, ETH, SOL)';
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
