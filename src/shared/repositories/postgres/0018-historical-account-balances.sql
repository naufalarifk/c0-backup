--- HISTORICAL ACCOUNT BALANCES ---
-- This migration adds support for tracking historical account balance snapshots
-- Required for portfolio analytics and performance calculations

CREATE TABLE IF NOT EXISTS historical_account_balances (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance DECIMAL(78, 0) NOT NULL,
  valuation_usd DECIMAL(78, 0),
  snapshot_date TIMESTAMP NOT NULL,
  UNIQUE(account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_historical_balances_account_date
  ON historical_account_balances(account_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_historical_balances_date
  ON historical_account_balances(snapshot_date DESC);

COMMENT ON TABLE historical_account_balances IS 'Stores daily snapshots of account balances for historical tracking and performance calculations';
COMMENT ON COLUMN historical_account_balances.balance IS 'Account balance in smallest unit at snapshot time';
COMMENT ON COLUMN historical_account_balances.valuation_usd IS 'USD valuation in smallest unit (6 decimals) at snapshot time';
COMMENT ON COLUMN historical_account_balances.snapshot_date IS 'Timestamp when snapshot was taken';

--- ADD UPDATED_DATE TO ACCOUNTS TABLE ---
-- Track when account was last modified for accurate lastUpdated timestamps

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_accounts_updated_date
  ON accounts(updated_date DESC);

-- Trigger to update updated_date when account balance changes
CREATE OR REPLACE FUNCTION update_account_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_account_updated_date_trigger
BEFORE UPDATE ON accounts
FOR EACH ROW
WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION update_account_updated_date();
