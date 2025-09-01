--- SCHEMA ---

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL REFERENCES users (id),

  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,

  -- use case: on loan, platform requires USD principal currency to be cross-chain USD-Pegged Token, so these column can be use as account mutation redirection
  account_blockchain_key VARCHAR(64) DEFAULT NULL,
  account_token_id VARCHAR(64) DEFAULT NULL,

  invoiced_amount DECIMAL(78, 0) NOT NULL,
  prepaid_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(78, 0) NOT NULL DEFAULT 0,

  wallet_derivation_path VARCHAR(128) NOT NULL UNIQUE, -- specification: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
  wallet_address VARCHAR(64) NOT NULL,

  invoice_type VARCHAR(32) NOT NULL CHECK (invoice_type IN ('LoanCollateral', 'LoanPrincipal', 'LoanRepayment')),
  status VARCHAR(32) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'PartiallyPaid', 'Paid', 'Overdue', 'Expired', 'Cancelled')),

  draft_date TIMESTAMP NOT NULL,
  invoice_date TIMESTAMP,
  notified_date TIMESTAMP,
  due_date TIMESTAMP,
  expired_date TIMESTAMP,
  paid_date TIMESTAMP,

  FOREIGN KEY (currency_blockchain_key, currency_token_id) REFERENCES currencies (blockchain_key, token_id)
);

COMMENT ON COLUMN invoices.account_blockchain_key IS 'If set, account mutation will be posted to this blockchain instead of currency blockchain';
COMMENT ON COLUMN invoices.account_token_id IS 'If set, account mutation will be posted to this token instead of currency token';
COMMENT ON COLUMN invoices.prepaid_amount IS 'Amount that is prepaid by the user platform balance';
COMMENT ON COLUMN invoices.wallet_derivation_path IS 'BIP32 derivation path, e.g. m/44''/0''/0''/0/0';

CREATE TABLE IF NOT EXISTS invoice_items (
  invoice_id BIGINT NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  label VARCHAR(128) NOT NULL,
  amount DECIMAL(78, 0) NOT NULL,
  PRIMARY KEY (invoice_id, line_number)
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices (id),
  payment_date TIMESTAMP NOT NULL,
  payment_hash VARCHAR(64) NOT NULL UNIQUE,
  amount BIGINT NOT NULL
);

--- DEPENDENCY ---

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES invoices (id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES invoices (id);
ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS invoice_payment_id BIGINT REFERENCES invoice_payments (id);


--- TRIGGER ---

CREATE OR REPLACE FUNCTION validate_invoice_data()
RETURNS TRIGGER AS $$
BEGIN

  IF NEW.invoiced_amount <= 0 THEN
    RAISE EXCEPTION 'Invoice amount must be positive';
  END IF;

  IF NEW.paid_amount < 0 THEN
    RAISE EXCEPTION 'Paid amount cannot be negative';
  END IF;

  -- TODO: This rule still need to be discussed
  -- in blockchain, we cannot prevent users from paying more than invoiced amount
  -- IF NEW.paid_amount > NEW.invoiced_amount THEN
  --   RAISE EXCEPTION 'Paid amount cannot exceed invoiced amount';
  -- END IF;
  -- Validate date constraints
  IF NEW.due_date IS NOT NULL AND NEW.invoice_date > NEW.due_date THEN
    RAISE EXCEPTION 'Invoice date cannot be after due date';
  END IF;

  IF NEW.expired_date IS NOT NULL AND NEW.due_date IS NOT NULL AND NEW.due_date > NEW.expired_date THEN
    RAISE EXCEPTION 'Due date cannot be after expired date';
  END IF;

  IF OLD IS NOT NULL AND OLD.status != NEW.status THEN
    IF (OLD.status = 'Pending' AND NEW.status NOT IN ('PartiallyPaid', 'Paid', 'Overdue', 'Expired', 'Cancelled')) OR
       (OLD.status = 'PartiallyPaid' AND NEW.status NOT IN ('Paid', 'Overdue', 'Expired', 'Cancelled')) OR
       (OLD.status = 'Paid' AND NEW.status NOT IN ('Paid')) OR
       (OLD.status = 'Overdue' AND NEW.status NOT IN ('Paid', 'Expired', 'Cancelled')) OR
       (OLD.status = 'Expired' AND NEW.status NOT IN ('Expired')) OR
       (OLD.status = 'Cancelled' AND NEW.status NOT IN ('Cancelled')) THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM currencies
    WHERE blockchain_key = NEW.currency_blockchain_key
    AND token_id = NEW.currency_token_id
  ) THEN
    RAISE EXCEPTION 'Currency does not exist: % %', NEW.currency_blockchain_key, NEW.currency_token_id;
  END IF;

  IF NEW.wallet_derivation_path !~ '^m(/[0-9]+''?)+$' THEN
    RAISE EXCEPTION 'Invalid wallet derivation path format: %', NEW.wallet_derivation_path;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_invoice_data_trigger
BEFORE INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION validate_invoice_data();

CREATE OR REPLACE FUNCTION validate_invoice_payment_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM invoices WHERE id = NEW.invoice_id) THEN
    RAISE EXCEPTION 'Invoice with id % does not exist', NEW.invoice_id;
  END IF;

  IF NEW.payment_hash IS NULL OR LENGTH(TRIM(NEW.payment_hash)) = 0 THEN
    RAISE EXCEPTION 'Payment hash cannot be empty';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_invoice_payment_data_trigger
