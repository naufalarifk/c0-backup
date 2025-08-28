CREATE TABLE IF NOT EXISTS currencies (
  blockchain_key VARCHAR(64) NOT NULL,
  token_id VARCHAR(64) NOT NULL, -- specification: https://chainagnostic.org/CAIPs/caip-19
  name VARCHAR(64) NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  decimals INT NOT NULL,
  image TEXT NOT NULL,
  withdrawal_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  min_withdrawal_amount BIGINT NOT NULL DEFAULT 0,
  max_withdrawal_amount BIGINT NOT NULL DEFAULT 0,
  min_application_principal_amount BIGINT NOT NULL DEFAULT 0,
  max_application_principal_amount BIGINT NOT NULL DEFAULT 0,
  max_ltv DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ltv_warning_threshold DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ltv_critical_threshold DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ltv_liquidation_threshold DECIMAL(8, 4) NOT NULL DEFAULT 0,
  PRIMARY KEY (blockchain_key, token_id),
  FOREIGN KEY (blockchain_key) REFERENCES blockchains (key)
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,
  account_type VARCHAR(32) DEFAULT 'user',
  balance BIGINT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (currency_blockchain_key, currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  UNIQUE (user_id, currency_blockchain_key, currency_token_id, account_type),
  CHECK (
    (user_id = 1 AND account_type IN ('platform_escrow', 'platform_fees')) OR
    (user_id != 1 AND account_type = 'user')
  )
);

CREATE TABLE IF NOT EXISTS account_mutations (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL,
  mutation_type VARCHAR(64) NOT NULL CHECK (mutation_type IN (
    -- Invoice operations
    'InvoiceReceived',
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
  amount BIGINT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts (id)
);

--- TRIGGER ---

CREATE OR REPLACE FUNCTION validate_account_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for NaN values
  IF NEW.amount = -NEW.amount AND NEW.amount != 0 THEN
    RAISE EXCEPTION 'Account mutation amount cannot be NaN';
  END IF;
  
  -- Ensure account_id exists
  IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id) THEN
    RAISE EXCEPTION 'Account with id % does not exist', NEW.account_id;
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
  -- Get current balance
  SELECT balance INTO current_balance
  FROM accounts
  WHERE id = NEW.account_id;
  
  -- Calculate new balance
  new_balance := current_balance + NEW.amount;
  
  -- Check for insufficient balance (only for negative mutations)
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Requested change: %, Resulting: %', 
      current_balance, NEW.amount, new_balance;
  END IF;
  
  -- Update account balance
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
-- Loans only in USDT on specific networks
INSERT INTO currencies (
  blockchain_key, token_id, name, symbol, decimals, image,
  min_application_principal_amount, max_application_principal_amount,
  max_ltv, ltv_warning_threshold, ltv_critical_threshold, ltv_liquidation_threshold,
  min_withdrawal_amount
) VALUES 
  -- Native Bitcoin (collateral only)
  ('bip122:000000000019d6689c085ae165831e93', 'slip44:0', 'Bitcoin', 'BTC', 8, 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
   0, 0, 0.60, 0.48, 0.57, 0.60, 0), -- BTC as collateral: 60% max LTV (CONF-002)
  -- Native Ethereum (collateral only)
  ('eip155:1', 'slip44:60', 'Ethereum', 'ETH', 18, 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
   0, 0, 0.70, 0.56, 0.665, 0.70, 0), -- ETH as collateral: 70% max LTV (CONF-002)
  -- USDT on Ethereum (ERC-20) - loan currency
  ('eip155:1', 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', 'Tether USD', 'USDT', 6, 'https://cryptologos.cc/logos/tether-usdt-logo.png',
   300000000, 0, 0, 0, 0, 0, 10000000), -- Individual: 3,000 USDT, withdrawal: 100 USDT (CONF-003)
  -- Native BNB on BSC (collateral only)  
  ('eip155:56', 'slip44:714', 'Binance Coin', 'BNB', 18, 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
   0, 0, 0.50, 0.40, 0.475, 0.50, 0), -- BNB as collateral: 50% max LTV (CONF-002)
  -- USDT on BSC (BEP-20) - loan currency
  ('eip155:56', 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'Binance-Peg USD Coin', 'USDC', 18, 'https://cryptologos.cc/logos/tether-usdt-logo.png',
   50000000, 0, 0, 0, 0, 0, 10000000), -- Individual: 500 USDT, withdrawal: 100 USDT (CONF-003)
  -- Native SOL on Solana (collateral only)
  ('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'slip44:501', 'Solana', 'SOL', 9, 'https://cryptologos.cc/logos/solana-sol-logo.png',
   0, 0, 0.50, 0.40, 0.475, 0.50, 0), -- SOL as collateral: 50% max LTV (CONF-002)
  -- USDT on Solana (SPL Token) - loan currency  
  ('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 'USDC', 6, 'https://cryptologos.cc/logos/tether-usdt-logo.png',
   50000000, 0, 0, 0, 0, 0, 10000000) -- Individual: 500 USDT, withdrawal: 100 USDT (CONF-003)
ON CONFLICT (blockchain_key, token_id) DO UPDATE SET
  max_ltv = EXCLUDED.max_ltv,
  ltv_warning_threshold = EXCLUDED.ltv_warning_threshold,
  ltv_critical_threshold = EXCLUDED.ltv_critical_threshold,
  ltv_liquidation_threshold = EXCLUDED.ltv_liquidation_threshold,
  min_application_principal_amount = EXCLUDED.min_application_principal_amount,
  min_withdrawal_amount = EXCLUDED.min_withdrawal_amount;

-- user_id 1 is the platform account, they are responsible for recording escrow, fee, etc.
INSERT INTO accounts (user_id, currency_blockchain_key, currency_token_id, balance, account_type) VALUES
  (1, 'eip155:1', 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', 0, 'platform_escrow'),
  (1, 'bip122:000000000019d6689c085ae165831e93', 'slip44:0', 0, 'platform_escrow'),
  (1, 'eip155:1', 'slip44:60', 0, 'platform_escrow'),
  (1, 'eip155:56', 'slip44:714', 0, 'platform_escrow'),
  (1, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'slip44:501', 0, 'platform_escrow'),
  (1, 'eip155:1', 'erc20:0xdac17f958d2ee523a2206206994597c13d831ec7', 0, 'platform_fees'),
  (1, 'bip122:000000000019d6689c085ae165831e93', 'slip44:0', 0, 'platform_fees'),
  (1, 'eip155:1', 'slip44:60', 0, 'platform_fees'),
  (1, 'eip155:56', 'slip44:714', 0, 'platform_fees'),
  (1, 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'slip44:501', 0, 'platform_fees')
ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type) DO NOTHING;
