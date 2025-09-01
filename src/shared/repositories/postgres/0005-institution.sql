--- SCHEMA ---

CREATE TABLE IF NOT EXISTS institution_applications (
  id BIGSERIAL PRIMARY KEY,
  applicant_user_id BIGINT NOT NULL REFERENCES users (id),

  -- Basic business information
  business_name VARCHAR(160) NOT NULL,
  business_description TEXT,
  business_type VARCHAR(100), -- e.g., "PT", "CV", "UD", etc.

  -- Indonesian business registration documents
  -- NPWP (Taxpayer Identification Number)
  npwp_number VARCHAR(20) NOT NULL, -- format: XX.XXX.XXX.X-XXX.XXX
  npwp_document_path TEXT NOT NULL,

  -- Company Registration Certificate (TDP) / Business Registration Number (NIB)
  registration_number VARCHAR(50) NOT NULL, -- NIB or TDP number
  registration_document_path TEXT NOT NULL,

  -- Deed of Establishment (Akta Pendirian)
  deed_of_establishment_path TEXT NOT NULL,
  deed_establishment_number VARCHAR(50),
  deed_establishment_date DATE,
  notary_name VARCHAR(160),

  -- Ministry of Law and Human Rights Approval (SK Kemenkumham)
  ministry_approval_number VARCHAR(50),
  ministry_approval_document_path TEXT,
  ministry_approval_date DATE,

  -- Company Domicile Certificate (SKDP - Surat Keterangan Domisili Perusahaan) TBD
  -- domicile_certificate_path TEXT,
  -- domicile_certificate_number VARCHAR(50),

  -- Business Address Information
  business_address TEXT NOT NULL,
  business_city VARCHAR(100) NOT NULL,
  business_province VARCHAR(100) NOT NULL,
  business_postal_code VARCHAR(10) NOT NULL,

  -- Director/Owner Information
  director_name VARCHAR(160) NOT NULL,
  director_id_card_path TEXT NOT NULL, -- KTP of company director
  director_position VARCHAR(100) DEFAULT 'Director',

  -- Bank Account Information
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(30),
  bank_account_holder_name VARCHAR(160),

  -- Additional Supporting Documents
  business_license_path TEXT, -- SIUP or other specific business licenses
  tax_registration_certificate_path TEXT, -- Additional tax documents if any

  -- Application lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'Submitted',
  submitted_date TIMESTAMP NOT NULL,

  -- Review process
  reviewer_user_id BIGINT REFERENCES users (id),
  review_started_date TIMESTAMP,
  verified_date TIMESTAMP,
  rejected_date TIMESTAMP,
  rejection_reason TEXT,

  -- Administrative notes
  internal_notes TEXT, -- For admin use

  CHECK (
    status IN ('Submitted', 'UnderReview', 'Verified', 'Rejected') AND
    -- Cannot be both verified and rejected
    (verified_date IS NULL OR rejected_date IS NULL) AND
    -- Rejection reason required when rejected
    (rejected_date IS NULL OR rejection_reason IS NOT NULL) AND
    -- Review started date must be before verification/rejection
    (verified_date IS NULL OR review_started_date IS NULL OR review_started_date <= verified_date) AND
    (rejected_date IS NULL OR review_started_date IS NULL OR review_started_date <= rejected_date) AND
    -- Verification/rejection must be after submission
    (verified_date IS NULL OR verified_date >= submitted_date) AND
    (rejected_date IS NULL OR rejected_date >= submitted_date) AND
    -- Status must align with time-based actions
    (status = 'Submitted' AND review_started_date IS NULL AND verified_date IS NULL AND rejected_date IS NULL) OR
    (status = 'UnderReview' AND review_started_date IS NOT NULL AND verified_date IS NULL AND rejected_date IS NULL) OR
    (status = 'Verified' AND verified_date IS NOT NULL AND rejected_date IS NULL) OR
    (status = 'Rejected' AND rejected_date IS NOT NULL AND verified_date IS NULL)
  )
);

COMMENT ON TABLE institution_applications IS 'Complete institution application with Indonesian business verification requirements';