BEFORE INSERT OR UPDATE ON invoice_payments
FOR EACH ROW
EXECUTE FUNCTION validate_invoice_payment_data();

CREATE OR REPLACE FUNCTION post_account_mutation_on_invoice_prepaid()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.prepaid_amount > 0 THEN
    INSERT INTO account_mutation_entries (
      user_id,
      currency_blockchain_key,
      currency_token_id,
      account_type,
      mutation_type,
      mutation_date,
      amount
    ) VALUES (
      NEW.user_id,
      COALESCE(NEW.account_blockchain_key, NEW.currency_blockchain_key),
      COALESCE(NEW.account_token_id, NEW.currency_token_id),
      'User',
      'InvoicePrepaid',
      NEW.invoice_date,
      -NEW.prepaid_amount
    );
    UPDATE account_mutations
    SET invoice_id = NEW.id
    WHERE invoice_id IS NULL
      AND account_mutations.user_id = NEW.user_id
      AND account_mutations.mutation_type = 'InvoicePrepaid'
      AND account_mutations.mutation_date = NEW.invoice_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_invoice_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
  new_paid_amount DECIMAL(78, 0);
  previous_paid_amount DECIMAL(78, 0);
  new_status VARCHAR(64);
BEGIN

  SELECT id, user_id, invoiced_amount, paid_amount, status
  INTO invoice_record
  FROM invoices
  WHERE id = NEW.invoice_id;

  previous_paid_amount := invoice_record.paid_amount;

  SELECT invoices.prepaid_amount + COALESCE(SUM(invoice_payments.amount), 0)
  INTO new_paid_amount
  FROM invoices
  JOIN invoice_payments ON invoice_payments.invoice_id = invoices.id
  WHERE invoices.id = NEW.invoice_id
  GROUP BY invoices.id;

  -- TODO: This rule still need to be discussed
  -- in blockchain, we cannot prevent users from paying more than invoiced amount
  -- IF new_paid_amount > invoice_record.invoiced_amount THEN
  --   RAISE EXCEPTION 'Total payments (%) would exceed invoiced amount (%)',
  --     new_paid_amount, invoice_record.invoiced_amount;
  -- END IF;

  IF new_paid_amount >= invoice_record.invoiced_amount THEN
    new_status := 'Paid';
  ELSIF new_paid_amount > 0 THEN
    new_status := 'PartiallyPaid';
  ELSE
    new_status := invoice_record.status;
  END IF;

  UPDATE invoices
  SET
    paid_amount = new_paid_amount,
    status = new_status,
    paid_date = CASE
      WHEN paid_date IS NULL
        AND new_paid_amount >= invoiced_amount
        AND NEW.payment_date <= COALESCE(due_date, NEW.payment_date)
        AND NEW.payment_date >= invoice_date
      THEN NEW.payment_date
      ELSE paid_date
    END
  WHERE id = NEW.invoice_id;

  IF new_paid_amount >= invoice_record.invoiced_amount THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      invoice_id,
      creation_date
    ) VALUES (
      invoice_record.user_id,
      'InvoicePaid',
      'Invoice Fully Paid',
      'Invoice #' || invoice_record.id || ' has been fully paid.',
      invoice_record.id,
      NEW.payment_date
    );
  ELSIF previous_paid_amount = 0 AND new_paid_amount > 0 THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      invoice_id,
      creation_date
    ) VALUES (
      invoice_record.user_id,
      'InvoicePartiallyPaid',
      'Invoice Payment Received',
      'Payment received for invoice #' || invoice_record.id || '. Amount: ' || NEW.amount,
      invoice_record.id,
      NEW.payment_date
    );
  ELSIF new_paid_amount > previous_paid_amount THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      invoice_id,
      creation_date
    ) VALUES (
      invoice_record.user_id,
      'InvoicePartiallyPaid',
      'Additional Invoice Payment Received',
      'Additional payment received for invoice #' || invoice_record.id || '. Amount: ' || NEW.amount,
      invoice_record.id,
      NEW.payment_date
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_invoice_payment_trigger
AFTER INSERT ON invoice_payments
FOR EACH ROW
EXECUTE FUNCTION process_invoice_payment();

CREATE OR REPLACE FUNCTION post_account_mutation_on_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
BEGIN

  IF OLD.paid_date IS NULL AND NEW.paid_date IS NOT NULL THEN

    SELECT
      id,
      user_id,
      currency_blockchain_key,
      currency_token_id,
      account_blockchain_key,
      account_token_id,
      paid_amount
    INTO invoice_record
    FROM invoices
    WHERE id = NEW.id;

    INSERT INTO account_mutation_entries (
      user_id,
      currency_blockchain_key,
      currency_token_id,
      account_type,
      mutation_type,
      mutation_date,
      amount
    ) VALUES (
      invoice_record.user_id,
      COALESCE(invoice_record.account_blockchain_key, invoice_record.currency_blockchain_key),
      COALESCE(invoice_record.account_token_id, invoice_record.currency_token_id),
      'User',
      'InvoiceReceived',
      NEW.paid_date,
      invoice_record.paid_amount
    );

    UPDATE account_mutations
    SET invoice_id = NEW.id
    WHERE invoice_id IS NULL
      AND account_mutations.user_id = invoice_record.user_id
      AND account_mutations.mutation_type = 'InvoiceReceived'
      AND account_mutations.mutation_date = NEW.paid_date;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER post_account_mutation_on_invoice_paid_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION post_account_mutation_on_invoice_paid();
