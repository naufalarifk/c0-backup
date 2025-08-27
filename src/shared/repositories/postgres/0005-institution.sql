--- SCHEMA ---

CREATE TABLE IF NOT EXISTS institution_applications (
  id BIGSERIAL PRIMARY KEY,
  applicant_user_id BIGINT NOT NULL,

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

  -- Company Domicile Certificate (SKDP - Surat Keterangan Domisili Perusahaan)
  domicile_certificate_path TEXT NOT NULL,
  domicile_certificate_number VARCHAR(50),

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
  submitted_date TIMESTAMP NOT NULL,

  -- Review process
  reviewer_user_id BIGINT,
  review_started_date TIMESTAMP,
  verified_date TIMESTAMP,
  rejected_date TIMESTAMP,
  rejection_reason TEXT,

  -- Administrative notes
  internal_notes TEXT, -- For admin use

  FOREIGN KEY (applicant_user_id) REFERENCES users (id),
  FOREIGN KEY (reviewer_user_id) REFERENCES users (id),

  CHECK (
    -- Cannot be both verified and rejected
    (verified_date IS NULL OR rejected_date IS NULL) AND
    -- Rejection reason required when rejected
    (rejected_date IS NULL OR rejection_reason IS NOT NULL) AND
    -- Review started date must be before verification/rejection
    (verified_date IS NULL OR review_started_date IS NULL OR review_started_date <= verified_date) AND
    (rejected_date IS NULL OR review_started_date IS NULL OR review_started_date <= rejected_date) AND
    -- Verification/rejection must be after submission
    (verified_date IS NULL OR verified_date >= submitted_date) AND
    (rejected_date IS NULL OR rejected_date >= submitted_date)
  )
);

COMMENT ON TABLE institution_applications IS 'Complete institution application with Indonesian business verification requirements';

CREATE TABLE IF NOT EXISTS institution_invitations (
  id BIGSERIAL PRIMARY KEY,
  institution_user_id BIGINT NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('Owner', 'Finance')),
  invited_date TIMESTAMP NOT NULL,
  accepted_date TIMESTAMP,
  rejected_date TIMESTAMP,
  rejection_reason TEXT,
  FOREIGN KEY (institution_user_id) REFERENCES users (id),
  CHECK (
    -- Ensure invitation is not both accepted and rejected
    (accepted_date IS NULL OR rejected_date IS NULL)
  )
);


-- DEPENDENCY --

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS institution_application_id BIGINT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_institution_application;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_institution_application
  FOREIGN KEY (institution_application_id) REFERENCES institution_applications (id);


--- VIEW ---

CREATE OR REPLACE VIEW institution_application_status AS
SELECT
  ia.*,
  applicant_auth.email as applicant_email,
  applicant_auth.full_name as applicant_name,
  reviewer_auth.email as reviewer_email,
  reviewer_auth.full_name as reviewer_name,
  CASE
    WHEN ia.verified_date IS NOT NULL THEN 'verified'
    WHEN ia.rejected_date IS NOT NULL THEN 'rejected'
    WHEN ia.review_started_date IS NOT NULL THEN 'under_review'
    ELSE 'pending'
  END as status,
  EXTRACT(days FROM NOW() - ia.submitted_date) as days_since_submission
FROM institution_applications ia
JOIN users applicant_auth ON ia.applicant_user_id = applicant_auth.id
LEFT JOIN users reviewer_auth ON ia.reviewer_user_id = reviewer_auth.id;

COMMENT ON VIEW institution_application_status IS 'Institution applications with review status and timeline';

--- TRIGGER --

CREATE OR REPLACE FUNCTION validate_institution_application_documents()
RETURNS TRIGGER AS $$
BEGIN
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

CREATE OR REPLACE TRIGGER validate_institution_application_documents_trigger
BEFORE INSERT OR UPDATE ON institution_applications
FOR EACH ROW
EXECUTE FUNCTION validate_institution_application_documents();

CREATE OR REPLACE FUNCTION create_institution_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when application is being approved (verified_date is set)
  IF NEW.verified_date IS NOT NULL AND (OLD.verified_date IS NULL OR OLD.verified_date != NEW.verified_date) THEN

    -- Update the applicant user to become institution owner
    UPDATE users
    SET institution_user_id = NEW.applicant_user_id,
        institution_role = 'Owner'
    WHERE id = NEW.applicant_user_id;

    -- Create notification for approval
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

  -- Process application rejection
  IF NEW.rejected_date IS NOT NULL AND (OLD.rejected_date IS NULL OR OLD.rejected_date != NEW.rejected_date) THEN
    -- Create notification for rejection
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

CREATE OR REPLACE TRIGGER create_institution_on_approval_trigger
AFTER UPDATE ON institution_applications
FOR EACH ROW
EXECUTE FUNCTION create_institution_on_approval();

CREATE OR REPLACE FUNCTION update_user_on_institution_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when invitation is being accepted (accepted_date is set)
  IF NEW.accepted_date IS NOT NULL AND (OLD.accepted_date IS NULL OR OLD.accepted_date != NEW.accepted_date) THEN
    -- Note: Institution invitation structure changed - user_id no longer exists
    -- This trigger needs to be redesigned for the new schema
    -- UPDATE users
    -- SET institution_user_id = NEW.institution_user_id,
    --     institution_role = NEW.role
    -- WHERE id = NEW.user_id;

    -- Note: Notification creation disabled due to schema changes
    -- INSERT INTO notifications (
    --   user_id,
    --   type,
    --   title,
    --   content,
    --   creation_date
    -- ) VALUES (
    --   NEW.user_id, -- This field no longer exists
    --   'InstitutionMemberAccepted',
    --   'Institution Invitation Accepted',
    --   'You have successfully joined the institution as ' || NEW.role || '.',
    --   NEW.accepted_date
    -- );
  END IF;

  -- Process invitation rejection
  IF NEW.rejected_date IS NOT NULL AND (OLD.rejected_date IS NULL OR OLD.rejected_date != NEW.rejected_date) THEN
    -- Note: Notification creation disabled due to schema changes
    -- INSERT INTO notifications (
    --   user_id,
    --   type,
    --   title,
    --   content,
    --   creation_date
    -- ) VALUES (
    --   NEW.user_id, -- This field no longer exists
    --   'InstitutionMemberRejected',
    --   'Institution Invitation Rejected',
    --   CASE
    --     WHEN NEW.rejection_reason IS NOT NULL THEN
    --       'You have declined the institution invitation. Reason: ' || NEW.rejection_reason
    --     ELSE
    --       'You have declined the institution invitation.'
    --   END,
    --   NEW.rejected_date
    -- );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_institution_invitation()
RETURNS TRIGGER AS $$
BEGIN
  -- Note: Validation disabled due to schema changes
  -- The original validation logic needs to be redesigned for new schema structure
  -- Original logic:
  -- 1. Check KYC verification (kyc_id no longer exists in users table)
  -- 2. Check existing membership (user_id no longer exists in invitations table)
  -- 3. Check pending invitations (user_id no longer exists in invitations table)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_institution_invitation_trigger
BEFORE INSERT OR UPDATE ON institution_invitations
FOR EACH ROW
EXECUTE FUNCTION validate_institution_invitation();
