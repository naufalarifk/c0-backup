--- SCHEMA ---

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL,

  currency_blockchain_key VARCHAR(64) NOT NULL,
  currency_token_id VARCHAR(64) NOT NULL,
  invoiced_amount BIGINT NOT NULL,
  paid_amount BIGINT NOT NULL DEFAULT 0,

  wallet_derivation_path VARCHAR(128) NOT NULL UNIQUE, -- specification: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
  wallet_address VARCHAR(64) NOT NULL,

  invoice_type VARCHAR(32) NOT NULL CHECK (invoice_type IN ('LoanCollateral', 'LoanPrincipal', 'LoanRepayment')),
  status VARCHAR(32) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'PartiallyPaid', 'Paid', 'Overdue', 'Expired', 'Cancelled')),

  invoice_date TIMESTAMP NOT NULL,
  notified_date TIMESTAMP,
  due_date TIMESTAMP,
  expired_date TIMESTAMP,
  paid_date TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users (id)
);

--- DEPENDENCY ---

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS invoice_id BIGINT;
ALTER TABLE account_mutations DROP CONSTRAINT IF EXISTS fk_account_mutations_invoice;
ALTER TABLE account_mutations ADD CONSTRAINT fk_account_mutations_invoice
  FOREIGN KEY (invoice_id) REFERENCES invoices (id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS invoice_id BIGINT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_invoice;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_invoice
  FOREIGN KEY (invoice_id) REFERENCES invoices (id);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  payment_date TIMESTAMP NOT NULL,
  payment_hash VARCHAR(64) NOT NULL UNIQUE,
  amount BIGINT NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices (id)
);

ALTER TABLE account_mutations ADD COLUMN IF NOT EXISTS invoice_payment_id BIGINT;
ALTER TABLE account_mutations DROP CONSTRAINT IF EXISTS fk_account_mutations_invoice_payment;
ALTER TABLE account_mutations ADD CONSTRAINT fk_account_mutations_invoice_payment
  FOREIGN KEY (invoice_payment_id) REFERENCES invoice_payments (id);

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
  -- Validate status transitions
  IF OLD IS NOT NULL AND OLD.status != NEW.status THEN
    -- Only allow certain status transitions
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

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
  new_paid_amount BIGINT;
  previous_paid_amount BIGINT;
  new_status VARCHAR(32);
BEGIN
  SELECT * INTO invoice_record
  FROM invoices
  WHERE id = NEW.invoice_id;

  previous_paid_amount := invoice_record.paid_amount;

  SELECT COALESCE(SUM(amount), 0) INTO new_paid_amount
  FROM invoice_payments
  WHERE invoice_id = NEW.invoice_id;

  -- TODO: This rule still need to be discussed
  -- in blockchain, we cannot prevent users from paying more than invoiced amount
  -- IF new_paid_amount > invoice_record.invoiced_amount THEN
  --   RAISE EXCEPTION 'Total payments (%) would exceed invoiced amount (%)',
  --     new_paid_amount, invoice_record.invoiced_amount;
  -- END IF;

  -- Determine new status based on payment amount
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
      WHEN new_paid_amount >= invoiced_amount
           AND NEW.payment_date <= COALESCE(due_date, NEW.payment_date)
           AND NEW.payment_date >= invoice_date
      THEN NEW.payment_date
      ELSE paid_date
    END
  WHERE id = NEW.invoice_id;

  IF new_paid_amount >= invoice_record.invoiced_amount THEN
    -- Invoice fully paid
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
    -- Partial payment received
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

CREATE OR REPLACE TRIGGER update_invoice_on_payment_trigger
AFTER INSERT ON invoice_payments
FOR EACH ROW
EXECUTE FUNCTION update_invoice_on_payment();

CREATE OR REPLACE FUNCTION create_account_mutation_on_invoice_payment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_record RECORD;
  account_record RECORD;
BEGIN
  IF NEW.paid_date IS NOT NULL AND (OLD.paid_date IS NULL OR OLD.paid_date != NEW.paid_date) THEN
    SELECT * INTO invoice_record FROM invoices WHERE id = NEW.id;

    -- Find the appropriate account for this invoice owner and currency
    SELECT * INTO account_record
    FROM accounts
    WHERE user_id = invoice_record.user_id
      AND currency_blockchain_key = invoice_record.currency_blockchain_key
      AND currency_token_id = invoice_record.currency_token_id;

    -- Check if account exists
    IF account_record.id IS NULL THEN
      RAISE EXCEPTION 'No account found for invoice owner with currency % %',
        invoice_record.currency_blockchain_key, invoice_record.currency_token_id;
    END IF;

    -- Create account mutation for the invoice payment
    INSERT INTO account_mutations (
      account_id,
      mutation_type,
      mutation_date,
      amount,
      invoice_id
    ) VALUES (
      account_record.id,
      'InvoiceReceived',
      NEW.paid_date,
      invoice_record.paid_amount,
      invoice_record.id
    );

    -- Create notification for successful account credit
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
      'Funds Credited to Account',
      'Invoice #' || invoice_record.id || ' payment of ' || invoice_record.paid_amount || ' has been credited to your account.',
      invoice_record.id,
      NEW.paid_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER create_account_mutation_on_invoice_payment_trigger
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION create_account_mutation_on_invoice_payment();
