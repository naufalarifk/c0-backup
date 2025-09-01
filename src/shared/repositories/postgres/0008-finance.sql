CREATE TABLE IF NOT EXISTS currencies (
  blockchain_key VARCHAR(64) NOT NULL REFERENCES blockchains (key),
  token_id VARCHAR(64) NOT NULL, -- specification: https://chainagnostic.org/CAIPs/caip-19
  name VARCHAR(64) NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  decimals INT NOT NULL,
  image TEXT NOT NULL,
  withdrawal_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  min_withdrawal_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  max_withdrawal_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  max_daily_withdrawal_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  min_loan_principal_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  max_loan_principal_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  max_ltv DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ltv_warning_threshold DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ltv_critical_threshold DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ltv_liquidation_threshold DECIMAL(8, 4) NOT NULL DEFAULT 0,
  PRIMARY KEY (blockchain_key, token_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id),
  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,
  account_type VARCHAR(16) DEFAULT 'User',
  balance BIGINT NOT NULL DEFAULT 0,
  FOREIGN KEY (currency_blockchain_key, currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  UNIQUE (user_id, currency_blockchain_key, currency_token_id, account_type),
  CHECK (
    (user_id = 1 AND account_type IN ('PlatformEscrow', 'PlatformFee')) OR
    (user_id != 1 AND account_type IN ('User'))
  )
);

CREATE TABLE IF NOT EXISTS account_mutations (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts (id),
  mutation_type VARCHAR(64) NOT NULL CHECK (mutation_type IN (
    -- Invoice operations
    'InvoicePrepaid', 'InvoiceReceived',
    -- Loan operations - borrower perspective
    'LoanCollateralDeposit', 'LoanApplicationCollateralEscrowed', 'LoanPrincipalDisbursement', 'LoanDisbursementReceived',
    'LoanPrincipalDisbursementFee', 'LoanRepayment', 'LoanCollateralRelease', 'LoanCollateralReturned',
    'LoanCollateralReleased', 'LoanLiquidationRelease', 'LoanLiquidationSurplus', 'LoanLiquidationReleaseFee',
    -- Loan operations - lender perspective
    'LoanPrincipalFunded', 'LoanOfferPrincipalEscrowed', 'LoanPrincipalReturned', 'LoanPrincipalReturnedFee',
    'LoanInterestReceived', 'LoanRepaymentReceived', 'LoanLiquidationRepayment',
    -- Loan operations - platform perspective
    'LoanDisbursementPrincipal', 'LoanDisbursementFee', 'LoanReturnFee', 'LoanLiquidationFee', 'LoanLiquidationCollateralUsed',
    -- Withdrawal operations
    'WithdrawalRequested', 'WithdrawalRefunded',
    -- Platform fee operations
    'PlatformFeeCharged', 'PlatformFeeRefunded',
    -- Admin and emergency operations
    'AdminManualAdjustment', 'LiquidationDeficitCover', 'PlatformLoss', 'EmergencyFreeze',
    'EmergencyUnfreeze', 'ComplianceHold', 'ComplianceRelease'
  )),
  mutation_date TIMESTAMP NOT NULL,
  amount BIGINT NOT NULL
);

--- VIEW ---

CREATE OR REPLACE VIEW account_mutation_entries AS
  SELECT
    accounts.user_id,
    accounts.currency_blockchain_key,
    accounts.currency_token_id,
    accounts.account_type,
    account_mutations.mutation_type,
    account_mutations.mutation_date,
    account_mutations.amount
  FROM accounts
  INNER JOIN account_mutations ON accounts.id = account_mutations.account_id;

CREATE OR REPLACE FUNCTION record_account_mutation_entry()
RETURNS TRIGGER AS $$
DECLARE
  account_id BIGINT;
BEGIN
  INSERT INTO accounts (user_id, currency_blockchain_key, currency_token_id, account_type)
  VALUES (NEW.user_id, NEW.currency_blockchain_key, NEW.currency_token_id, NEW.account_type)
  ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type) DO NOTHING
  RETURNING id INTO account_id;

  INSERT INTO account_mutations (account_id, mutation_type, mutation_date, amount)
  VALUES (
    account_id,
    NEW.mutation_type,
    NEW.mutation_date,
    NEW.amount
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER record_account_mutation_entry_trigger
INSTEAD OF INSERT ON account_mutation_entries
FOR EACH ROW
EXECUTE FUNCTION record_account_mutation_entry();

--- TRIGGER ---

CREATE OR REPLACE FUNCTION validate_account_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount = -NEW.amount AND NEW.amount != 0 THEN
    RAISE EXCEPTION 'Account mutation amount cannot be NaN';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_account_mutation_trigger
BEFORE INSERT ON account_mutations
FOR EACH ROW
EXECUTE FUNCTION validate_account_mutation();

CREATE OR REPLACE FUNCTION apply_account_mutation()
RETURNS TRIGGER AS $$
DECLARE
  new_balance BIGINT;
  current_balance BIGINT;
BEGIN
  SELECT balance INTO current_balance
  FROM accounts
  WHERE id = NEW.account_id;

  new_balance := current_balance + NEW.amount;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance on %. Current: %, Requested change: %, Resulting: %',
      NEW.mutation_type, current_balance, NEW.amount, new_balance;
  END IF;

  UPDATE accounts
  SET balance = new_balance
  WHERE id = NEW.account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER apply_account_mutation_trigger
AFTER INSERT ON account_mutations
FOR EACH ROW
EXECUTE FUNCTION apply_account_mutation();


--- PLATFORM FIXED DATA ---

-- Insert supported currencies as defined in SRS-CD-v2.3-EN.md Section 1.2.1
-- Only supports: Bitcoin (BTC), Ethereum (ETH), BNB, Solana (SOL) as collateral
-- Loans only in USDT on BNB (BEP-20)
INSERT INTO currencies (
  blockchain_key, token_id, name, symbol, decimals, image,
  min_loan_principal_amount, max_loan_principal_amount,
  max_ltv, ltv_warning_threshold, ltv_critical_threshold, ltv_liquidation_threshold,
  min_withdrawal_amount
) VALUES
  -- Native Bitcoin (collateral only)
  ('bip122:000000000019d6689c085ae165831e93', 'slip44:0', 'Bitcoin', 'BTC', 8, 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
   '0', '0', 60.0, 75.0, 70.0, 60.0, '0'), -- BTC as collateral: 60% max LTV (CONF-002)
  -- Native Ethereum (collateral only)
  ('eip155:1', 'slip44:60', 'Ethereum', 'ETH', 18, 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
   '0', '0', 60.0, 75.0, 70.0, 60.0, '0'), -- ETH as collateral: 70% max LTV (CONF-002)
  -- Native BNB on BSC (collateral only)
  ('eip155:56', 'slip44:714', 'Binance Coin', 'BNB', 18, 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
   '0', '0', 60.0, 75.0, 70.0, 60.0, '0'), -- BNB as collateral: 50% max LTV (CONF-002)
  -- USDT on BSC (BEP-20) - loan currency
  ('eip155:56', 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'Binance-Peg USD Coin', 'USDC', 18, 'https://cryptologos.cc/logos/tether-usdt-logo.png',
   '0', '0', 0, 0, 0, 0, '0'), -- Individual: 500 USDT, withdrawal: 100 USDT (CONF-003)
  -- Native SOL on Solana (collateral only)
  ('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'slip44:501', 'Solana', 'SOL', 9, 'https://cryptologos.cc/logos/solana-sol-logo.png',
   '0', '0', 60.0, 75.0, 70.0, 60.0, '0'), -- SOL as collateral: 50% max LTV (CONF-002)
  -- Generic USD Token, the platform requires user to hold cross chain USD-Pegged Token
  ('crosschain', 'iso4217:usd', 'USD Token', 'USD', 6, 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
   '0', '0', 0, 0, 0, 0, '0') -- For internal calculations only
ON CONFLICT (blockchain_key, token_id) DO UPDATE SET
  min_loan_principal_amount = EXCLUDED.min_loan_principal_amount,
  max_loan_principal_amount = EXCLUDED.max_loan_principal_amount,
  max_ltv = EXCLUDED.max_ltv,
  ltv_warning_threshold = EXCLUDED.ltv_warning_threshold,
  ltv_critical_threshold = EXCLUDED.ltv_critical_threshold,
  ltv_liquidation_threshold = EXCLUDED.ltv_liquidation_threshold,
  min_withdrawal_amount = EXCLUDED.min_withdrawal_amount;

-- user_id 1 is the platform account, they are responsible for recording escrow, fee, etc.
INSERT INTO accounts (user_id, currency_blockchain_key, currency_token_id, balance, account_type) VALUES
  (1, 'bip122:000000000019d6689c085ae165831e93', 'slip44:0', 0, 'PlatformEscrow'),
  (1, 'eip155:1', 'slip44:60', 0, 'PlatformEscrow'),
  (1, 'eip155:56', 'slip44:714', 0, 'PlatformEscrow'),
  (1, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'slip44:501', 0, 'PlatformEscrow'),
  (1, 'crosschain', 'iso4217:usd', 0, 'PlatformFee')
ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type) DO NOTHING;
