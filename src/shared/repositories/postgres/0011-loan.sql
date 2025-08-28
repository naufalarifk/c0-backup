--- SCHEMA ---

CREATE TABLE IF NOT EXISTS loan_offers (
  id BIGSERIAL PRIMARY KEY,

  lender_user_id BIGINT NOT NULL,

  blockchain_key VARCHAR(64) NOT NULL,
  collateral_currency_token_id VARCHAR(64) NOT NULL,
  principal_currency_token_id VARCHAR(64) NOT NULL,

  offered_principal_amount BIGINT NOT NULL,
  disbursed_principal_amount BIGINT NOT NULL DEFAULT 0,
  reserved_principal_amount BIGINT NOT NULL DEFAULT 0,
  available_principal_amount BIGINT GENERATED ALWAYS AS (offered_principal_amount - disbursed_principal_amount - reserved_principal_amount) STORED,

  min_application_principal_amount BIGINT NOT NULL, -- derived from currencies of principal_currency_token_id at creation
  max_application_principal_amount BIGINT NOT NULL, -- derived from currencies of principal_currency_token_id at creation

  interest_rate DECIMAL(8, 4) NOT NULL,
  term_in_months_options INT[] NOT NULL,

  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_funding', 'published', 'closed', 'expired')),

  created_date TIMESTAMP NOT NULL,
  expired_date TIMESTAMP NOT NULL, -- loan offer expires after this date, configured by lender_user_id

  -- principal hand over from lender to platform
  principal_invoice_id BIGINT NOT NULL,
  principal_funded_date TIMESTAMP,
  published_date TIMESTAMP,

  closed_date TIMESTAMP, -- available_principal_amount will be deposited to lender account on closed_date
  closure_reason TEXT,

  FOREIGN KEY (lender_user_id) REFERENCES users (id),
  FOREIGN KEY (blockchain_key, collateral_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (blockchain_key, principal_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (principal_invoice_id) REFERENCES invoices (id)
);

CREATE TABLE IF NOT EXISTS loan_applications (
  id BIGSERIAL PRIMARY KEY,

  borrower_user_id BIGINT NOT NULL,

  blockchain_key VARCHAR(64) NOT NULL,
  collateral_currency_token_id VARCHAR(64) NOT NULL,
  principal_currency_token_id VARCHAR(64) NOT NULL,

  principal_amount BIGINT NOT NULL,
  max_interest_rate DECIMAL(8, 4) NOT NULL,
  min_ltv_ratio DECIMAL(8, 4) NOT NULL, -- configured by borrower_user_id
  max_ltv_ratio DECIMAL(8, 4) NOT NULL, -- based on platform_configs at applied_date
  term_in_months INT NOT NULL,
  collateral_deposit_exchange_rate_id BIGINT NOT NULL, -- collateral valuation on applied_date
  collateral_deposit_amount BIGINT NOT NULL, -- principal_amount * (1 + max_ltv_ratio)
  liquidation_mode VARCHAR(32) NOT NULL CHECK (liquidation_mode IN ('Partial', 'Full')), -- configured by borrower_user_id, fallback to platform_configs if not set

  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_collateral', 'published', 'matched', 'closed', 'expired')),

  applied_date TIMESTAMP NOT NULL,
  expired_date TIMESTAMP NOT NULL, -- loan application expires after this date, configured by borrower_user_id

  -- collateral hand over from borrower to platform
  collateral_prepaid_amount BIGINT, -- amount paid from borrower's account
  collateral_invoice_id BIGINT NOT NULL, -- invoice for collateral payment
  collateral_deposited_date TIMESTAMP, -- when borrower paid the collateral deposit invoice
  collateral_expired_date TIMESTAMP,
  published_date TIMESTAMP, -- equal to collateral_deposited_date

  max_ltv_ratio_reached_date TIMESTAMP,
  max_ltv_ratio_reached_exchange_rate_id BIGINT,

  matched_date TIMESTAMP,
  matched_loan_offer_id BIGINT,
  matched_ltv_ratio DECIMAL(8, 4), -- based on current platform_configs at matched_date
  matched_collateral_valuation_amount BIGINT, -- principal_amount * matched_ltv_ratio

  closed_date TIMESTAMP,
  closure_reason TEXT,

  FOREIGN KEY (borrower_user_id) REFERENCES users (id),
  FOREIGN KEY (blockchain_key, collateral_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (blockchain_key, principal_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (collateral_deposit_exchange_rate_id) REFERENCES exchange_rates (id),
  FOREIGN KEY (collateral_invoice_id) REFERENCES invoices (id),
  FOREIGN KEY (matched_loan_offer_id) REFERENCES loan_offers (id),
  FOREIGN KEY (max_ltv_ratio_reached_exchange_rate_id) REFERENCES exchange_rates (id)
);

-- Core loan data
CREATE TABLE IF NOT EXISTS loans (
  id BIGSERIAL PRIMARY KEY,
  loan_offer_id BIGINT NOT NULL,
  loan_application_id BIGINT NOT NULL,
  blockchain_key VARCHAR(64) NOT NULL,
  collateral_currency_token_id VARCHAR(64) NOT NULL,
  principal_currency_token_id VARCHAR(64) NOT NULL,
  principal_amount BIGINT NOT NULL,
  collateral_amount BIGINT NOT NULL,
  interest_rate DECIMAL(8, 4) NOT NULL,
  term_in_months INT NOT NULL,
  liquidation_mode VARCHAR(32) NOT NULL CHECK (liquidation_mode IN ('Partial', 'Full')),
  max_ltv_ratio DECIMAL(8, 4) NOT NULL,

  -- terms calculation
  disbursement_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  disbursement_fee_amount BIGINT NOT NULL DEFAULT 0,
  net_disbursement_amount BIGINT NOT NULL DEFAULT 0,
  interest_amount BIGINT NOT NULL DEFAULT 0,
  repayment_amount BIGINT NOT NULL DEFAULT 0,
  redelivery_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 0,
  redelivery_fee_amount BIGINT NOT NULL DEFAULT 0,
  redelivery_amount BIGINT NOT NULL DEFAULT 0,
  net_redelivery_amount BIGINT NOT NULL DEFAULT 0,
  liquidation_fee_rate DECIMAL(8, 4) NOT NULL DEFAULT 0, -- taken from platform_configs at originated_date

  legal_document_path TEXT,
  legal_document_hash TEXT,
  legal_document_created_date TIMESTAMP,

  status VARCHAR(32) NOT NULL DEFAULT 'originated' CHECK (status IN ('originated', 'active', 'ltv_breach', 'pending_liquidation', 'liquidated', 'repaid', 'defaulted')),

  origination_date TIMESTAMP NOT NULL,
  disbursement_date TIMESTAMP,
  maturity_date TIMESTAMP,
  concluded_date TIMESTAMP,
  conclusion_reason TEXT,

  current_ltv_ratio DECIMAL(8, 4),
  max_ltv_ratio_reached_date TIMESTAMP,
  max_ltv_ratio_reached_exchange_rate_id BIGINT,

  FOREIGN KEY (loan_application_id) REFERENCES loan_applications (id),
  FOREIGN KEY (loan_offer_id) REFERENCES loan_offers (id),
  FOREIGN KEY (blockchain_key, collateral_currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  FOREIGN KEY (blockchain_key, principal_currency_token_id) REFERENCES currencies (blockchain_key, token_id)
);

CREATE TABLE IF NOT EXISTS loan_valuations (
  loan_id BIGINT NOT NULL,
  exchange_rate_id BIGINT NOT NULL,
  valuation_date TIMESTAMP NOT NULL,
  ltv_ratio DECIMAL(8, 4) NOT NULL,
  collateral_valuation_amount BIGINT NOT NULL,
  PRIMARY KEY (loan_id, exchange_rate_id),
  FOREIGN KEY (loan_id) REFERENCES loans (id),
  FOREIGN KEY (exchange_rate_id) REFERENCES exchange_rates (id)
);

-- Repayment tracking (one-to-one with loans)
CREATE TABLE IF NOT EXISTS loan_repayments (
  loan_id BIGINT PRIMARY KEY,
  repayment_invoice_id BIGINT NOT NULL,
  repayment_invoice_date TIMESTAMP,
  repayment_failed_date TIMESTAMP,
  repaid_date TIMESTAMP,

  FOREIGN KEY (loan_id) REFERENCES loans (id) ON DELETE CASCADE,
  FOREIGN KEY (repayment_invoice_id) REFERENCES invoices (id)
);


-- Liquidation management (one-to-one with loans)
CREATE TABLE IF NOT EXISTS loan_liquidations (
  loan_id BIGINT PRIMARY KEY,

  early_closure_date TIMESTAMP,
  early_closure_exchange_rate_id BIGINT,
  early_closure_valuation_amount BIGINT,
  early_closure_liquidation_fee_rate DECIMAL(8, 4),
  early_closure_liquidation_fee_amount BIGINT,
  early_closure_liquidation_amount BIGINT,
  early_closure_collateral_amount BIGINT,

  liquidation_date TIMESTAMP,
  liquidation_collateral_amount BIGINT NOT NULL DEFAULT 0,
  liquidation_surplus_amount BIGINT NOT NULL DEFAULT 0,
  liquidation_deficit_amount BIGINT NOT NULL DEFAULT 0,
  liquidation_release_amount BIGINT NOT NULL DEFAULT 0, -- amount released to borrower after all liquidation fees and costs

  FOREIGN KEY (loan_id) REFERENCES loans (id) ON DELETE CASCADE,
  FOREIGN KEY (early_closure_exchange_rate_id) REFERENCES exchange_rates (id)
);

COMMENT ON COLUMN loan_liquidations.early_closure_exchange_rate_id IS 'Taken from exchange_rates at early_closure_date';
COMMENT ON COLUMN loan_liquidations.early_closure_valuation_amount IS 'Value of collateral in principal currency at early_closure_exchange_rate_id';


--- DEPENDENCY ---

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS loan_offer_id BIGINT;
ALTER TABLE account_mutations DROP CONSTRAINT IF EXISTS fk_account_mutations_loan_offer;
ALTER TABLE account_mutations ADD CONSTRAINT fk_account_mutations_loan_offer
  FOREIGN KEY (loan_offer_id) REFERENCES loan_offers (id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS loan_offer_id BIGINT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_loan_offer;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_loan_offer
  FOREIGN KEY (loan_offer_id) REFERENCES loan_offers (id);

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS loan_application_id BIGINT;
ALTER TABLE account_mutations DROP CONSTRAINT IF EXISTS fk_account_mutations_loan_application;
ALTER TABLE account_mutations ADD CONSTRAINT fk_account_mutations_loan_application
  FOREIGN KEY (loan_application_id) REFERENCES loan_applications (id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS loan_application_id BIGINT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_loan_application;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_loan_application
  FOREIGN KEY (loan_application_id) REFERENCES loan_applications (id);

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS loan_id BIGINT;
ALTER TABLE account_mutations DROP CONSTRAINT IF EXISTS fk_account_mutations_loan;
ALTER TABLE account_mutations ADD CONSTRAINT fk_account_mutations_loan
  FOREIGN KEY (loan_id) REFERENCES loans (id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS loan_id BIGINT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_loan;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_loan
  FOREIGN KEY (loan_id) REFERENCES loans (id);


--- VIEW ---

CREATE OR REPLACE VIEW loan_liquidation_status AS
SELECT
  l.*, -- all loan columns
  la.borrower_user_id,
  lo.lender_user_id,
  lr.repayment_invoice_id,
  lr.repayment_invoice_date,
  lr.repayment_failed_date,
  lr.repaid_date,
  ll.early_closure_date,
  ll.early_closure_exchange_rate_id,
  ll.early_closure_valuation_amount,
  ll.early_closure_liquidation_fee_rate,
  ll.early_closure_liquidation_fee_amount,
  ll.early_closure_liquidation_amount,
  ll.early_closure_collateral_amount,
  ll.liquidation_date,
  ll.liquidation_collateral_amount,
  ll.liquidation_surplus_amount,
  ll.liquidation_deficit_amount,
  ll.liquidation_release_amount,
  CASE
    WHEN l.current_ltv_ratio > l.max_ltv_ratio * 0.95 THEN 'critical'
    WHEN l.current_ltv_ratio > l.max_ltv_ratio * 0.85 THEN 'warning'
    ELSE 'normal'
  END as risk_level
FROM loans l
LEFT JOIN loan_repayments lr ON l.id = lr.loan_id
LEFT JOIN loan_liquidations ll ON l.id = ll.loan_id
JOIN loan_applications la ON l.loan_application_id = la.id
JOIN loan_offers lo ON l.loan_offer_id = lo.id;

COMMENT ON VIEW loan_liquidation_status IS 'Comprehensive loan status including liquidation and risk levels';

--- FUNCTIONS ---

-- Common validation functions

-- Validate currency exists
CREATE OR REPLACE FUNCTION validate_currency_exists(
  p_blockchain_key VARCHAR(64),
  p_token_id VARCHAR(64)
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM currencies
    WHERE blockchain_key = p_blockchain_key
    AND token_id = p_token_id
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate amount is positive
CREATE OR REPLACE FUNCTION validate_positive_amount(
  p_amount BIGINT,
  p_field_name TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '% must be positive', p_field_name;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate percentage rate (0 to 1)
CREATE OR REPLACE FUNCTION validate_percentage_rate(
  p_rate DECIMAL(8, 4),
  p_field_name TEXT,
  p_allow_zero BOOLEAN DEFAULT true
) RETURNS VOID AS $$
BEGIN
  IF (NOT p_allow_zero AND p_rate <= 0) OR p_rate < 0 OR p_rate > 1 THEN
    RAISE EXCEPTION '% must be between % and 1 (% to 100%%)',
      p_field_name,
      CASE WHEN p_allow_zero THEN '0' ELSE '0 (exclusive)' END,
      CASE WHEN p_allow_zero THEN '0%%' ELSE '0%% (exclusive)' END;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate date sequence
CREATE OR REPLACE FUNCTION validate_date_sequence(
  p_earlier_date TIMESTAMP,
  p_later_date TIMESTAMP,
  p_earlier_name TEXT,
  p_later_name TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_later_date IS NOT NULL AND p_earlier_date IS NOT NULL AND p_earlier_date >= p_later_date THEN
    RAISE EXCEPTION '% must be after %', p_later_name, p_earlier_name;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to calculate liquidation amounts for partial liquidation
CREATE OR REPLACE FUNCTION calculate_partial_liquidation_amounts(
  p_repayment_amount BIGINT,
  p_liquidation_fee_rate DECIMAL(8, 4),
  p_collateral_valuation_amount BIGINT,
  p_collateral_amount BIGINT
) RETURNS TABLE (
  valuation_amount BIGINT,
  fee_amount BIGINT,
  liquidation_amount BIGINT,
  collateral_needed BIGINT,
  release_amount BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT
    p_repayment_amount as valuation_amount,
    (p_repayment_amount * p_liquidation_fee_rate)::BIGINT as fee_amount,
    (p_repayment_amount + (p_repayment_amount * p_liquidation_fee_rate))::BIGINT as liquidation_amount,
    ((p_repayment_amount + (p_repayment_amount * p_liquidation_fee_rate)) / (p_collateral_valuation_amount::DECIMAL / p_collateral_amount))::BIGINT as collateral_needed,
    0::BIGINT as release_amount;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to calculate liquidation amounts for full liquidation
CREATE OR REPLACE FUNCTION calculate_full_liquidation_amounts(
  p_collateral_valuation_amount BIGINT,
  p_liquidation_fee_rate DECIMAL(8, 4),
  p_collateral_amount BIGINT,
  p_repayment_amount BIGINT
) RETURNS TABLE (
  valuation_amount BIGINT,
  fee_amount BIGINT,
  liquidation_amount BIGINT,
  collateral_needed BIGINT,
  release_amount BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT
    p_collateral_valuation_amount as valuation_amount,
    (p_collateral_valuation_amount * p_liquidation_fee_rate)::BIGINT as fee_amount,
    p_collateral_valuation_amount as liquidation_amount,
    p_collateral_amount as collateral_needed,
    GREATEST(0, p_collateral_valuation_amount - (p_collateral_valuation_amount * p_liquidation_fee_rate)::BIGINT - p_repayment_amount)::BIGINT as release_amount;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

--- VALIDATION TRIGGERS ---

CREATE OR REPLACE FUNCTION validate_loan_offer_data()
RETURNS TRIGGER AS $$
DECLARE
  total_reserved_and_disbursed BIGINT;
BEGIN
  -- Basic amount validations using common functions
  PERFORM validate_positive_amount(NEW.offered_principal_amount, 'Offered principal amount');
  PERFORM validate_positive_amount(NEW.min_application_principal_amount, 'Minimum application principal amount');
  PERFORM validate_positive_amount(NEW.max_application_principal_amount, 'Maximum application principal amount');

  IF NEW.min_application_principal_amount > NEW.max_application_principal_amount THEN
    RAISE EXCEPTION 'Minimum application amount cannot exceed maximum application amount';
  END IF;
  IF NEW.max_application_principal_amount > NEW.offered_principal_amount THEN
    RAISE EXCEPTION 'Maximum application amount cannot exceed offered principal amount';
  END IF;

  -- Interest rate validation
  PERFORM validate_percentage_rate(NEW.interest_rate, 'Interest rate', false);

  -- Term options validation
  IF array_length(NEW.term_in_months_options, 1) = 0 OR NEW.term_in_months_options IS NULL THEN
    RAISE EXCEPTION 'At least one term option must be provided';
  END IF;

  -- Date validations using common functions
  PERFORM validate_date_sequence(NEW.created_date, NEW.expired_date, 'creation date', 'expiry date');
  PERFORM validate_date_sequence(NEW.created_date, NEW.principal_funded_date, 'creation date', 'principal funded date');
  PERFORM validate_date_sequence(NEW.created_date, NEW.published_date, 'creation date', 'published date');
  PERFORM validate_date_sequence(NEW.published_date, NEW.closed_date, 'published date', 'closed date');

  IF NEW.published_date IS NOT NULL AND NEW.principal_funded_date IS NULL THEN
    RAISE EXCEPTION 'Loan offer cannot be published without principal funding';
  END IF;

  -- Available amount validation (computed column handles calculation)
  total_reserved_and_disbursed = COALESCE(NEW.reserved_principal_amount, 0) + COALESCE(NEW.disbursed_principal_amount, 0);
  IF total_reserved_and_disbursed > NEW.offered_principal_amount THEN
    RAISE EXCEPTION 'Reserved and disbursed amounts cannot exceed offered principal amount';
  END IF;

  -- Currency validation using common functions
  IF NOT validate_currency_exists(NEW.blockchain_key, NEW.principal_currency_token_id) THEN
    RAISE EXCEPTION 'Principal currency does not exist: % %', NEW.blockchain_key, NEW.principal_currency_token_id;
  END IF;
  IF NOT validate_currency_exists(NEW.blockchain_key, NEW.collateral_currency_token_id) THEN
    RAISE EXCEPTION 'Collateral currency does not exist: % %', NEW.blockchain_key, NEW.collateral_currency_token_id;
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
  -- Basic amount validations using common functions
  PERFORM validate_positive_amount(NEW.principal_amount, 'Principal amount');
  PERFORM validate_positive_amount(NEW.collateral_deposit_amount, 'Collateral deposit amount');
  PERFORM validate_percentage_rate(NEW.max_interest_rate, 'Maximum interest rate', false);

  -- LTV ratio validations using common functions
  PERFORM validate_percentage_rate(NEW.min_ltv_ratio, 'Minimum LTV ratio', false);
  PERFORM validate_percentage_rate(NEW.max_ltv_ratio, 'Maximum LTV ratio', false);

  IF NEW.min_ltv_ratio > NEW.max_ltv_ratio THEN
    RAISE EXCEPTION 'Minimum LTV ratio cannot exceed maximum LTV ratio';
  END IF;

  -- Term validation
  PERFORM validate_positive_amount(NEW.term_in_months::BIGINT, 'Term in months');

  -- Date validations using common functions
  PERFORM validate_date_sequence(NEW.applied_date, NEW.expired_date, 'application date', 'expiry date');
  PERFORM validate_date_sequence(NEW.applied_date, NEW.collateral_deposited_date, 'application date', 'collateral deposited date');
  PERFORM validate_date_sequence(NEW.published_date, NEW.matched_date, 'published date', 'matched date');

  IF NEW.published_date IS NOT NULL AND NEW.collateral_deposited_date IS NULL THEN
    RAISE EXCEPTION 'Loan application cannot be published without collateral deposit';
  END IF;
  IF NEW.matched_date IS NOT NULL AND NEW.published_date IS NULL THEN
    RAISE EXCEPTION 'Loan application cannot be matched without being published';
  END IF;

  -- Currency validation using common functions
  IF NOT validate_currency_exists(NEW.blockchain_key, NEW.principal_currency_token_id) THEN
    RAISE EXCEPTION 'Principal currency does not exist: % %', NEW.blockchain_key, NEW.principal_currency_token_id;
  END IF;
  IF NOT validate_currency_exists(NEW.blockchain_key, NEW.collateral_currency_token_id) THEN
    RAISE EXCEPTION 'Collateral currency does not exist: % %', NEW.blockchain_key, NEW.collateral_currency_token_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_loan_application_data_trigger
BEFORE INSERT OR UPDATE ON loan_applications
FOR EACH ROW
EXECUTE FUNCTION validate_loan_application_data();

CREATE OR REPLACE FUNCTION validate_loan_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Basic amount validations using common functions
  PERFORM validate_positive_amount(NEW.principal_amount, 'Principal amount');
  PERFORM validate_positive_amount(NEW.collateral_amount, 'Collateral amount');
  PERFORM validate_percentage_rate(NEW.interest_rate, 'Interest rate', false);
  PERFORM validate_percentage_rate(NEW.max_ltv_ratio, 'Maximum LTV ratio', false);
  PERFORM validate_positive_amount(NEW.term_in_months::BIGINT, 'Term in months');

  -- Fee rate validations
  PERFORM validate_percentage_rate(NEW.disbursement_fee_rate, 'Disbursement fee rate');
  PERFORM validate_percentage_rate(NEW.redelivery_fee_rate, 'Redelivery fee rate');
  PERFORM validate_percentage_rate(NEW.liquidation_fee_rate, 'Liquidation fee rate');

  -- Date validations
  PERFORM validate_date_sequence(NEW.origination_date, NEW.disbursement_date, 'origination date', 'disbursement date');
  PERFORM validate_date_sequence(NEW.disbursement_date, NEW.maturity_date, 'disbursement date', 'maturity date');

  -- Currency validation using common functions
  IF NOT validate_currency_exists(NEW.blockchain_key, NEW.principal_currency_token_id) THEN
    RAISE EXCEPTION 'Principal currency does not exist: % %', NEW.blockchain_key, NEW.principal_currency_token_id;
  END IF;
  IF NOT validate_currency_exists(NEW.blockchain_key, NEW.collateral_currency_token_id) THEN
    RAISE EXCEPTION 'Collateral currency does not exist: % %', NEW.blockchain_key, NEW.collateral_currency_token_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_loan_data_trigger
BEFORE INSERT OR UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION validate_loan_data();

-- Function to calculate loan fee amounts
CREATE OR REPLACE FUNCTION calculate_loan_fee_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate fee amounts
  NEW.disbursement_fee_amount := (NEW.principal_amount * NEW.disbursement_fee_rate)::BIGINT;
  NEW.net_disbursement_amount := NEW.principal_amount - NEW.disbursement_fee_amount;
  NEW.interest_amount := (NEW.principal_amount * NEW.interest_rate * NEW.term_in_months / 12)::BIGINT;
  NEW.repayment_amount := NEW.principal_amount + NEW.interest_amount;
  NEW.redelivery_fee_amount := (NEW.principal_amount * NEW.redelivery_fee_rate)::BIGINT;
  NEW.redelivery_amount := NEW.repayment_amount;
  NEW.net_redelivery_amount := NEW.redelivery_amount - NEW.redelivery_fee_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER calculate_loan_fee_amounts_trigger
BEFORE INSERT OR UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION calculate_loan_fee_amounts();

--- PROCESS TRIGGERS ---

CREATE OR REPLACE FUNCTION update_loan_offer_on_principal_funding()
RETURNS TRIGGER AS $$
DECLARE
  offer_record RECORD;
  currency_record RECORD;
BEGIN
  -- Only process when principal invoice is paid (paid_date is set)
  IF NEW.paid_date IS NOT NULL AND (OLD.paid_date IS NULL OR OLD.paid_date != NEW.paid_date) THEN

    -- Check if this invoice is a principal funding invoice for a loan offer
    SELECT * INTO offer_record
    FROM loan_offers
    WHERE principal_invoice_id = NEW.id;

    IF offer_record.id IS NOT NULL THEN
      -- Update loan offer with principal funded date and publish
      UPDATE loan_offers
      SET principal_funded_date = NEW.paid_date,
          published_date = NEW.paid_date,
          status = 'published'
      WHERE id = offer_record.id;

      -- Get currency information for account mutation
      SELECT * INTO currency_record
      FROM currencies
      WHERE blockchain_key = offer_record.blockchain_key
      AND token_id = offer_record.principal_currency_token_id;

      -- Debit lender account (principal funding)
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_offer_id,
        invoice_id
      ) VALUES (
        (SELECT id FROM accounts
         WHERE user_id = offer_record.lender_user_id
         AND currency_blockchain_key = offer_record.blockchain_key
         AND currency_token_id = offer_record.principal_currency_token_id),
        'LoanPrincipalFunded',
        NEW.paid_date,
        -offer_record.offered_principal_amount,
        offer_record.id,
        NEW.id
      );

      -- Credit platform escrow account with principal amount
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_offer_id,
        invoice_id
      ) VALUES (
        (SELECT id FROM accounts
         WHERE user_id = 1
         AND currency_blockchain_key = offer_record.blockchain_key
         AND currency_token_id = offer_record.principal_currency_token_id
         AND account_type = 'platform_escrow'),
        'LoanOfferPrincipalEscrowed',
        NEW.paid_date,
        offer_record.offered_principal_amount,
        offer_record.id,
        NEW.id
      );

      -- Send loan offer published notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        loan_offer_id,
        creation_date
      ) VALUES (
        offer_record.lender_user_id,
        'LoanOfferPublished',
        'Loan Offer Published',
        'Your loan offer of ' || offer_record.offered_principal_amount || ' has been published and is now available for borrowers.',
        offer_record.id,
        NEW.paid_date
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_loan_offer_on_principal_funding_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_loan_offer_on_principal_funding();

CREATE OR REPLACE FUNCTION update_loan_application_on_collateral_deposit()
RETURNS TRIGGER AS $$
DECLARE
  application_record RECORD;
  currency_record RECORD;
BEGIN
  -- Only process when collateral invoice is paid (paid_date is set)
  IF NEW.paid_date IS NOT NULL AND (OLD.paid_date IS NULL OR OLD.paid_date != NEW.paid_date) THEN

    -- Check if this invoice is a collateral deposit invoice for a loan application
    SELECT * INTO application_record
    FROM loan_applications
    WHERE collateral_invoice_id = NEW.id;

    IF application_record.id IS NOT NULL THEN
      -- Update loan application with collateral deposited and published dates
      UPDATE loan_applications
      SET collateral_deposited_date = NEW.paid_date,
          published_date = NEW.paid_date,
          status = 'published'
      WHERE id = application_record.id;

      -- Create account mutation to escrow the collateral amount
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_application_id,
        invoice_id
      ) VALUES (
        (SELECT id FROM accounts
         WHERE user_id = application_record.borrower_user_id
         AND currency_blockchain_key = application_record.blockchain_key
         AND currency_token_id = application_record.collateral_currency_token_id),
        'LoanApplicationCollateralEscrowed',
        NEW.paid_date,
        -application_record.collateral_deposit_amount,
        application_record.id,
        NEW.id
      );

      -- Credit platform escrow account with collateral
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_application_id,
        invoice_id
      ) VALUES (
        (SELECT id FROM accounts
         WHERE user_id = 1
         AND currency_blockchain_key = application_record.blockchain_key
         AND currency_token_id = application_record.collateral_currency_token_id
         AND account_type = 'platform_escrow'),
        'LoanApplicationCollateralEscrowed',
        NEW.paid_date,
        application_record.collateral_deposit_amount,
        application_record.id,
        NEW.id
      );

      -- Send loan application published notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        loan_application_id,
        creation_date
      ) VALUES (
        application_record.borrower_user_id,
        'LoanApplicationPublished',
        'Loan Application Published',
        'Your loan application for ' || application_record.principal_amount || ' has been published and is now available for matching.',
        application_record.id,
        NEW.paid_date
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_loan_application_on_collateral_deposit_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_loan_application_on_collateral_deposit();

CREATE OR REPLACE FUNCTION process_loan_matching()
RETURNS TRIGGER AS $$
DECLARE
  offer_record RECORD;
  application_record RECORD;
BEGIN
  -- Only process when loan application is matched (matched_date is set)
  IF NEW.matched_date IS NOT NULL AND (OLD.matched_date IS NULL OR OLD.matched_date != NEW.matched_date) THEN

    -- Get the matched loan offer
    SELECT * INTO offer_record
    FROM loan_offers
    WHERE id = NEW.matched_loan_offer_id;

    -- Get the loan application
    SELECT * INTO application_record
    FROM loan_applications
    WHERE id = NEW.id;

    -- Update loan offer reserved amount (available amount is computed)
    UPDATE loan_offers
    SET reserved_principal_amount = COALESCE(reserved_principal_amount, 0) + NEW.principal_amount
    WHERE id = NEW.matched_loan_offer_id;

    -- Update loan application status
    UPDATE loan_applications
    SET status = 'matched'
    WHERE id = NEW.id;

    -- Send notifications
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      loan_application_id,
      creation_date
    ) VALUES (
      application_record.borrower_user_id,
      'LoanApplicationMatched',
      'Loan Application Matched',
      'Your loan application has been matched with a lender. A loan contract will be created shortly.',
      NEW.id,
      NEW.matched_date
    );

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      loan_offer_id,
      creation_date
    ) VALUES (
      offer_record.lender_user_id,
      'LoanOfferMatched',
      'Loan Offer Matched',
      'Your loan offer has been matched with a borrower. A loan contract will be created shortly.',
      offer_record.id,
      NEW.matched_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_loan_matching_trigger
AFTER UPDATE ON loan_applications
FOR EACH ROW
EXECUTE FUNCTION process_loan_matching();

CREATE OR REPLACE FUNCTION process_loan_disbursement()
RETURNS TRIGGER AS $$
DECLARE
  borrower_account_record RECORD;
  platform_account_record RECORD;
  fee_account_record RECORD;
  application_record RECORD;
  offer_record RECORD;
  loan_record RECORD;
BEGIN
  -- Only process when loan is disbursed (disbursement_date is set)
  IF NEW.disbursement_date IS NOT NULL AND (OLD.disbursement_date IS NULL OR OLD.disbursement_date != NEW.disbursement_date) THEN

    -- Get loan, application and offer details
    SELECT * INTO loan_record FROM loans WHERE id = NEW.id;
    SELECT * INTO application_record FROM loan_applications WHERE id = loan_record.loan_application_id;
    SELECT * INTO offer_record FROM loan_offers WHERE id = loan_record.loan_offer_id;

    -- Find borrower account
    SELECT * INTO borrower_account_record
    FROM accounts
    WHERE user_id = application_record.borrower_user_id
    AND currency_blockchain_key = loan_record.blockchain_key
    AND currency_token_id = loan_record.principal_currency_token_id;

    -- Create borrower account if it doesn't exist
    IF borrower_account_record.id IS NULL THEN
      INSERT INTO accounts (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        balance
      ) VALUES (
        application_record.borrower_user_id,
        loan_record.blockchain_key,
        loan_record.principal_currency_token_id,
        0
      ) RETURNING * INTO borrower_account_record;
    END IF;

    -- Find platform escrow account
    SELECT * INTO platform_account_record
    FROM accounts
    WHERE user_id = 1
    AND currency_blockchain_key = loan_record.blockchain_key
    AND currency_token_id = loan_record.principal_currency_token_id
    AND account_type = 'platform_escrow';

    -- Find platform fee account
    SELECT * INTO fee_account_record
    FROM accounts
    WHERE user_id = 1
    AND currency_blockchain_key = loan_record.blockchain_key
    AND currency_token_id = loan_record.principal_currency_token_id
    AND account_type = 'platform_fees';

    -- Debit platform escrow account (principal amount)
    INSERT INTO account_mutations (
      account_id,
      mutation_type,
      mutation_date,
      amount,
      loan_id
    ) VALUES (
      platform_account_record.id,
      'LoanDisbursementPrincipal',
      NEW.disbursement_date,
      -loan_record.principal_amount,
      NEW.id
    );

    -- Credit borrower account (net disbursement amount)
    INSERT INTO account_mutations (
      account_id,
      mutation_type,
      mutation_date,
      amount,
      loan_id
    ) VALUES (
      borrower_account_record.id,
      'LoanDisbursementReceived',
      NEW.disbursement_date,
      loan_record.net_disbursement_amount,
      NEW.id
    );

    -- Credit platform fee account if fee > 0
    IF loan_record.disbursement_fee_amount > 0 THEN
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id
      ) VALUES (
        fee_account_record.id,
        'LoanDisbursementFee',
        NEW.disbursement_date,
        loan_record.disbursement_fee_amount,
        NEW.id
      );
    END IF;

    -- Update loan offer amounts
    UPDATE loan_offers
    SET reserved_principal_amount = reserved_principal_amount - loan_record.principal_amount,
        disbursed_principal_amount = disbursed_principal_amount + loan_record.principal_amount
    WHERE id = loan_record.loan_offer_id;

    -- Update loan status to active
    UPDATE loans
    SET status = 'active'
    WHERE id = NEW.id;

    -- Send disbursement notifications
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      loan_id,
      creation_date
    ) VALUES (
      application_record.borrower_user_id,
      'LoanDisbursement',
      'Loan Disbursed',
      'Your loan of ' || loan_record.net_disbursement_amount || ' has been disbursed to your account.',
      NEW.id,
      NEW.disbursement_date
    );

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      loan_id,
      creation_date
    ) VALUES (
      offer_record.lender_user_id,
      'LoanActivated',
      'Loan Activated',
      'A loan of ' || loan_record.principal_amount || ' has been activated from your offer.',
      NEW.id,
      NEW.disbursement_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_loan_disbursement_trigger
AFTER UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION process_loan_disbursement();

CREATE OR REPLACE FUNCTION process_loan_repayment()
RETURNS TRIGGER AS $$
DECLARE
  repayment_invoice_record RECORD;
  loan_record RECORD;
  application_record RECORD;
  offer_record RECORD;
  borrower_account_record RECORD;
  lender_account_record RECORD;
  platform_escrow_account_record RECORD;
  platform_fee_account_record RECORD;
BEGIN
  -- Only process when loan repayment invoice is paid (paid_date is set)
  IF NEW.paid_date IS NOT NULL AND (OLD.paid_date IS NULL OR OLD.paid_date != NEW.paid_date) THEN

    -- Check if this invoice is a loan repayment invoice
    SELECT l.* INTO loan_record
    FROM loans l
    JOIN loan_repayments lr ON l.id = lr.loan_id
    WHERE lr.repayment_invoice_id = NEW.id;

    IF loan_record.id IS NOT NULL THEN
      -- Get related records
      SELECT * INTO application_record FROM loan_applications WHERE id = loan_record.loan_application_id;
      SELECT * INTO offer_record FROM loan_offers WHERE id = loan_record.loan_offer_id;

      -- Update loan as repaid
      UPDATE loans
      SET status = 'repaid',
          concluded_date = NEW.paid_date,
          conclusion_reason = 'Fully repaid'
      WHERE id = loan_record.id;

      -- Update loan repayments
      UPDATE loan_repayments
      SET repaid_date = NEW.paid_date
      WHERE loan_id = loan_record.id;

      -- Find accounts
      SELECT * INTO borrower_account_record
      FROM accounts
      WHERE user_id = application_record.borrower_user_id
      AND currency_blockchain_key = loan_record.blockchain_key
      AND currency_token_id = loan_record.principal_currency_token_id;

      SELECT * INTO lender_account_record
      FROM accounts
      WHERE user_id = offer_record.lender_user_id
      AND currency_blockchain_key = loan_record.blockchain_key
      AND currency_token_id = loan_record.principal_currency_token_id;

      -- Create lender account if it doesn't exist
      IF lender_account_record.id IS NULL THEN
        INSERT INTO accounts (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          balance
        ) VALUES (
          offer_record.lender_user_id,
          loan_record.blockchain_key,
          loan_record.principal_currency_token_id,
          0
        ) RETURNING * INTO lender_account_record;
      END IF;

      -- Find platform accounts
      SELECT * INTO platform_escrow_account_record
      FROM accounts
      WHERE user_id = 1
      AND currency_blockchain_key = loan_record.blockchain_key
      AND currency_token_id = loan_record.collateral_currency_token_id
      AND account_type = 'platform_escrow';

      SELECT * INTO platform_fee_account_record
      FROM accounts
      WHERE user_id = 1
      AND currency_blockchain_key = loan_record.blockchain_key
      AND currency_token_id = loan_record.principal_currency_token_id
      AND account_type = 'platform_fees';

      -- Credit lender with principal + interest (minus redelivery fee)
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id,
        invoice_id
      ) VALUES (
        lender_account_record.id,
        'LoanRepaymentReceived',
        NEW.paid_date,
        loan_record.net_redelivery_amount,
        loan_record.id,
        NEW.id
      );

      -- Credit platform fee account with redelivery fee if > 0
      IF loan_record.redelivery_fee_amount > 0 THEN
        INSERT INTO account_mutations (
          account_id,
          mutation_type,
          mutation_date,
          amount,
          loan_id,
          invoice_id
        ) VALUES (
          platform_fee_account_record.id,
          'LoanReturnFee',
          NEW.paid_date,
          loan_record.redelivery_fee_amount,
          loan_record.id,
          NEW.id
        );
      END IF;

      -- Release collateral back to borrower
      SELECT * INTO borrower_account_record
      FROM accounts
      WHERE user_id = application_record.borrower_user_id
      AND currency_blockchain_key = loan_record.blockchain_key
      AND currency_token_id = loan_record.collateral_currency_token_id;

      -- Create borrower collateral account if it doesn't exist
      IF borrower_account_record.id IS NULL THEN
        INSERT INTO accounts (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          balance
        ) VALUES (
          application_record.borrower_user_id,
          loan_record.blockchain_key,
          loan_record.collateral_currency_token_id,
          0
        ) RETURNING * INTO borrower_account_record;
      END IF;

      -- Debit platform escrow (release collateral)
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id
      ) VALUES (
        platform_escrow_account_record.id,
        'LoanCollateralReleased',
        NEW.paid_date,
        -loan_record.collateral_amount,
        loan_record.id
      );

      -- Credit borrower with released collateral
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id
      ) VALUES (
        borrower_account_record.id,
        'LoanCollateralReturned',
        NEW.paid_date,
        loan_record.collateral_amount,
        loan_record.id
      );

      -- Send completion notifications
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        loan_id,
        creation_date
      ) VALUES (
        application_record.borrower_user_id,
        'LoanRepaymentCompleted',
        'Loan Repayment Completed',
        'Your loan has been fully repaid and your collateral of ' || loan_record.collateral_amount || ' has been returned.',
        loan_record.id,
        NEW.paid_date
      );

      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        loan_id,
        creation_date
      ) VALUES (
        offer_record.lender_user_id,
        'LoanRepaymentReceived',
        'Loan Repayment Received',
        'Loan repayment of ' || loan_record.net_redelivery_amount || ' has been received.',
        loan_record.id,
        NEW.paid_date
      );

    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_loan_repayment_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION process_loan_repayment();

CREATE OR REPLACE FUNCTION process_loan_liquidation()
RETURNS TRIGGER AS $$
DECLARE
  application_record RECORD;
  offer_record RECORD;
  liquidation_record RECORD;
  borrower_collateral_account_record RECORD;
  borrower_principal_account_record RECORD;
  lender_account_record RECORD;
  platform_escrow_account_record RECORD;
  platform_fee_account_record RECORD;
BEGIN
  -- Only process when loan liquidation is completed (liquidation_date is set)
  IF NEW.liquidation_date IS NOT NULL AND (OLD.liquidation_date IS NULL OR OLD.liquidation_date != NEW.liquidation_date) THEN

    -- Get related records
    SELECT * INTO application_record FROM loan_applications WHERE id = (SELECT loan_application_id FROM loans WHERE id = NEW.loan_id);
    SELECT * INTO offer_record FROM loan_offers WHERE id = (SELECT loan_offer_id FROM loans WHERE id = NEW.loan_id);
    SELECT * INTO liquidation_record FROM loans WHERE id = NEW.loan_id;

    -- Update loan as liquidated
    UPDATE loans
    SET status = 'liquidated',
        concluded_date = NEW.liquidation_date,
        conclusion_reason = 'Liquidated due to ' ||
          CASE
            WHEN liquidation_record.max_ltv_ratio_reached_date IS NOT NULL THEN 'LTV breach'
            WHEN NEW.early_closure_date IS NOT NULL THEN 'early closure'
            ELSE 'default'
          END
    WHERE id = NEW.loan_id;

    -- Find accounts
    SELECT * INTO borrower_collateral_account_record
    FROM accounts
    WHERE user_id = application_record.borrower_user_id
    AND currency_blockchain_key = liquidation_record.blockchain_key
    AND currency_token_id = liquidation_record.collateral_currency_token_id;

    SELECT * INTO borrower_principal_account_record
    FROM accounts
    WHERE user_id = application_record.borrower_user_id
    AND currency_blockchain_key = liquidation_record.blockchain_key
    AND currency_token_id = liquidation_record.principal_currency_token_id;

    -- Create borrower principal account if it doesn't exist
    IF borrower_principal_account_record.id IS NULL THEN
      INSERT INTO accounts (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        balance
      ) VALUES (
        application_record.borrower_user_id,
        liquidation_record.blockchain_key,
        liquidation_record.principal_currency_token_id,
        0
      ) RETURNING * INTO borrower_principal_account_record;
    END IF;

    -- Find lender account
    SELECT * INTO lender_account_record
    FROM accounts
    WHERE user_id = offer_record.lender_user_id
    AND currency_blockchain_key = liquidation_record.blockchain_key
    AND currency_token_id = liquidation_record.principal_currency_token_id;

    -- Create lender account if it doesn't exist
    IF lender_account_record.id IS NULL THEN
      INSERT INTO accounts (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        balance
      ) VALUES (
        offer_record.lender_user_id,
        liquidation_record.blockchain_key,
        liquidation_record.principal_currency_token_id,
        0
      ) RETURNING * INTO lender_account_record;
    END IF;

    -- Find platform accounts
    SELECT * INTO platform_escrow_account_record
    FROM accounts
    WHERE user_id = 1
    AND currency_blockchain_key = liquidation_record.blockchain_key
    AND currency_token_id = liquidation_record.collateral_currency_token_id
    AND account_type = 'platform_escrow';

    SELECT * INTO platform_fee_account_record
    FROM accounts
    WHERE user_id = 1
    AND currency_blockchain_key = liquidation_record.blockchain_key
    AND currency_token_id = liquidation_record.principal_currency_token_id
    AND account_type = 'platform_fees';

    -- Process liquidation based on mode
    IF liquidation_record.liquidation_mode = 'Full' THEN
      -- Full liquidation: Convert all collateral to principal currency

      -- Debit platform escrow (all collateral)
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id
      ) VALUES (
        platform_escrow_account_record.id,
        'LoanLiquidationCollateralUsed',
        NEW.liquidation_date,
        -liquidation_record.collateral_amount,
        NEW.loan_id
      );

      -- Credit lender with liquidation proceeds (principal + interest)
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id
      ) VALUES (
        lender_account_record.id,
        'LoanLiquidationRepayment',
        NEW.liquidation_date,
        liquidation_record.repayment_amount,
        NEW.loan_id
      );

      -- Credit platform fee account with liquidation fee
      IF NEW.early_closure_liquidation_fee_amount > 0 THEN
        INSERT INTO account_mutations (
          account_id,
          mutation_type,
          mutation_date,
          amount,
          loan_id
        ) VALUES (
          platform_fee_account_record.id,
          'LoanLiquidationFee',
          NEW.liquidation_date,
          NEW.early_closure_liquidation_fee_amount,
          NEW.loan_id
        );
      END IF;

      -- Credit borrower with any remaining liquidation surplus
      IF NEW.liquidation_release_amount > 0 THEN
        INSERT INTO account_mutations (
          account_id,
          mutation_type,
          mutation_date,
          amount,
          loan_id
        ) VALUES (
          borrower_principal_account_record.id,
          'LoanLiquidationSurplus',
          NEW.liquidation_date,
          NEW.liquidation_release_amount,
          NEW.loan_id
        );
      END IF;

    ELSE
      -- Partial liquidation: Convert only needed collateral amount

      -- Debit platform escrow (liquidation collateral amount)
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id
      ) VALUES (
        platform_escrow_account_record.id,
        'LoanLiquidationCollateralUsed',
        NEW.liquidation_date,
        -COALESCE(NEW.early_closure_collateral_amount, 0),
        NEW.loan_id
      );

      -- Credit lender with liquidation proceeds
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_id
      ) VALUES (
        lender_account_record.id,
        'LoanLiquidationRepayment',
        NEW.liquidation_date,
        liquidation_record.repayment_amount,
        NEW.loan_id
      );

      -- Credit platform fee account with liquidation fee
      IF NEW.early_closure_liquidation_fee_amount > 0 THEN
        INSERT INTO account_mutations (
          account_id,
          mutation_type,
          mutation_date,
          amount,
          loan_id
        ) VALUES (
          platform_fee_account_record.id,
          'LoanLiquidationFee',
          NEW.liquidation_date,
          NEW.early_closure_liquidation_fee_amount,
          NEW.loan_id
        );
      END IF;

      -- Return remaining collateral to borrower
      IF (liquidation_record.collateral_amount - NEW.early_closure_collateral_amount) > 0 THEN
        -- Debit platform escrow (remaining collateral)
        INSERT INTO account_mutations (
          account_id,
          mutation_type,
          mutation_date,
          amount,
          loan_id
        ) VALUES (
          platform_escrow_account_record.id,
          'LoanCollateralReleased',
          NEW.liquidation_date,
          -(liquidation_record.collateral_amount - NEW.early_closure_collateral_amount),
          NEW.loan_id
        );

        -- Credit borrower with remaining collateral
        INSERT INTO account_mutations (
          account_id,
          mutation_type,
          mutation_date,
          amount,
          loan_id
        ) VALUES (
          borrower_collateral_account_record.id,
          'LoanCollateralReturned',
          NEW.liquidation_date,
          liquidation_record.collateral_amount - NEW.early_closure_collateral_amount,
          NEW.loan_id
        );
      END IF;

    END IF;

    -- Send liquidation notifications
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      loan_id,
      creation_date
    ) VALUES (
      application_record.borrower_user_id,
      'LoanLiquidation',
      'Loan Liquidated',
      'Your loan has been liquidated. ' ||
        CASE
          WHEN liquidation_record.liquidation_mode = 'Full' THEN 'All collateral was liquidated.'
          ELSE 'Partial collateral was liquidated and remaining collateral returned.'
        END,
      NEW.loan_id,
      NEW.liquidation_date
    );

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      loan_id,
      creation_date
    ) VALUES (
      offer_record.lender_user_id,
      'LoanLiquidation',
      'Loan Liquidated',
      'A loan has been liquidated and you have received ' || liquidation_record.repayment_amount || ' in repayment.',
      NEW.loan_id,
      NEW.liquidation_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_loan_liquidation_trigger
AFTER UPDATE ON loan_liquidations
FOR EACH ROW
EXECUTE FUNCTION process_loan_liquidation();

CREATE OR REPLACE FUNCTION update_loan_ltv_on_valuation()
RETURNS TRIGGER AS $$
DECLARE
  loan_record RECORD;
  platform_config_record RECORD;
  liquidation_calc RECORD;
BEGIN
  -- Only process new loan valuations
  IF TG_OP = 'INSERT' THEN

    -- Get the loan record
    SELECT * INTO loan_record
    FROM loans
    WHERE id = NEW.loan_id;

    -- Update loan current LTV ratio
    UPDATE loans
    SET current_ltv_ratio = NEW.ltv_ratio
    WHERE id = NEW.loan_id;

    -- Check if max LTV ratio is breached
    IF NEW.ltv_ratio > loan_record.max_ltv_ratio AND loan_record.status NOT IN ('ltv_breach', 'pending_liquidation', 'liquidated', 'repaid') THEN

      -- Mark loan as reaching max LTV ratio
      UPDATE loans
      SET status = 'ltv_breach',
          max_ltv_ratio_reached_date = NEW.valuation_date
      WHERE id = NEW.loan_id;

      -- Update loan liquidations table
      UPDATE loan_liquidations
      SET early_closure_date = NEW.valuation_date,
          early_closure_exchange_rate_id = NEW.exchange_rate_id
      WHERE loan_id = NEW.loan_id;

      -- Get platform configuration for liquidation calculations
      SELECT * INTO platform_config_record
      FROM platform_configs
      ORDER BY effective_date DESC
      LIMIT 1;

      -- Calculate liquidation amounts based on liquidation mode
      IF loan_record.liquidation_mode = 'Partial' THEN
        SELECT * INTO liquidation_calc
        FROM calculate_partial_liquidation_amounts(
          loan_record.repayment_amount,
          COALESCE(loan_record.liquidation_fee_rate, 0.05),
          NEW.collateral_valuation_amount,
          loan_record.collateral_amount
        );
      ELSE
        SELECT * INTO liquidation_calc
        FROM calculate_full_liquidation_amounts(
          NEW.collateral_valuation_amount,
          COALESCE(loan_record.liquidation_fee_rate, 0.05),
          loan_record.collateral_amount,
          loan_record.repayment_amount
        );
      END IF;

      -- Update loan liquidations with calculated amounts
      UPDATE loan_liquidations
      SET early_closure_valuation_amount = liquidation_calc.valuation_amount,
          early_closure_liquidation_fee_rate = COALESCE(loan_record.liquidation_fee_rate, 0.05),
          early_closure_liquidation_fee_amount = liquidation_calc.fee_amount,
          early_closure_liquidation_amount = liquidation_calc.liquidation_amount,
          early_closure_collateral_amount = liquidation_calc.collateral_needed
      WHERE loan_id = NEW.loan_id;

      -- Trigger liquidation notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        loan_id,
        creation_date
      ) VALUES (
        (SELECT borrower_user_id FROM loan_applications WHERE id = loan_record.loan_application_id),
        'LoanLtvBreach',
        'Loan LTV Ratio Breached',
        'Your loan LTV ratio has exceeded the maximum allowed ratio. Liquidation process will begin.',
        NEW.loan_id,
        NEW.valuation_date
      );

    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_loan_ltv_on_valuation_trigger
