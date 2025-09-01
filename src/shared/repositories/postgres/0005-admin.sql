--- SCHEMA ---

CREATE TABLE IF NOT EXISTS admin_invitations (
  id BIGSERIAL PRIMARY KEY,
  
  inviter_user_id BIGINT NOT NULL REFERENCES users (id),
  target_user_id BIGINT NOT NULL REFERENCES users (id),

  invitation_token VARCHAR(255) NOT NULL UNIQUE,
  invitation_message TEXT,

  invited_date TIMESTAMP NOT NULL,
  expires_date TIMESTAMP NOT NULL, -- 24 hour expiry from invited_date
  accepted_date TIMESTAMP,
  rejected_date TIMESTAMP,

  status VARCHAR(8) NOT NULL DEFAULT 'Invited' CHECK (status IN ('Invited', 'Accepted', 'Rejected', 'Expired')),

  CHECK (
    -- Invitation cannot be both accepted and rejected
    (accepted_date IS NULL OR rejected_date IS NULL) AND
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

--- DEPENDENCIES ---

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS admin_invitation_id BIGINT REFERENCES admin_invitations (id);

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
  IF OLD.accepted_date OR OLD.rejected_date IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify an invitation that has already been accepted or rejected';
  END IF;

  IF (NEW.accepted_date IS NOT NULL OR NEW.rejected_date IS NOT NULL) AND NEW.used_date IS NULL THEN
  END IF;

  IF OLD.accepted_date IS NULL AND NEW.accepted_date IS NOT NULL THEN

    IF NEW.expires_date < NEW.accepted_date THEN
      RAISE EXCEPTION 'Cannot accept expired invitation';
    END IF;

    SELECT name, email INTO target_user_record
    FROM users
    WHERE id = NEW.target_user_id;

    UPDATE users
    SET role = 'Admin'
    WHERE id = NEW.target_user_id;

    NEW.status = 'Accepted';

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

  IF OLD.rejected_date IS NULL AND NEW.rejected_date IS NOT NULL THEN
    NEW.status = 'Rejected';

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
