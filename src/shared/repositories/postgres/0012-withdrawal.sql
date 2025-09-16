--- SCHEMA ---

CREATE TABLE IF NOT EXISTS beneficiaries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id),
  blockchain_key VARCHAR(64) NOT NULL,
  address VARCHAR(64) NOT NULL
);

ALTER TABLE beneficiaries DROP CONSTRAINT IF EXISTS fk_beneficiaries_currency;
ALTER TABLE beneficiaries DROP COLUMN IF EXISTS currency_blockchain_key;
ALTER TABLE beneficiaries DROP COLUMN IF EXISTS currency_token_id;
ALTER TABLE beneficiaries ADD CONSTRAINT fk_beneficiaries_blockchain FOREIGN KEY (blockchain_key) REFERENCES blockchains (key);
ALTER TABLE beneficiaries ADD CONSTRAINT uq_beneficiaries_user_blockchain_address UNIQUE (user_id, blockchain_key, address);

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGSERIAL PRIMARY KEY,
  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,
  beneficiary_id BIGINT NOT NULL REFERENCES beneficiaries (id),
  amount BIGINT NOT NULL,
  request_date TIMESTAMP NOT NULL,
  request_amount DECIMAL(78, 0) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Requested',
  sent_date TIMESTAMP,
  sent_amount DECIMAL(78, 0), -- for future compatibility when withdrawal fee is applied
  sent_hash VARCHAR(64) UNIQUE,
  confirmed_date TIMESTAMP,
  failed_date TIMESTAMP,
  failure_reason TEXT,
  failure_refund_reviewer_user_id BIGINT REFERENCES users (id),
  failure_refund_approved_date TIMESTAMP,
  failure_refund_rejected_date TIMESTAMP,
  failure_refund_rejection_reason TEXT,
  FOREIGN KEY (currency_blockchain_key, currency_token_id) REFERENCES currencies (blockchain_key, token_id),
  CHECK (
    -- Status validation
    status IN ('Requested', 'Sent', 'Confirmed', 'Failed', 'RefundApproved', 'RefundRejected') AND
    -- Status-based consistency checks: sent_date required for Sent/Confirmed statuses
    (status IN ('Requested', 'Failed', 'RefundApproved', 'RefundRejected') OR sent_date IS NOT NULL) AND
    -- Hash consistency: if sent_date exists, sent_hash must exist
    (sent_date IS NULL OR sent_hash IS NOT NULL) AND
    -- Confirmed date only for Confirmed status
    (status = 'Confirmed' OR confirmed_date IS NULL) AND
    -- Failed date only for Failed/Refund statuses
    (status IN ('Failed', 'RefundApproved', 'RefundRejected') OR failed_date IS NULL) AND
    -- Refund dates only for refund statuses
    (status IN ('RefundApproved', 'RefundRejected') OR (failure_refund_approved_date IS NULL AND failure_refund_rejected_date IS NULL)) AND
    -- Amount consistency
    (sent_amount IS NULL OR sent_amount > 0) AND
    (sent_amount IS NULL OR sent_amount <= request_amount * 1.1) -- Allow for small fee adjustments
  )
);

ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS currency_token_id VARCHAR(64) NOT NULL;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS currency_blockchain_key VARCHAR(64) NOT NULL;
ALTER TABLE withdrawals ADD CONSTRAINT fk_withdrawals_currency FOREIGN KEY (currency_blockchain_key, currency_token_id) REFERENCES currencies (blockchain_key, token_id);

--- DEPENDENCY ---

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS withdrawal_id BIGINT REFERENCES withdrawals (id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS withdrawal_id BIGINT REFERENCES withdrawals (id);

--- TRIGGER ---

CREATE OR REPLACE FUNCTION validate_beneficiary_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM blockchains
    WHERE key = NEW.blockchain_key
  ) THEN
    RAISE EXCEPTION 'Blockchain does not exist: %', NEW.blockchain_key;
  END IF;
  IF NEW.address IS NULL OR LENGTH(TRIM(NEW.address)) = 0 THEN
    RAISE EXCEPTION 'Beneficiary address cannot be empty';
  END IF;
  IF EXISTS (
    SELECT 1 FROM beneficiaries
    WHERE user_id = NEW.user_id
    AND blockchain_key = NEW.blockchain_key
    AND address = NEW.address
    AND (TG_OP = 'INSERT' OR id != NEW.id)
  ) THEN
    RAISE EXCEPTION 'Duplicate beneficiary address for user and blockchain combination';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_beneficiary_data_trigger
BEFORE INSERT OR UPDATE ON beneficiaries
FOR EACH ROW
EXECUTE FUNCTION validate_beneficiary_data();

