--- SCHEMA ---

CREATE TABLE IF NOT EXISTS user_kycs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users (id),

  id_card_photo TEXT NOT NULL,
  -- selfie_photo TEXT NOT NULL, -- deleted as of requirement adjustment
  selfie_with_id_card_photo TEXT NOT NULL,
  nik VARCHAR(16) NOT NULL,
  name VARCHAR(160) NOT NULL,
  birth_city VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  province VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  subdistrict VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  -- phone_number VARCHAR(15) NOT NULL, -- deleted as of requirement adjustment

  status VARCHAR(20) NOT NULL DEFAULT 'Submitted',
  submitted_date TIMESTAMP NOT NULL,
  verifier_user_id BIGINT REFERENCES users (id),
  verified_date TIMESTAMP,
  rejected_date TIMESTAMP,
  rejection_reason TEXT,

  CHECK (
    user_id IS NOT NULL AND
    status IN ('Submitted', 'Verified', 'Rejected') AND
    -- Cannot be both verified and rejected
    (verified_date IS NULL OR rejected_date IS NULL) AND
    -- Rejection reason required when rejected
    (rejected_date IS NULL OR rejection_reason IS NOT NULL) AND
    -- Status must align with time-based actions
    (status = 'Submitted' AND verified_date IS NULL AND rejected_date IS NULL) OR
    (status = 'Verified' AND verified_date IS NOT NULL AND rejected_date IS NULL) OR
    (status = 'Rejected' AND rejected_date IS NOT NULL AND verified_date IS NULL)
  )
);

ALTER TABLE user_kycs DROP COLUMN IF EXISTS selfie_photo;
ALTER TABLE user_kycs DROP COLUMN IF EXISTS phone_number;

-- Add partial unique constraint on NIK only for verified KYCs
CREATE UNIQUE INDEX IF NOT EXISTS unique_verified_nik ON user_kycs (nik) WHERE status = 'Verified';

--- DEPENDENCY ---

ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_id BIGINT REFERENCES user_kycs (id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_kyc_id BIGINT REFERENCES user_kycs (id);

--- TRIGGER ---

CREATE OR REPLACE FUNCTION validate_kyc_submission()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.user_id
    AND user_type = 'Individual'
  ) THEN
    RAISE EXCEPTION 'Only users with Individual user type can submit KYC applications';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_kyc_submission_trigger
BEFORE INSERT OR UPDATE ON user_kycs
FOR EACH ROW
EXECUTE FUNCTION validate_kyc_submission();

CREATE OR REPLACE FUNCTION update_user_kyc_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.verified_date IS NOT NULL OR OLD.rejected_date IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify a KYC application that has already been verified or rejected';
  END IF;

  IF OLD.verified_date IS NULL AND NEW.verified_date IS NOT NULL THEN

    NEW.status = 'Verified';

    UPDATE users
    SET kyc_id = NEW.id
    WHERE id = NEW.user_id;


  END IF;

  IF OLD.rejected_date IS NULL AND NEW.rejected_date IS NOT NULL THEN

    NEW.status = 'Rejected';


  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_user_kyc_on_approval_trigger
BEFORE UPDATE ON user_kycs
FOR EACH ROW
EXECUTE FUNCTION update_user_kyc_on_approval();
