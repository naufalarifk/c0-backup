--- SCHEMA ---

CREATE TABLE IF NOT EXISTS admin_invitations (
  id BIGSERIAL PRIMARY KEY,
  inviter_user_id BIGINT NOT NULL,
  target_user_id BIGINT NOT NULL,
  invitation_token VARCHAR(255) NOT NULL UNIQUE,
  invitation_message TEXT,
  invited_date TIMESTAMP NOT NULL,
  expires_date TIMESTAMP NOT NULL, -- 24 hour expiry from invited_date
  accepted_date TIMESTAMP,
  rejected_date TIMESTAMP,
  used_date TIMESTAMP, -- when invitation was consumed (either accepted or rejected)

  FOREIGN KEY (inviter_user_id) REFERENCES users (id),
  FOREIGN KEY (target_user_id) REFERENCES users (id),

  CHECK (
    -- Invitation cannot be both accepted and rejected
    (accepted_date IS NULL OR rejected_date IS NULL) AND
    -- Used date must be set when accepted or rejected
    ((accepted_date IS NULL AND rejected_date IS NULL AND used_date IS NULL) OR
     (accepted_date IS NOT NULL AND used_date IS NOT NULL) OR
     (rejected_date IS NOT NULL AND used_date IS NOT NULL)) AND
    -- Expires date must be after invited date
    expires_date > invited_date AND
    -- Acceptance/rejection dates must be before expiry (if within valid period)
    (accepted_date IS NULL OR accepted_date <= expires_date) AND
    (rejected_date IS NULL OR rejected_date <= expires_date) AND
    -- Max 7 days expiry
    expires_date <= invited_date + INTERVAL '7 days'
  )
);

COMMENT ON TABLE admin_invitations IS 'Admin invitation system for promoting regular users to admin role';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS admin_invitation_id BIGINT;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_admin_invitation;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_admin_invitation
  FOREIGN KEY (admin_invitation_id) REFERENCES admin_invitations (id);

CREATE OR REPLACE VIEW active_admin_invitations AS
SELECT
  ai.*,
  inviter_users.email as inviter_email,
  inviter_users.name as inviter_name,
  target_users.email as target_email,
  target_users.name as target_name,
  CASE
    WHEN NOW() > ai.expires_date THEN 'expired'
    WHEN ai.accepted_date IS NOT NULL THEN 'accepted'
    WHEN ai.rejected_date IS NOT NULL THEN 'rejected'
    ELSE 'pending'
  END as status
FROM admin_invitations ai
JOIN users inviter_users ON ai.inviter_user_id = inviter_users.id
JOIN users target_users ON ai.target_user_id = target_users.id;

COMMENT ON VIEW active_admin_invitations IS 'Active admin invitations with status and user details';

--- TRIGGER ---

CREATE OR REPLACE FUNCTION validate_admin_invitation_data()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT operations, validate all conditions
  IF TG_OP = 'INSERT' THEN
    -- Ensure inviter is an admin
    IF NOT EXISTS (
      SELECT 1 FROM users
      WHERE id = NEW.inviter_user_id AND role = 'Admin'
    ) THEN
      RAISE EXCEPTION 'Only admin users can create admin invitations';
    END IF;

    -- Ensure target user exists and is not already admin
    IF NOT EXISTS (
      SELECT 1 FROM users
      WHERE id = NEW.target_user_id AND role = 'User'
    ) THEN
      RAISE EXCEPTION 'Target user must exist and must be a regular user (not admin)';
    END IF;

    -- Check for existing pending invitations
    IF EXISTS (
      SELECT 1 FROM admin_invitations
      WHERE target_user_id = NEW.target_user_id
      AND accepted_date IS NULL
      AND rejected_date IS NULL
    ) THEN
      RAISE EXCEPTION 'User already has a pending admin invitation';
    END IF;
  END IF;

  -- Validate expiry date for both INSERT and UPDATE
  IF NEW.expires_date <= NEW.invited_date THEN
    RAISE EXCEPTION 'Expiry date must be after invitation date';
  END IF;

  -- Auto-set expiry to 24 hours if not provided (INSERT only)
  IF TG_OP = 'INSERT' AND NEW.expires_date IS NULL THEN
    NEW.expires_date := NEW.invited_date + INTERVAL '24 hours';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER validate_admin_invitation_data_trigger
BEFORE INSERT OR UPDATE ON admin_invitations
FOR EACH ROW
EXECUTE FUNCTION validate_admin_invitation_data();

