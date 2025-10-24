CREATE TABLE IF NOT EXISTS currencies (
  blockchain_key VARCHAR(64) NOT NULL REFERENCES blockchains (key),
  token_id VARCHAR(64) NOT NULL, -- specification: https://chainagnostic.org/CAIPs/caip-19
  name VARCHAR(64) NOT NULL,
  symbol VARCHAR(16) NOT NULL, -- add binance symbol for binance network
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
  balance DECIMAL(78, 0) NOT NULL DEFAULT 0,
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
    'EmergencyUnfreeze', 'ComplianceHold', 'ComplianceRelease', 'TestBalanceAdjustment'
  )),
  mutation_date TIMESTAMP NOT NULL,
  amount DECIMAL(78, 0) NOT NULL
);

-- Drop view before altering columns it depends on
DROP VIEW IF EXISTS account_mutation_entries CASCADE;

ALTER TABLE account_mutations
  ALTER COLUMN amount TYPE DECIMAL(78, 0) USING amount::DECIMAL(78, 0);

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
BEGIN
  INSERT INTO accounts (user_id, currency_blockchain_key, currency_token_id, account_type)
  VALUES (NEW.user_id, NEW.currency_blockchain_key, NEW.currency_token_id, NEW.account_type)
  ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type) DO NOTHING;

  INSERT INTO account_mutations (account_id, mutation_type, mutation_date, amount)
  VALUES (
    (
      SELECT id FROM accounts
      WHERE user_id = NEW.user_id
        AND currency_blockchain_key = NEW.currency_blockchain_key
        AND currency_token_id = NEW.currency_token_id
        AND account_type = NEW.account_type
    ),
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
  new_balance NUMERIC;
  current_balance NUMERIC;
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
   '0', '0', 0.60, 0.48, 0.57, 0.60, '0'), -- BTC as collateral: 60% max LTV (CONF-002)
  -- Native Ethereum (collateral only)
  ('eip155:1', 'slip44:60', 'Ethereum', 'ETH', 18, 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
   '0', '0', 0.70, 0.56, 0.665, 0.70, '0'), -- ETH as collateral: 70% max LTV (CONF-002)
  -- Native BNB on BSC (collateral only)
  ('eip155:56', 'slip44:714', 'Binance Coin', 'BNB', 18, 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
   '0', '0', 0.50, 0.40, 0.475, 0.50, '0'), -- BNB as collateral: 50% max LTV (CONF-002)
  -- USDC on BSC (BEP-20) - loan currency
  ('eip155:56', 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'Binance-Peg USD Coin', 'USDC', 18, 'https://cryptologos.cc/logos/tether-usdt-logo.png',
   '500000000000000000000', '0', 0, 0, 0, 0, '100000000000000000000'), -- Min 500 USDC for loans, Min 100 USDC for withdrawals
  -- Native SOL on Solana (collateral only)
  ('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'slip44:501', 'Solana', 'SOL', 9, 'https://cryptologos.cc/logos/solana-sol-logo.png',
   '0', '0', 0.50, 0.40, 0.475, 0.50, '0'), -- SOL as collateral: 50% max LTV (CONF-002)
  -- Generic USD Token, the platform requires user to hold cross chain USD-Pegged Token
  ('crosschain', 'iso4217:usd', 'USD Token', 'USD', 6, 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  -- Generic Bitcoin, this currency refers to bitcoin generic BTC.
  ('crosschain', 'slip44:0', 'Bitcoin', 'BTC', 8, 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  -- Generic Ethereum, this currency refers to ethereum generic ETH.
  ('crosschain', 'slip44:60', 'Ethereum', 'ETH', 18, 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  -- Generic BNB Coin, this currency refers to binance generic BNB Coin.
  ('crosschain', 'slip44:714', 'Binance Coin', 'BNB', 18, 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  -- Generic Solana, this currency refers to solana generic SOL.
  ('crosschain', 'slip44:501', 'Solana', 'SOL', 9, 'https://cryptologos.cc/logos/solana-sol-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  -- USDC Solana Devnet (principal only)
  ('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'spl:CGUsdwgPH4mMEQoA3ZMi2C2aiJywFb3x5SrMFt2F9dj4', 'USD Coin', 'USDC', 6, 'https://bafkreibml7m7nffhrjirkqtev7yihxt57ftljzabx3fws3ccbdqt4e22pi.ipfs.dweb.link/',
   '100000000', '100000000000', 0, 0, 0, 0, '0'), -- Min 100 USDC for loans
  -- USDC Ethereum Hoodi (principal only)
  ('eip155:560048', 'erc20:0xC51A8BFa4E9b5508B235014Cfe21Bf9232F6Ae9B', 'USD Coin', 'USDC', 6, 'https://bafkreibml7m7nffhrjirkqtev7yihxt57ftljzabx3fws3ccbdqt4e22pi.ipfs.dweb.link/',
   '100000000', '100000000000', 0, 0, 0, 0, '0'), -- Min 100 USDC for loans
  -- USDC BSC Testnet (principal only)
  ('eip155:97', 'erc20:0xC51A8BFa4E9b5508B235014Cfe21Bf9232F6Ae9B', 'USD Coin', 'USDC', 6, 'https://bafkreibml7m7nffhrjirkqtev7yihxt57ftljzabx3fws3ccbdqt4e22pi.ipfs.dweb.link/',
   '100000000', '100000000000', 0, 0, 0, 0, '0') -- Min 100 USDC for loans
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

-- Testnet / Devnet currencies: native coins and representative test stablecoins
INSERT INTO currencies (
  blockchain_key, token_id, name, symbol, decimals, image,
  min_loan_principal_amount, max_loan_principal_amount,
  max_ltv, ltv_warning_threshold, ltv_critical_threshold, ltv_liquidation_threshold,
  min_withdrawal_amount
) VALUES
  ('bip122:000000000933ea01ad0ee984209779ba', 'slip44:0', 'Bitcoin Testnet', 'TBTC', 8, 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  ('eip155:11155111', 'slip44:60', 'Sepolia ETH', 'ETH', 18, 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  ('eip155:560048', 'slip44:60', 'Hoodi ETH', 'ETH', 18, 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  ('eip155:97', 'slip44:714', 'BNB Testnet', 'BNB', 18, 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  ('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'slip44:501', 'Solana Devnet', 'SOL', 9, 'https://cryptologos.cc/logos/solana-sol-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  ('eip155:11155111', 'erc20:0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', 'USD Coin (Sepolia)', 'USDC', 6, 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
   '100000000', '100000000000', 0, 0, 0, 0, '0'), -- Sepolia USDC (100 USDC min)
  ('eip155:97', 'erc20:0x221c5b1a293aac1187ed3a7d7d2d9ad7fe1f3fb0', 'Tether USD (BSC Testnet)', 'USDT', 18, 'https://cryptologos.cc/logos/tether-usdt-logo.png',
   '0', '0', 0, 0, 0, 0, '0'), -- Example BEP-20 USDT on BSC testnet
  ('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'spl:Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', 'USD Coin (Solana Devnet)', 'USDC', 6, 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
   '0', '0', 0, 0, 0, 0, '0'),
  ('cg:testnet', 'mock:native', 'Mockchain Coin', 'MCK', 18, 'https://assets.cryptogadai.com/currencies/mockchain.png',
   '0', '0', 0.70, 0.56, 0.665, 0.70, '0'), -- MCK as collateral: 70% max LTV (same as ETH for testing)
  ('cg:testnet', 'mock:usd', 'Mockchain Dollar', 'USDT', 18, 'https://assets.cryptogadai.com/currencies/mockchain-usd.png',
   '100000000000000000000', '100000000000000000000000', 0, 0, 0, 0, '0')
ON CONFLICT (blockchain_key, token_id) DO UPDATE SET
  min_loan_principal_amount = EXCLUDED.min_loan_principal_amount,
  max_loan_principal_amount = EXCLUDED.max_loan_principal_amount,
  max_ltv = EXCLUDED.max_ltv,
  ltv_warning_threshold = EXCLUDED.ltv_warning_threshold,
  ltv_critical_threshold = EXCLUDED.ltv_critical_threshold,
  ltv_liquidation_threshold = EXCLUDED.ltv_liquidation_threshold,
  min_withdrawal_amount = EXCLUDED.min_withdrawal_amount;

-- Platform accounts for testnets/devnets (user_id = 1)
INSERT INTO accounts (user_id, currency_blockchain_key, currency_token_id, balance, account_type) VALUES
  (1, 'bip122:000000000933ea01ad0ee984209779ba', 'slip44:0', 0, 'PlatformEscrow'),
  (1, 'eip155:11155111', 'slip44:60', 0, 'PlatformEscrow'),
  (1, 'eip155:560048', 'slip44:60', 0, 'PlatformEscrow'),
  (1, 'eip155:97', 'slip44:714', 0, 'PlatformEscrow'),
  (1, 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'slip44:501', 0, 'PlatformEscrow'),
  (1, 'eip155:11155111', 'erc20:0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', 0, 'PlatformEscrow'),
  (1, 'eip155:97', 'erc20:0x221c5b1a293aac1187ed3a7d7d2d9ad7fe1f3fb0', 0, 'PlatformEscrow'),
  (1, 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'spl:Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', 0, 'PlatformEscrow'),
  (1, 'cg:testnet', 'mock:native', 0, 'PlatformEscrow'),
  (1, 'cg:testnet', 'mock:usd', 0, 'PlatformEscrow')
ON CONFLICT (user_id, currency_blockchain_key, currency_token_id, account_type) DO NOTHING;
