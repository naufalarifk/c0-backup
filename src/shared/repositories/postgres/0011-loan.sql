--- SCHEMA ---

CREATE TABLE IF NOT EXISTS loan_offers (
  id BIGSERIAL PRIMARY KEY,

  lender_user_id BIGINT NOT NULL REFERENCES users (id),

  principal_currency_blockchain_key VARCHAR(64) NOT NULL,
  principal_currency_token_id VARCHAR(64) NOT NULL,

  offered_principal_prepaid_amount DECIMAL(78, 0) NOT NULL DEFAULT 0 CHECK (offered_principal_prepaid_amount >= 0),
  offered_principal_amount DECIMAL(78, 0) NOT NULL CHECK (offered_principal_amount > 0),
  disbursed_principal_amount DECIMAL(78, 0) NOT NULL DEFAULT 0 CHECK (disbursed_principal_amount >= 0),
  reserved_principal_amount DECIMAL(78, 0) NOT NULL DEFAULT 0 CHECK (reserved_principal_amount >= 0),
  available_principal_amount DECIMAL(78, 0) GENERATED ALWAYS AS (offered_principal_amount - disbursed_principal_amount - reserved_principal_amount) STORED,

  min_loan_principal_amount DECIMAL(78, 0) NOT NULL CHECK (min_loan_principal_amount > 0), -- defined by lender_user_id or derived from currencies.min_loan_principal_amount of principal_currency_token_id at creation
  max_loan_principal_amount DECIMAL(78, 0) NOT NULL CHECK (max_loan_principal_amount > 0), -- defined by lender_user_id or derived from currencies.max_loan_principal_amount of principal_currency_token_id at creation

  interest_rate DECIMAL(8, 4) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 100), -- 0 - 100, configured by lender_user_id
  term_in_months_options INT[] NOT NULL, -- Pilihan durasi pinjaman dalam bulan

  status VARCHAR(32) NOT NULL DEFAULT 'Funding' CHECK (status IN ('Funding', 'Published', 'Closed', 'Expired')),

  created_date TIMESTAMP NOT NULL,
  expired_date TIMESTAMP NOT NULL, -- loan offer expires after this date, configured by lender_user_id
  published_date TIMESTAMP, -- when principal has been funded

  closed_date TIMESTAMP, -- available_principal_amount will be returned to lender account on closed_date
  closure_reason TEXT,

  FOREIGN KEY (principal_currency_blockchain_key, principal_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  CHECK (min_loan_principal_amount <= max_loan_principal_amount)
);

COMMENT ON COLUMN loan_offers.offered_principal_prepaid_amount IS 'Penawaran pokok pinjaman dibayar dimuka oleh pemberi dana menggunakan saldo yang ada di akun platform';
COMMENT ON COLUMN loan_offers.offered_principal_amount IS 'Pokok pinjaman yang ditawarkan, total keseluruhan yang ditawarkan oleh pemberi dana';
COMMENT ON COLUMN loan_offers.disbursed_principal_amount IS 'Pokok pinjaman yang telah disalurkan ke peminjam';
COMMENT ON COLUMN loan_offers.reserved_principal_amount IS 'Pokok pinjaman dalam pending loan (Loan pending terjadi saat butuh approval, sistem saat ini tidak ada sistem approval)';
COMMENT ON COLUMN loan_offers.available_principal_amount IS 'Pokok pinjaman tersedia untuk dipinjam';
COMMENT ON COLUMN loan_offers.min_loan_principal_amount IS 'Jumlah pokok pinjaman minimum yang dapat diajukan peminjam';
COMMENT ON COLUMN loan_offers.max_loan_principal_amount IS 'Jumlah pokok pinjaman maksimum yang dapat diajukan peminjam';