CREATE OR REPLACE FUNCTION process_admin_invitation_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  target_user_record RECORD;
BEGIN
  -- Process invitation acceptance
  IF NEW.accepted_date IS NOT NULL AND (OLD.accepted_date IS NULL OR OLD.accepted_date != NEW.accepted_date) THEN

    -- Check invitation hasn't expired
    IF NEW.expires_date < NEW.accepted_date THEN
      RAISE EXCEPTION 'Cannot accept expired invitation';
    END IF;

    -- Get target user
    SELECT * INTO target_user_record
    FROM users
    WHERE id = NEW.target_user_id;

    -- Upgrade user to admin role
    UPDATE users
    SET role = 'Admin'
    WHERE id = NEW.target_user_id;

    -- Set used date
    NEW.used_date := NEW.accepted_date;

    -- Create notification for inviter
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      admin_invitation_id,
      creation_date
    ) VALUES (
      NEW.inviter_user_id,
      'AdminInvitationAccepted',
      'Admin Invitation Accepted',
      target_user_record.name || ' (' || target_user_record.email || ') has accepted the admin invitation.',
      NEW.id,
      NEW.accepted_date
    );

    -- Create notification for new admin
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      admin_invitation_id,
      creation_date
    ) VALUES (
      NEW.target_user_id,
      'AdminInvitationAccepted',
      'Welcome to Admin Role',
      'You have been successfully promoted to admin role. You now have access to admin features.',
      NEW.id,
      NEW.accepted_date
    );

  END IF;

  -- Process invitation rejection
  IF NEW.rejected_date IS NOT NULL AND (OLD.rejected_date IS NULL OR OLD.rejected_date != NEW.rejected_date) THEN

    -- Set used date
    NEW.used_date := NEW.rejected_date;

    -- Create notification for inviter
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      admin_invitation_id,
      creation_date
    ) VALUES (
      NEW.inviter_user_id,
      'AdminInvitationRejected',
      'Admin Invitation Declined',
      'The admin invitation has been declined.',
      NEW.id,
      NEW.rejected_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_admin_invitation_acceptance_trigger
BEFORE UPDATE ON admin_invitations
FOR EACH ROW
EXECUTE FUNCTION process_admin_invitation_acceptance();


CREATE OR REPLACE FUNCTION create_admin_notifications()
RETURNS TRIGGER AS $$
DECLARE
  admin_user_record RECORD;
BEGIN
  -- Create notifications for admins on important events

  -- KYC submission notifications
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'user_kycs' THEN
    FOR admin_user_record IN
      SELECT id FROM users WHERE role = 'Admin'
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        user_kyc_id,
        creation_date
      ) VALUES (
        admin_user_record.id,
        'UserKycSubmitted',
        'New KYC Submission',
        'A new KYC submission requires review. User ID: ' || NEW.user_id,
        NEW.id,
        NEW.submitted_date
      );
    END LOOP;
  END IF;

  -- Institution application notifications
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'institution_applications' THEN
    FOR admin_user_record IN
      SELECT id FROM users WHERE role = 'Admin'
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        institution_application_id,
        creation_date
      ) VALUES (
        admin_user_record.id,
        'InstitutionApplicationSubmitted',
        'New Institution Application',
        'A new institution application requires review. Business: ' || NEW.business_name,
        NEW.id,
        NEW.submitted_date
      );
    END LOOP;
  END IF;

  -- Withdrawal failure notifications
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'withdrawals' AND
     NEW.failed_date IS NOT NULL AND OLD.failed_date IS NULL THEN
    FOR admin_user_record IN
      SELECT id FROM users WHERE role = 'Admin'
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        withdrawal_id,
        creation_date
      ) VALUES (
        admin_user_record.id,
        'WithdrawalFailed',
        'Withdrawal Failed',
        'A withdrawal has failed and may require admin intervention. Amount: ' || NEW.amount,
        NEW.id,
        NEW.failed_date
      );
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE TRIGGER validate_admin_invitation_data_trigger
BEFORE INSERT OR UPDATE ON admin_invitations
FOR EACH ROW
EXECUTE FUNCTION validate_admin_invitation_data();

CREATE OR REPLACE FUNCTION process_admin_invitation_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  target_user_record RECORD;
BEGIN
  -- Process invitation acceptance
  IF NEW.accepted_date IS NOT NULL AND (OLD.accepted_date IS NULL OR OLD.accepted_date != NEW.accepted_date) THEN

    -- Check invitation hasn't expired
    IF NEW.expires_date < NEW.accepted_date THEN
      RAISE EXCEPTION 'Cannot accept expired invitation';
    END IF;

    -- Get target user
    SELECT * INTO target_user_record
    FROM users
    WHERE id = NEW.target_user_id;

    -- Upgrade user to admin role
    UPDATE users
    SET role = 'Admin'
    WHERE id = NEW.target_user_id;

    -- Set used date
    NEW.used_date := NEW.accepted_date;

    -- Create notification for inviter
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      admin_invitation_id,
      creation_date
    ) VALUES (
      NEW.inviter_user_id,
      'AdminInvitationAccepted',
      'Admin Invitation Accepted',
      target_user_record.name || ' (' || target_user_record.email || ') has accepted the admin invitation.',
      NEW.id,
      NEW.accepted_date
    );

    -- Create notification for new admin
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      admin_invitation_id,
      creation_date
    ) VALUES (
      NEW.target_user_id,
      'AdminInvitationAccepted',
      'Welcome to Admin Role',
      'You have been successfully promoted to admin role. You now have access to admin features.',
      NEW.id,
      NEW.accepted_date
    );

  END IF;

  -- Process invitation rejection
  IF NEW.rejected_date IS NOT NULL AND (OLD.rejected_date IS NULL OR OLD.rejected_date != NEW.rejected_date) THEN

    -- Set used date
    NEW.used_date := NEW.rejected_date;

    -- Create notification for inviter
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      admin_invitation_id,
      creation_date
    ) VALUES (
      NEW.inviter_user_id,
      'AdminInvitationRejected',
      'Admin Invitation Declined',
      'The admin invitation has been declined.',
      NEW.id,
      NEW.rejected_date
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER process_admin_invitation_acceptance_trigger
BEFORE UPDATE ON admin_invitations
FOR EACH ROW
EXECUTE FUNCTION process_admin_invitation_acceptance();