CREATE TABLE IF NOT EXISTS institution_invitations (
  id BIGSERIAL PRIMARY KEY,
  institution_user_id BIGINT NOT NULL REFERENCES users (id),
  target_user_id BIGINT NOT NULL REFERENCES users (id),
  role VARCHAR(32) NOT NULL CHECK (role IN ('Owner', 'Finance')),
  status VARCHAR(20) NOT NULL DEFAULT 'Sent',
  invited_date TIMESTAMP NOT NULL,
  accepted_date TIMESTAMP,
  rejected_date TIMESTAMP,
  rejection_reason TEXT,
  expires_date TIMESTAMP NOT NULL,
  CHECK (
    status IN ('Sent', 'Accepted', 'Rejected', 'Expired') AND
    -- Ensure invitation is not both accepted and rejected
    (accepted_date IS NULL OR rejected_date IS NULL) AND
    -- Cannot invite yourself
    (institution_user_id != target_user_id) AND
    -- Expiration date must be after invitation date
    (expires_date > invited_date) AND
    -- Status must align with time-based actions
    (status = 'Sent' AND accepted_date IS NULL AND rejected_date IS NULL) OR
    (status = 'Accepted' AND accepted_date IS NOT NULL AND rejected_date IS NULL) OR
    (status = 'Rejected' AND rejected_date IS NOT NULL AND accepted_date IS NULL) OR
    (status = 'Expired' AND accepted_date IS NULL AND rejected_date IS NULL)
  )
);


-- DEPENDENCY --

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS institution_application_id BIGINT REFERENCES institution_applications (id);

--- TRIGGER --

CREATE OR REPLACE FUNCTION indonesian_institution_application_documents_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that user has selected Institution user type
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.applicant_user_id
    AND user_type = 'Institution'
  ) THEN
    RAISE EXCEPTION 'Only users with Institution user type can submit institution applications';
  END IF;

  -- Validate NPWP format (Indonesian tax ID format: XX.XXX.XXX.X-XXX.XXX)
  IF NEW.npwp_number !~ '^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$' THEN
    RAISE EXCEPTION 'Invalid NPWP format. Expected: XX.XXX.XXX.X-XXX.XXX';
  END IF;

  -- Document and field required validations removed - handled by NOT NULL constraints in schema
  -- Keep only business logic validations

  -- Check for duplicate NPWP in pending/approved applications
  IF EXISTS (
    SELECT 1 FROM institution_applications
    WHERE npwp_number = NEW.npwp_number
    AND id != COALESCE(NEW.id, 0)
    AND rejected_date IS NULL
  ) THEN
    RAISE EXCEPTION 'NPWP number already exists in another application';
  END IF;

  -- Check for duplicate registration number in pending/approved applications
  IF EXISTS (
    SELECT 1 FROM institution_applications
    WHERE registration_number = NEW.registration_number
    AND id != COALESCE(NEW.id, 0)
    AND rejected_date IS NULL
  ) THEN
    RAISE EXCEPTION 'Registration number already exists in another application';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER indonesian_institution_application_documents_validation_trigger
BEFORE INSERT OR UPDATE ON institution_applications
FOR EACH ROW
EXECUTE FUNCTION indonesian_institution_application_documents_validation();