CREATE OR REPLACE FUNCTION validate_withdrawal_data()
RETURNS TRIGGER AS $$
DECLARE
  beneficiary_record RECORD;
  old_status TEXT;
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;
  IF NEW.request_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal request amount must be positive';
  END IF;

  SELECT * INTO beneficiary_record
  FROM beneficiaries
  WHERE id = NEW.beneficiary_id;

  IF beneficiary_record.id IS NULL THEN
    RAISE EXCEPTION 'Beneficiary with id % does not exist', NEW.beneficiary_id;
  END IF;

  -- Validate that currency exists
  IF NOT EXISTS (
    SELECT 1 FROM currencies
    WHERE blockchain_key = NEW.currency_blockchain_key
    AND token_id = NEW.currency_token_id
  ) THEN
    RAISE EXCEPTION 'Currency does not exist: % %', NEW.currency_blockchain_key, NEW.currency_token_id;
  END IF;

  -- Validate that beneficiary's blockchain matches withdrawal currency's blockchain
  IF beneficiary_record.blockchain_key != NEW.currency_blockchain_key THEN
    RAISE EXCEPTION 'Withdrawal currency blockchain % does not match beneficiary blockchain %', 
      NEW.currency_blockchain_key, beneficiary_record.blockchain_key;
  END IF;

  -- Status transition validation
  IF TG_OP = 'UPDATE' THEN
    old_status := OLD.status;

    -- Validate status transitions
    IF old_status = 'Requested' AND NEW.status NOT IN ('Requested', 'Sent', 'Failed') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', old_status, NEW.status;
    END IF;

    IF old_status = 'Sent' AND NEW.status NOT IN ('Sent', 'Confirmed', 'Failed') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', old_status, NEW.status;
    END IF;

    IF old_status = 'Confirmed' AND NEW.status != 'Confirmed' THEN
      RAISE EXCEPTION 'Cannot change status from Confirmed to %', NEW.status;
    END IF;

    IF old_status = 'Failed' AND NEW.status NOT IN ('Failed', 'RefundApproved', 'RefundRejected') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', old_status, NEW.status;
    END IF;

    IF old_status IN ('RefundApproved', 'RefundRejected') AND NEW.status != old_status THEN
      RAISE EXCEPTION 'Cannot change status from % to %', old_status, NEW.status;
    END IF;
  END IF;

  -- Status-specific field requirements
  IF NEW.status IN ('Sent', 'Confirmed') AND NEW.sent_amount IS NULL THEN
    RAISE EXCEPTION 'Sent amount must be specified when status is %', NEW.status;
  END IF;

  IF NEW.sent_amount IS NOT NULL AND NEW.sent_amount <= 0 THEN
    RAISE EXCEPTION 'Sent amount must be positive';
  END IF;

  IF NEW.status IN ('RefundApproved', 'RefundRejected') AND NEW.failed_date IS NULL THEN
    RAISE EXCEPTION 'Failed date must be set for refund status %', NEW.status;
  END IF;

  IF NEW.status = 'RefundRejected' AND NEW.failure_refund_rejection_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason must be provided when refund is rejected';
  END IF;

  -- Time consistency validations (for backward compatibility)
  IF NEW.sent_date IS NOT NULL AND NEW.request_date > NEW.sent_date THEN
    RAISE EXCEPTION 'Request date cannot be after sent date';
  END IF;
  IF NEW.confirmed_date IS NOT NULL AND NEW.sent_date IS NOT NULL AND NEW.sent_date > NEW.confirmed_date THEN
    RAISE EXCEPTION 'Sent date cannot be after confirmed date';
  END IF;
  IF NEW.failed_date IS NOT NULL AND NEW.request_date > NEW.failed_date THEN
    RAISE EXCEPTION 'Request date cannot be after failed date';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_withdrawal_data_trigger
BEFORE INSERT OR UPDATE ON withdrawals
FOR EACH ROW
EXECUTE FUNCTION validate_withdrawal_data();

CREATE OR REPLACE FUNCTION create_account_mutation_on_withdrawal_request()
RETURNS TRIGGER AS $$
DECLARE
  beneficiary_record RECORD;
  account_record RECORD;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'Requested' AND NEW.request_date IS NOT NULL THEN

    SELECT * INTO beneficiary_record
    FROM beneficiaries
    WHERE id = NEW.beneficiary_id;

    -- Get account by user and currency from the withdrawal record
    SELECT * INTO account_record
    FROM accounts
    WHERE user_id = beneficiary_record.user_id
      AND currency_blockchain_key = NEW.currency_blockchain_key
      AND currency_token_id = NEW.currency_token_id;

    -- Create account if it doesn't exist
    IF account_record.id IS NULL THEN
      INSERT INTO accounts (
        user_id,
        currency_blockchain_key,
        currency_token_id,
        balance
      ) VALUES (
        beneficiary_record.user_id,
        NEW.currency_blockchain_key,
        NEW.currency_token_id,
        0
      ) RETURNING * INTO account_record;
    END IF;

    INSERT INTO account_mutations (
      account_id,
      mutation_type,
      mutation_date,
      amount,
      withdrawal_id
    ) VALUES (
      account_record.id,
      'WithdrawalRequested',
      NEW.request_date,
      -NEW.amount, -- Negative amount to debit the account
      NEW.id
    );


  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER create_account_mutation_on_withdrawal_request_trigger