AFTER INSERT ON loan_valuations
FOR EACH ROW
EXECUTE FUNCTION update_loan_ltv_on_valuation();

CREATE OR REPLACE FUNCTION process_loan_offer_closure()
RETURNS TRIGGER AS $$
DECLARE
  currency_record RECORD;
  lender_account_record RECORD;
  platform_account_record RECORD;
BEGIN
  -- Process loan offer closure (closed_date is set)
  IF NEW.closed_date IS NOT NULL AND (OLD.closed_date IS NULL OR OLD.closed_date != NEW.closed_date) THEN

    -- Update loan offer status
    UPDATE loan_offers
    SET status = 'closed'
    WHERE id = NEW.id;

    -- Only process if there's available principal to return
    IF NEW.available_principal_amount > 0 THEN

      -- Find platform escrow account
      SELECT * INTO platform_account_record
      FROM accounts
      WHERE user_id = 1
      AND currency_blockchain_key = NEW.blockchain_key
      AND currency_token_id = NEW.principal_currency_token_id
      AND account_type = 'platform_escrow';

      SELECT * INTO lender_account_record
      FROM accounts
      WHERE user_id = NEW.lender_user_id
      AND currency_blockchain_key = NEW.blockchain_key
      AND currency_token_id = NEW.principal_currency_token_id;

      -- Create lender account if it doesn't exist
      IF lender_account_record.id IS NULL THEN
        INSERT INTO accounts (
          user_id,
          currency_blockchain_key,
          currency_token_id,
          balance
        ) VALUES (
          NEW.lender_user_id,
          NEW.blockchain_key,
          NEW.principal_currency_token_id,
          0
        ) RETURNING * INTO lender_account_record;
      END IF;

      -- Debit platform escrow account
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_offer_id
      ) VALUES (
        platform_account_record.id,
        'LoanPrincipalReturned',
        NEW.closed_date,
        -NEW.available_principal_amount,
        NEW.id
      );

      -- Credit lender account
      INSERT INTO account_mutations (
        account_id,
        mutation_type,
        mutation_date,
        amount,
        loan_offer_id
      ) VALUES (
        lender_account_record.id,
        'LoanPrincipalReturned',
        NEW.closed_date,
        NEW.available_principal_amount,
        NEW.id
      );

    END IF;

    -- Send closure notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      loan_offer_id,
      creation_date
    ) VALUES (
      NEW.lender_user_id,
      'LoanOfferClosed',
      'Loan Offer Closed',
      'Your loan offer has been closed. ' ||
        CASE
          WHEN NEW.available_principal_amount > 0 THEN 'Unused principal of ' || NEW.available_principal_amount || ' has been returned to your account.'
          ELSE 'All principal was successfully utilized.'
        END ||
        CASE
          WHEN NEW.closure_reason IS NOT NULL THEN ' Reason: ' || NEW.closure_reason
          ELSE ''
        END,
      NEW.id,
      NEW.closed_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_loan_offer_closure_trigger
AFTER UPDATE ON loan_offers
FOR EACH ROW
EXECUTE FUNCTION process_loan_offer_closure();

CREATE OR REPLACE FUNCTION process_loan_ltv_warnings()
RETURNS TRIGGER AS $$
DECLARE
  loan_record RECORD;
  application_record RECORD;
  offer_record RECORD;
  warning_threshold DECIMAL(8, 4);
  critical_threshold DECIMAL(8, 4);
BEGIN
  -- Only process new loan valuations
  IF TG_OP = 'INSERT' THEN

    -- Get the loan and related records
    SELECT * INTO loan_record FROM loans WHERE id = NEW.loan_id;
    SELECT * INTO application_record FROM loan_applications WHERE id = loan_record.loan_application_id;
    SELECT * INTO offer_record FROM loan_offers WHERE id = loan_record.loan_offer_id;

    -- Calculate warning thresholds
    warning_threshold := loan_record.max_ltv_ratio * 0.85; -- 85% of max LTV
    critical_threshold := loan_record.max_ltv_ratio * 0.95; -- 95% of max LTV

    -- Send warning notification if approaching critical levels
    IF NEW.ltv_ratio > warning_threshold AND NEW.ltv_ratio <= critical_threshold THEN

      -- Check if we haven't sent this warning recently (within 24 hours)
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE loan_id = NEW.loan_id
        AND type = 'LiquidationWarning'
        AND creation_date > (NEW.valuation_date - INTERVAL '24 hours')
      ) THEN

        INSERT INTO notifications (
          user_id,
          type,
          title,
          content,
          loan_id,
          creation_date
        ) VALUES (
          application_record.borrower_user_id,
          'LiquidationWarning',
          'Loan LTV Warning',
          'Your loan LTV ratio has reached ' || ROUND((NEW.ltv_ratio * 100)::numeric, 2) || '%. ' ||
          'Maximum allowed is ' || ROUND((loan_record.max_ltv_ratio * 100)::numeric, 2) || '%. ' ||
          'Consider adding more collateral to avoid liquidation.',
          NEW.loan_id,
          NEW.valuation_date
        );

        -- Also notify lender
        INSERT INTO notifications (
          user_id,
          type,
          title,
          content,
          loan_id,
          creation_date
        ) VALUES (
          offer_record.lender_user_id,
          'LiquidationWarning',
          'Loan Risk Warning',
          'A loan in your portfolio has LTV ratio of ' || ROUND((NEW.ltv_ratio * 100)::numeric, 2) || '% ' ||
          'which is approaching the liquidation threshold.',
          NEW.loan_id,
          NEW.valuation_date
        );

      END IF;

    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_loan_ltv_warnings_trigger
AFTER INSERT ON loan_valuations
FOR EACH ROW
EXECUTE FUNCTION process_loan_ltv_warnings();
