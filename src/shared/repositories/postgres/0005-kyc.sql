--- SCHEMA ---

CREATE TABLE IF NOT EXISTS user_kycs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users (id),
  submitted_date TIMESTAMP NOT NULL,
  id_card_photo TEXT NOT NULL,
  selfie_photo TEXT NOT NULL,
  selfie_with_id_card_photo TEXT NOT NULL,
  nik VARCHAR(16) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  birth_city VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  province VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  subdistrict VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  phone_number VARCHAR(15) NOT NULL,
  verifier_user_id BIGINT REFERENCES users (id),
  verified_date TIMESTAMP,
  rejected_date TIMESTAMP,
  rejection_reason TEXT,

  CHECK (
    user_id IS NOT NULL AND
    -- Cannot be both verified and rejected
    (verified_date IS NULL OR rejected_date IS NULL) AND
    -- Rejection reason required when rejected
    (rejected_date IS NULL OR rejection_reason IS NOT NULL)
  )
);

--- DEPENDENCY ---

ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_id BIGINT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_kyc;
ALTER TABLE users ADD CONSTRAINT fk_users_kyc
  FOREIGN KEY (kyc_id) REFERENCES user_kycs (id);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_kyc_id BIGINT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_user_kyc;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user_kyc
  FOREIGN KEY (user_kyc_id) REFERENCES user_kycs (id);

--- TRIGGER ---

CREATE OR REPLACE FUNCTION update_user_kyc_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- KYC is verified
  IF NEW.verified_date IS NOT NULL AND (OLD.verified_date IS NULL OR OLD.verified_date != NEW.verified_date) THEN
    UPDATE users
    SET kyc_id = NEW.id
    WHERE id = NEW.user_id;
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      user_kyc_id,
      creation_date
    ) VALUES (
      NEW.user_id,
      'UserKycVerified',
      'KYC Verification Approved',
      'Your identity verification has been approved. You can now access all platform features.',
      NEW.id,
      NEW.verified_date
    );
  END IF;

  -- KYC is rejected
  IF NEW.rejected_date IS NOT NULL AND (OLD.rejected_date IS NULL OR OLD.rejected_date != NEW.rejected_date) THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      user_kyc_id,
      creation_date
    ) VALUES (
      NEW.user_id,
      'UserKycRejected',
      'KYC Verification Rejected',
      CASE
        WHEN NEW.rejection_reason IS NOT NULL THEN
          'Your identity verification was rejected. Reason: ' || NEW.rejection_reason || '. You may resubmit your documents.'
        ELSE
          'Your identity verification was rejected. Please resubmit your documents with correct information.'
      END,
      NEW.id,
      NEW.rejected_date
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_user_kyc_on_approval_trigger
AFTER UPDATE ON user_kycs
FOR EACH ROW
EXECUTE FUNCTION update_user_kyc_on_approval();