CREATE OR REPLACE FUNCTION apply_institution_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.review_started_date IS NOT NULL AND OLD.review_started_date != NEW.review_started_date THEN
    RAISE EXCEPTION 'Cannot modify review_started_date once set';
  END IF;

  IF OLD.review_started_date IS NULL AND NEW.review_started_date IS NOT NULL THEN
    NEW.status = 'UnderReview';
  END IF;

  IF OLD.verified_date IS NOT NULL OR OLD.rejected_date IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify an application that has already been verified or rejected';
  END IF;

  IF OLD.verified_date IS NULL AND NEW.verified_date IS NOT NULL THEN

    NEW.status = 'Verified';

    UPDATE users
    SET institution_user_id = NEW.applicant_user_id,
        institution_role = 'Owner'
    WHERE id = NEW.applicant_user_id;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      institution_application_id,
      creation_date
    ) VALUES (
      NEW.applicant_user_id,
      'InstitutionApplicationVerified',
      'Institution Application Approved',
      'Your institution application for "' || NEW.business_name || '" has been approved.',
      NEW.id,
      NEW.verified_date
    );

  END IF;

  IF OLD.rejected_date IS NULL AND NEW.rejected_date IS NOT NULL THEN

    NEW.status = 'Rejected';

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      institution_application_id,
      creation_date
    ) VALUES (
      NEW.applicant_user_id,
      'InstitutionApplicationRejected',
      'Institution Application Rejected',
      CASE
        WHEN NEW.rejection_reason IS NOT NULL THEN
          'Your institution application was rejected. Reason: ' || NEW.rejection_reason
        ELSE
          'Your institution application was rejected. Please contact support for more information.'
      END,
      NEW.id,
      NEW.rejected_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER apply_institution_approval_trigger
BEFORE UPDATE ON institution_applications
FOR EACH ROW
EXECUTE FUNCTION apply_institution_approval();

CREATE OR REPLACE FUNCTION validate_institution_invitation()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that inviting user is an institution owner
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.institution_user_id
    AND user_type = 'Institution'
    AND institution_role = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Only institution owners can send invitations';
  END IF;

  -- Validate that target user is Individual type
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.target_user_id
    AND user_type = 'Individual'
  ) THEN
    RAISE EXCEPTION 'Can only invite users with Individual user type';
  END IF;

  -- Validate that target user has verified KYC (TBD)
  -- IF NOT EXISTS (
  --   SELECT 1 FROM users u
  --   JOIN user_kycs kyc ON u.kyc_id = kyc.id
  --   WHERE u.id = NEW.target_user_id
  --   AND kyc.verified_date IS NOT NULL
  -- ) THEN
  --   RAISE EXCEPTION 'Target user must have verified KYC before receiving invitation';
  -- END IF;

  -- Check that target user is not already a member of any institution
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.target_user_id
    AND institution_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Target user is already a member of an institution';
  END IF;

  -- Check for existing pending invitation to the same user
  IF EXISTS (
    SELECT 1 FROM institution_invitations
    WHERE target_user_id = NEW.target_user_id
    AND id != COALESCE(NEW.id, 0)
    AND accepted_date IS NULL
    AND rejected_date IS NULL
  ) THEN
    RAISE EXCEPTION 'Target user already has a pending invitation';
  END IF;

  -- Check for active account balance
  IF EXISTS (
    SELECT 1 FROM accounts
    WHERE user_id = NEW.target_user_id
    AND balance > 0
  ) THEN
    RAISE EXCEPTION 'Target user has active account balance and cannot be invited to an institution';
  END IF;

  -- Check for active loans
  IF EXISTS (
    SELECT 1 FROM loans l
    JOIN loan_applications la ON l.loan_application_id = la.id
    WHERE la.borrower_user_id = NEW.target_user_id
    AND l.status IN ('originated', 'Active', 'ltv_breach', 'pending_liquidation')
  ) THEN
    RAISE EXCEPTION 'Target user has active loans and cannot be invited to an institution';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_institution_invitation_trigger
BEFORE INSERT ON institution_invitations
FOR EACH ROW
EXECUTE FUNCTION validate_institution_invitation();

CREATE OR REPLACE FUNCTION update_user_on_institution_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.accepted_date IS NOT NULL OR OLD.rejected_date IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify an invitation that has already been accepted or rejected';
  END IF;

  IF OLD.accepted_date IS NULL AND NEW.accepted_date IS NOT NULL THEN

    NEW.status = 'Accepted';

    UPDATE users
    SET institution_user_id = NEW.institution_user_id,
        institution_role = NEW.role
    WHERE id = NEW.target_user_id;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      creation_date
    ) VALUES (
      NEW.target_user_id,
      'InstitutionMemberAccepted',
      'Institution Invitation Accepted',
      'You have successfully joined the institution as ' || NEW.role || '.',
      NEW.accepted_date
    );

  END IF;

  IF OLD.rejected_date IS NULL AND NEW.rejected_date IS NOT NULL THEN

    NEW.status = 'Rejected';

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      creation_date
    ) VALUES (
      NEW.target_user_id,
      'InstitutionMemberRejected',
      'Institution Invitation Rejected',
      CASE
        WHEN NEW.rejection_reason IS NOT NULL THEN
          'You have declined the institution invitation. Reason: ' || NEW.rejection_reason
        ELSE
          'You have declined the institution invitation.'
      END,
      NEW.rejected_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_user_on_institution_invitation_acceptance_trigger
BEFORE UPDATE ON institution_invitations
FOR EACH ROW
EXECUTE FUNCTION update_user_on_institution_invitation_acceptance();