CREATE TABLE IF NOT EXISTS loan_applications (
  id BIGSERIAL PRIMARY KEY,

  borrower_user_id BIGINT NOT NULL REFERENCES users (id),

  loan_offer_id BIGINT DEFAULT NULL REFERENCES loan_offers (id),
  principal_currency_blockchain_key VARCHAR(64) NOT NULL,
  principal_currency_token_id VARCHAR(64) NOT NULL,
  principal_amount DECIMAL(78, 0) NOT NULL CHECK (principal_amount > 0),
  provision_amount DECIMAL(78, 0) NOT NULL CHECK (provision_amount >= 0), -- calculated by principal_amount * platform_configs.loan_provision_rate at applied_date
  max_interest_rate DECIMAL(8, 4) NOT NULL CHECK (max_interest_rate >= 0 AND max_interest_rate <= 100), -- configured by borrower_user_id
  min_ltv_ratio DECIMAL(8, 4) NOT NULL CHECK (min_ltv_ratio > 0 AND min_ltv_ratio <= 1), -- based on platform_configs.loan_min_ltv_ratio at applied_date
  max_ltv_ratio DECIMAL(8, 4) NOT NULL CHECK (max_ltv_ratio > 0 AND max_ltv_ratio <= 1), -- based on platform_configs.loan_max_ltv_ratio at applied_date
  term_in_months INT NOT NULL CHECK (term_in_months > 0),
  liquidation_mode VARCHAR(32) NOT NULL CHECK (liquidation_mode IN ('Partial', 'Full')), -- configured by borrower_user_id, fallback to platform_configs.loan_liquidation_mode if not set

  collateral_currency_blockchain_key VARCHAR(64) NOT NULL,
  collateral_currency_token_id VARCHAR(64) NOT NULL,
  collateral_deposit_amount DECIMAL(78, 0) NOT NULL CHECK (collateral_deposit_amount > 0), -- calculated from principal_amount / min_ltv_ratio
  collateral_deposit_exchange_rate_id BIGINT NOT NULL REFERENCES exchange_rates (id), -- collateral valuation on applied_date

  status VARCHAR(32) NOT NULL DEFAULT 'PendingCollateral' CHECK (status IN ('PendingCollateral', 'Published', 'Matched', 'Closed', 'Expired')),

  applied_date TIMESTAMP NOT NULL,
  expired_date TIMESTAMP NOT NULL, -- loan application expires after this date, configured by borrower_user_id

  -- collateral hand over from borrower to platform
  collateral_prepaid_amount DECIMAL(78, 0) CHECK (collateral_prepaid_amount >= 0), -- amount paid from borrower's account
  published_date TIMESTAMP, -- when borrower paid the collateral deposit invoice

  max_ltv_ratio_reached_date TIMESTAMP,
  max_ltv_ratio_reached_exchange_rate_id BIGINT DEFAULT NULL REFERENCES exchange_rates (id),

  matched_date TIMESTAMP,
  matched_loan_offer_id BIGINT DEFAULT NULL REFERENCES loan_offers (id),
  matched_ltv_ratio DECIMAL(8, 4) CHECK (matched_ltv_ratio > 0 AND matched_ltv_ratio <= 1), -- based on current platform_configs at matched_date
  matched_collateral_valuation_amount DECIMAL(78, 0) CHECK (matched_collateral_valuation_amount > 0), -- principal_amount * matched_ltv_ratio

  closed_date TIMESTAMP,
  closure_reason TEXT,

  CHECK (min_ltv_ratio <= max_ltv_ratio),
  FOREIGN KEY (collateral_currency_blockchain_key, collateral_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (principal_currency_blockchain_key, principal_currency_token_id) REFERENCES currencies (blockchain_key, token_id)
);

COMMENT ON COLUMN loan_applications.loan_offer_id IS 'If set, the only loan offer that can be matched with this application';
COMMENT ON COLUMN loan_applications.provision_amount IS 'Calculated from principal_amount * platform_configs.loan_provision_rate at applied_date';
COMMENT ON COLUMN loan_applications.max_interest_rate IS 'Maximum interest rate that borrower is willing to accept';
COMMENT ON COLUMN loan_applications.min_ltv_ratio IS 'Minimum LTV ratio that platform will allow for this application';
COMMENT ON COLUMN loan_applications.max_ltv_ratio IS 'Maximum LTV ratio that platform will allow for this application';

CREATE TABLE IF NOT EXISTS loans (
  id BIGSERIAL PRIMARY KEY,

  loan_offer_id BIGINT NOT NULL REFERENCES loan_offers (id),
  loan_application_id BIGINT NOT NULL REFERENCES loan_applications (id),

  principal_currency_blockchain_key VARCHAR(64) NOT NULL,
  principal_currency_token_id VARCHAR(64) NOT NULL,
  principal_amount DECIMAL(78, 0) NOT NULL,

  -- terms calculation
  interest_amount DECIMAL(78, 0) NOT NULL DEFAULT 0, -- calculated from principal_amount * loan_application.interest_rate * (loan_application.term_in_months / 12)
  repayment_amount DECIMAL(78, 0) NOT NULL DEFAULT 0, -- calculated from principal_amount + provision_amount + interest_amount

  redelivery_fee_amount DECIMAL(78, 0) NOT NULL DEFAULT 0, -- calculated from interest_amount * platform_configs.redelivery_fee_rate at originated_date
  redelivery_amount DECIMAL(78, 0) NOT NULL DEFAULT 0, -- calculated from principal_amount + interest_amount - redelivery_fee_amount

  premi_amount DECIMAL(78, 0) NOT NULL DEFAULT 0, -- calculated from principal_amount * platform_configs.loan_liquidation_premi_rate at originated_date
  liquidation_fee_amount DECIMAL(78, 0) NOT NULL DEFAULT 0, -- calculated from principal_amount * platform_configs.loan_liquidation_fee_rate at originated_date
  min_collateral_valuation DECIMAL(78, 0) NOT NULL DEFAULT 0, -- calculated from repayment_amount + premi_amount + liquidation_fee_amount
  mc_ltv_ratio DECIMAL(8, 4) NOT NULL, -- calculated from principal_amount / min_collateral_valuation

  collateral_currency_blockchain_key VARCHAR(64) NOT NULL,
  collateral_currency_token_id VARCHAR(64) NOT NULL,
  collateral_amount DECIMAL(78, 0) NOT NULL,

  legal_document_path TEXT,
  legal_document_hash TEXT,
  legal_document_created_date TIMESTAMP,

  status VARCHAR(32) NOT NULL DEFAULT 'Originated' CHECK (status IN ('Originated', 'Active', 'Liquidated', 'Repaid', 'Defaulted')),

  origination_date TIMESTAMP NOT NULL,
  disbursement_date TIMESTAMP,
  maturity_date TIMESTAMP,
  concluded_date TIMESTAMP,
  conclusion_reason TEXT,

  current_ltv_ratio DECIMAL(8, 4),
  mc_ltv_ratio_date TIMESTAMP,
  mc_ltv_ratio_exchange_rate_id BIGINT,
  FOREIGN KEY (collateral_currency_blockchain_key, collateral_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (principal_currency_blockchain_key, principal_currency_token_id) REFERENCES currencies (blockchain_key, token_id)
);

CREATE TABLE IF NOT EXISTS loan_valuations (
  loan_id BIGINT NOT NULL REFERENCES loans (id),
  exchange_rate_id BIGINT NOT NULL REFERENCES exchange_rates (id),
  valuation_date TIMESTAMP NOT NULL,
  ltv_ratio DECIMAL(8, 4) NOT NULL,
  collateral_valuation_amount DECIMAL(78, 0) NOT NULL,
  PRIMARY KEY (loan_id, exchange_rate_id)
);

-- Repayment tracking (one-to-one with loans)
CREATE TABLE IF NOT EXISTS loan_repayments (
  loan_id BIGINT PRIMARY KEY REFERENCES loans (id),
  repayment_initiator VARCHAR(32) CHECK (repayment_initiator IN ('Borrower', 'Platform')),
  repayment_invoice_id BIGINT NOT NULL REFERENCES invoices (id),
  repayment_invoice_date TIMESTAMP NOT NULL
);

COMMENT ON COLUMN loan_repayments.repayment_initiator IS 'Borrower can request for early repayment, Platform initiates repayment on maturity - platform_configs.loan_repayment_duration_in_days';

-- Liquidation management (one-to-one with loans)
CREATE TABLE IF NOT EXISTS loan_liquidations (
  loan_id BIGINT PRIMARY KEY REFERENCES loans (id),
  liquidation_initiator VARCHAR(32) CHECK (liquidation_initiator IN ('Borrower', 'Platform')),
  liquidation_target_amount DECIMAL(78, 0) NOT NULL, -- if loans.liquidation_mode = 'Partial' then repayment_amount + premi_amount + liquidation_fee_amount else this column is ignored
  market_provider VARCHAR(128),
  market_symbol VARCHAR(32),
  order_ref VARCHAR(128),
  order_quantity DECIMAL(78, 0),
  order_price DECIMAL(78, 0),
  status VARCHAR(32) NOT NULL CHECK (status IN ('Pending', 'Fulfilled', 'Failed')),
  order_date TIMESTAMP NOT NULL,
  fulfilled_date TIMESTAMP,
  fulfilled_amount DECIMAL(78, 0),
  failure_date TIMESTAMP,
  failure_reason TEXT,
  returned_premi_amount DECIMAL(78, 0) -- calculated from MAX(loans.premi_amount, liquidation_target_amount - fulfilled_amount)
);

--- DEPENDENCY ---

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS loan_application_id BIGINT DEFAULT NULL REFERENCES loan_applications (id);
ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS loan_id BIGINT DEFAULT NULL REFERENCES loans (id);
ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS loan_offer_id BIGINT DEFAULT NULL REFERENCES loan_offers (id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS loan_application_id BIGINT DEFAULT NULL REFERENCES loan_applications (id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS loan_id BIGINT DEFAULT NULL REFERENCES loans (id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS loan_offer_id BIGINT DEFAULT NULL REFERENCES loan_offers (id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS loan_application_id BIGINT DEFAULT NULL REFERENCES loan_applications (id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS loan_id BIGINT DEFAULT NULL REFERENCES loans (id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS loan_offer_id BIGINT DEFAULT NULL REFERENCES loan_offers (id);

--- TRIGGERS ---

CREATE OR REPLACE FUNCTION validate_loan_offer_data()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status != 'Funding' THEN
    RAISE EXCEPTION 'Initial status must be Funding for new loan offers';
  END IF;

  IF NEW.expired_date <= NEW.created_date THEN
    RAISE EXCEPTION 'Expired date must be after created date';
  END IF;

  IF NEW.published_date IS NOT NULL AND NEW.published_date < NEW.created_date THEN
    RAISE EXCEPTION 'Published date cannot be before created date';
  END IF;

  IF NEW.closed_date IS NOT NULL AND NEW.closed_date < NEW.created_date THEN
    RAISE EXCEPTION 'Closed date cannot be before created date';
  END IF;

  IF OLD IS NOT NULL AND OLD.status != NEW.status THEN
    IF (OLD.status = 'Funding' AND NEW.status NOT IN ('Published', 'Closed', 'Expired')) OR
       (OLD.status = 'Published' AND NEW.status NOT IN ('Closed', 'Expired')) OR
       (OLD.status = 'Closed' AND NEW.status NOT IN ('Closed')) OR
       (OLD.status = 'Expired' AND NEW.status NOT IN ('Expired')) THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- Prevent business data modification on update (except for calculated fields and status changes)
  IF OLD IS NOT NULL THEN
    IF OLD.lender_user_id != NEW.lender_user_id THEN
      RAISE EXCEPTION 'Cannot modify lender_user_id after creation';
    END IF;
    
    IF OLD.principal_currency_blockchain_key != NEW.principal_currency_blockchain_key THEN
      RAISE EXCEPTION 'Cannot modify principal_currency_blockchain_key after creation';
    END IF;
    
    IF OLD.principal_currency_token_id != NEW.principal_currency_token_id THEN
      RAISE EXCEPTION 'Cannot modify principal_currency_token_id after creation';
    END IF;
    
    IF OLD.offered_principal_amount != NEW.offered_principal_amount THEN
      RAISE EXCEPTION 'Cannot modify offered_principal_amount after creation';
    END IF;
    
    IF OLD.interest_rate != NEW.interest_rate THEN
      RAISE EXCEPTION 'Cannot modify interest_rate after creation';
    END IF;
    
    IF OLD.term_in_months_options != NEW.term_in_months_options THEN
      RAISE EXCEPTION 'Cannot modify term_in_months_options after creation';
    END IF;
    
    IF OLD.created_date != NEW.created_date THEN
      RAISE EXCEPTION 'Cannot modify created_date after creation';
    END IF;
    
    IF OLD.expired_date != NEW.expired_date THEN
      RAISE EXCEPTION 'Cannot modify expired_date after creation';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_loan_offer_data_trigger
BEFORE INSERT OR UPDATE ON loan_offers
FOR EACH ROW
EXECUTE FUNCTION validate_loan_offer_data();

CREATE OR REPLACE FUNCTION validate_loan_application_data()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status != 'PendingCollateral' THEN
    RAISE EXCEPTION 'Initial status must be PendingCollateral for new loan applications';
  END IF;

  IF NEW.expired_date <= NEW.applied_date THEN
    RAISE EXCEPTION 'Expired date must be after applied date';
  END IF;

  IF NEW.published_date IS NOT NULL AND NEW.published_date < NEW.applied_date THEN
    RAISE EXCEPTION 'Published date cannot be before applied date';
  END IF;

  IF NEW.matched_date IS NOT NULL AND NEW.matched_date < NEW.applied_date THEN
    RAISE EXCEPTION 'Matched date cannot be before applied date';
  END IF;

  IF NEW.closed_date IS NOT NULL AND NEW.closed_date < NEW.applied_date THEN
    RAISE EXCEPTION 'Closed date cannot be before applied date';
  END IF;

  IF OLD IS NOT NULL AND OLD.status != NEW.status THEN
    IF (OLD.status = 'PendingCollateral' AND NEW.status NOT IN ('Published', 'Closed', 'Expired')) OR
       (OLD.status = 'Published' AND NEW.status NOT IN ('Matched', 'Closed', 'Expired')) OR
       (OLD.status = 'Matched' AND NEW.status NOT IN ('Closed')) OR
       (OLD.status = 'Closed' AND NEW.status NOT IN ('Closed')) OR
       (OLD.status = 'Expired' AND NEW.status NOT IN ('Expired')) THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  -- Prevent business data modification on update (except for calculated fields and status changes)
  IF OLD IS NOT NULL THEN
    IF OLD.borrower_user_id != NEW.borrower_user_id THEN
      RAISE EXCEPTION 'Cannot modify borrower_user_id after creation';
    END IF;
    
    IF OLD.principal_currency_blockchain_key != NEW.principal_currency_blockchain_key THEN
      RAISE EXCEPTION 'Cannot modify principal_currency_blockchain_key after creation';
    END IF;
    
    IF OLD.principal_currency_token_id != NEW.principal_currency_token_id THEN
      RAISE EXCEPTION 'Cannot modify principal_currency_token_id after creation';
    END IF;
    
    IF OLD.principal_amount != NEW.principal_amount THEN
      RAISE EXCEPTION 'Cannot modify principal_amount after creation';
    END IF;
    
    IF OLD.provision_amount != NEW.provision_amount THEN
      RAISE EXCEPTION 'Cannot modify provision_amount after creation';
    END IF;
    
    IF OLD.max_interest_rate != NEW.max_interest_rate THEN
      RAISE EXCEPTION 'Cannot modify max_interest_rate after creation';
    END IF;
    
    IF OLD.min_ltv_ratio != NEW.min_ltv_ratio THEN
      RAISE EXCEPTION 'Cannot modify min_ltv_ratio after creation';
    END IF;
    
    IF OLD.max_ltv_ratio != NEW.max_ltv_ratio THEN
      RAISE EXCEPTION 'Cannot modify max_ltv_ratio after creation';
    END IF;
    
    IF OLD.term_in_months != NEW.term_in_months THEN
      RAISE EXCEPTION 'Cannot modify term_in_months after creation';
    END IF;
    
    IF OLD.liquidation_mode != NEW.liquidation_mode THEN
      RAISE EXCEPTION 'Cannot modify liquidation_mode after creation';
    END IF;
    
    IF OLD.collateral_currency_blockchain_key != NEW.collateral_currency_blockchain_key THEN
      RAISE EXCEPTION 'Cannot modify collateral_currency_blockchain_key after creation';
    END IF;
    
    IF OLD.collateral_currency_token_id != NEW.collateral_currency_token_id THEN
      RAISE EXCEPTION 'Cannot modify collateral_currency_token_id after creation';
    END IF;
    
    IF OLD.collateral_deposit_amount != NEW.collateral_deposit_amount THEN
      RAISE EXCEPTION 'Cannot modify collateral_deposit_amount after creation';
    END IF;
    
    IF OLD.applied_date != NEW.applied_date THEN
      RAISE EXCEPTION 'Cannot modify applied_date after creation';
    END IF;
    
    IF OLD.expired_date != NEW.expired_date THEN
      RAISE EXCEPTION 'Cannot modify expired_date after creation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_loan_application_data_trigger
BEFORE INSERT OR UPDATE ON loan_applications
FOR EACH ROW
EXECUTE FUNCTION validate_loan_application_data();

CREATE OR REPLACE FUNCTION publish_loan_offer_on_principal_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  loan_offer_record RECORD;
BEGIN
  -- Only process when invoice gets paid (paid_date changes from NULL to a date) and has loan_offer_id
  IF OLD.paid_date IS NULL AND NEW.paid_date IS NOT NULL AND NEW.loan_offer_id IS NOT NULL THEN
    
    -- Get loan offer details
    SELECT 
      id, 
      lender_user_id, 
      principal_currency_blockchain_key, 
      principal_currency_token_id,
      offered_principal_amount,
      status
    INTO loan_offer_record
    FROM loan_offers 
    WHERE id = NEW.loan_offer_id;
    
    -- Only process if loan offer exists and is in 'Funding' status
    IF loan_offer_record.id IS NOT NULL AND loan_offer_record.status = 'Funding' THEN
      
      -- Update loan offer status to 'Published' and set published_date
      UPDATE loan_offers 
      SET 
        status = 'Published',
        published_date = NEW.paid_date
      WHERE id = NEW.loan_offer_id;
      
      -- Move principal from lender's user account to platform escrow
      INSERT INTO account_mutation_entries (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        account_type,
        mutation_type,
        mutation_date,
        amount
      ) VALUES (
        loan_offer_record.lender_user_id,
        loan_offer_record.principal_currency_blockchain_key,
        loan_offer_record.principal_currency_token_id,
        'User',
        'LoanOfferPrincipalEscrowed',
        NEW.paid_date,
        -loan_offer_record.offered_principal_amount
      );

      UPDATE account_mutations
      SET loan_offer_id = NEW.loan_offer_id
      FROM accounts
      WHERE account_mutations.account_id = accounts.id
        AND account_mutations.loan_offer_id IS NULL
        AND account_mutations.mutation_type = 'LoanOfferPrincipalEscrowed'
        AND account_mutations.mutation_date = NEW.paid_date
        AND accounts.user_id = loan_offer_record.lender_user_id
        AND accounts.currency_blockchain_key = loan_offer_record.principal_currency_blockchain_key
        AND accounts.currency_token_id = loan_offer_record.principal_currency_token_id
        AND accounts.account_type = 'User';

      -- Add corresponding credit to platform escrow account
      INSERT INTO account_mutation_entries (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        account_type,
        mutation_type,
        mutation_date,
        amount
      ) VALUES (
        1, -- Platform user_id
        loan_offer_record.principal_currency_blockchain_key,
        loan_offer_record.principal_currency_token_id,
        'PlatformEscrow',
        'LoanPrincipalFunded',
        NEW.paid_date,
        loan_offer_record.offered_principal_amount
      );

      UPDATE account_mutations
      SET loan_offer_id = NEW.loan_offer_id
      FROM accounts
      WHERE account_mutations.account_id = accounts.id
        AND account_mutations.loan_offer_id IS NULL
        AND account_mutations.mutation_type = 'LoanPrincipalFunded'
        AND account_mutations.mutation_date = NEW.paid_date
        AND accounts.user_id = 1 -- Platform user_id
        AND accounts.currency_blockchain_key = loan_offer_record.principal_currency_blockchain_key
        AND accounts.currency_token_id = loan_offer_record.principal_currency_token_id
        AND accounts.account_type = 'PlatformEscrow';
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER publish_loan_offer_on_principal_invoice_paid_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION publish_loan_offer_on_principal_invoice_paid();

CREATE OR REPLACE FUNCTION publish_loan_application_on_collateral_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  loan_application_record RECORD;
BEGIN
  -- Only process when invoice gets paid (paid_date changes from NULL to a date) and has loan_application_id
  IF OLD.paid_date IS NULL AND NEW.paid_date IS NOT NULL AND NEW.loan_application_id IS NOT NULL THEN
    
    -- Get loan application details
    SELECT 
      id, 
      borrower_user_id, 
      collateral_currency_blockchain_key, 
      collateral_currency_token_id,
      collateral_deposit_amount,
      status
    INTO loan_application_record
    FROM loan_applications 
    WHERE id = NEW.loan_application_id;
    
    -- Only process if loan application exists and is in 'PendingCollateral' status
    IF loan_application_record.id IS NOT NULL AND loan_application_record.status = 'PendingCollateral' THEN
      
      -- Update loan application status to 'Published' and set published_date
      UPDATE loan_applications 
      SET 
        status = 'Published',
        published_date = NEW.paid_date,
        collateral_prepaid_amount = loan_application_record.collateral_deposit_amount
      WHERE id = NEW.loan_application_id;
      
      -- Move collateral from borrower's user account to platform escrow
      INSERT INTO account_mutation_entries (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        account_type,
        mutation_type,
        mutation_date,
        amount
      ) VALUES (
        loan_application_record.borrower_user_id,
        loan_application_record.collateral_currency_blockchain_key,
        loan_application_record.collateral_currency_token_id,
        'User',
        'LoanCollateralDeposit',
        NEW.paid_date,
        -loan_application_record.collateral_deposit_amount
      );

      UPDATE account_mutations
      SET loan_application_id = NEW.loan_application_id
      FROM accounts
      WHERE account_mutations.account_id = accounts.id
        AND account_mutations.loan_application_id IS NULL
        AND account_mutations.mutation_type = 'LoanCollateralDeposit'
        AND account_mutations.mutation_date = NEW.paid_date
        AND accounts.user_id = loan_application_record.borrower_user_id
        AND accounts.currency_blockchain_key = loan_application_record.collateral_currency_blockchain_key
        AND accounts.currency_token_id = loan_application_record.collateral_currency_token_id
        AND accounts.account_type = 'User';

      -- Add corresponding credit to platform escrow account
      INSERT INTO account_mutation_entries (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        account_type,
        mutation_type,
        mutation_date,
        amount
      ) VALUES (
        1, -- Platform user_id
        loan_application_record.collateral_currency_blockchain_key,
        loan_application_record.collateral_currency_token_id,
        'PlatformEscrow',
        'LoanCollateralDeposit',
        NEW.paid_date,
        loan_application_record.collateral_deposit_amount
      );

      UPDATE account_mutations
      SET loan_application_id = NEW.loan_application_id
      FROM accounts
      WHERE account_mutations.account_id = accounts.id
        AND account_mutations.loan_application_id IS NULL
        AND account_mutations.mutation_type = 'LoanCollateralDeposit'
        AND account_mutations.mutation_date = NEW.paid_date
        AND accounts.user_id = 1 -- Platform user_id
        AND accounts.currency_blockchain_key = loan_application_record.collateral_currency_blockchain_key
        AND accounts.currency_token_id = loan_application_record.collateral_currency_token_id
        AND accounts.account_type = 'PlatformEscrow';
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER publish_loan_application_on_collateral_invoice_paid_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION publish_loan_application_on_collateral_invoice_paid();