AFTER INSERT ON withdrawals
FOR EACH ROW
EXECUTE FUNCTION create_account_mutation_on_withdrawal_request();

CREATE OR REPLACE FUNCTION create_account_mutation_on_withdrawal_refund()
RETURNS TRIGGER AS $$
DECLARE
  beneficiary_record RECORD;
  account_record RECORD;
BEGIN
  -- Only process when withdrawal status changes to RefundApproved
  IF
    TG_OP = 'UPDATE' AND
    OLD.status != 'RefundApproved' AND
    NEW.status = 'RefundApproved' AND
    NEW.failure_refund_approved_date IS NOT NULL AND
    (
      OLD.failure_refund_approved_date IS NULL OR
      OLD.failure_refund_approved_date != NEW.failure_refund_approved_date
    ) THEN
    -- Get beneficiary information
    SELECT * INTO beneficiary_record
    FROM beneficiaries
    WHERE id = NEW.beneficiary_id;

    -- Find the appropriate account for the withdrawal owner using currency from withdrawal
    SELECT * INTO account_record
    FROM accounts
    WHERE user_id = beneficiary_record.user_id
      AND currency_blockchain_key = NEW.currency_blockchain_key
      AND currency_token_id = NEW.currency_token_id;

    -- Create account mutation for withdrawal refund (credit)
    INSERT INTO account_mutations (
      account_id,
      mutation_type,
      mutation_date,
      amount,
      withdrawal_id
    ) VALUES (
      account_record.id,
      'WithdrawalRefunded',
      NEW.failure_refund_approved_date,
      NEW.amount, -- Positive amount to credit the account back
      NEW.id
    );


  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER create_account_mutation_on_withdrawal_refund_trigger
AFTER UPDATE ON withdrawals
FOR EACH ROW
EXECUTE FUNCTION create_account_mutation_on_withdrawal_refund();

CREATE OR REPLACE FUNCTION enhanced_withdrawal_state_validation()
RETURNS TRIGGER AS $$
DECLARE
  beneficiary_record RECORD;
  total_pending_amount DECIMAL(78, 0);
  account_balance BIGINT;
BEGIN
  -- Get beneficiary information
  SELECT * INTO beneficiary_record
  FROM beneficiaries
  WHERE id = NEW.beneficiary_id;

  -- Additional validation for new withdrawals
  IF TG_OP = 'INSERT' AND NEW.status = 'Requested' THEN

    -- Check daily withdrawal limits using status instead of dates
    SELECT COALESCE(SUM(w.amount), 0) INTO total_pending_amount
    FROM withdrawals w
    JOIN beneficiaries b ON w.beneficiary_id = b.id
    WHERE b.user_id = beneficiary_record.user_id
    AND w.request_date >= CURRENT_DATE
    AND w.status NOT IN ('Confirmed', 'RefundApproved');

    -- Get current account balance using currency from withdrawal
    SELECT COALESCE(balance, 0) INTO account_balance
    FROM accounts
    WHERE user_id = beneficiary_record.user_id
    AND currency_blockchain_key = NEW.currency_blockchain_key
    AND currency_token_id = NEW.currency_token_id;

    -- Ensure sufficient balance including this withdrawal
    IF account_balance < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient account balance for withdrawal. Available: %, Requested: %',
        account_balance, NEW.amount;
    END IF;

  END IF;

  -- Enhanced state transition validation
  IF TG_OP = 'UPDATE' THEN

    -- Cannot modify sent details once confirmed
    IF OLD.status = 'Confirmed' AND (
      NEW.sent_amount != OLD.sent_amount OR
      NEW.sent_hash != OLD.sent_hash OR
      NEW.sent_date != OLD.sent_date
    ) THEN
      RAISE EXCEPTION 'Cannot modify withdrawal details after confirmation';
    END IF;

    -- Cannot change failure reason after refund is processed
    IF OLD.status IN ('RefundApproved', 'RefundRejected') AND
       NEW.failure_reason != OLD.failure_reason THEN
      RAISE EXCEPTION 'Cannot change failure reason after refund is processed';
    END IF;

    -- Validate refund reviewer is admin
    IF NEW.failure_refund_reviewer_user_id IS NOT NULL AND
       NEW.failure_refund_reviewer_user_id != OLD.failure_refund_reviewer_user_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.failure_refund_reviewer_user_id AND role = 'Admin'
      ) THEN
        RAISE EXCEPTION 'Refund reviewer must be an admin user';
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER enhanced_withdrawal_state_validation_trigger
BEFORE INSERT OR UPDATE ON withdrawals
FOR EACH ROW
EXECUTE FUNCTION enhanced_withdrawal_state_validation();
