CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(64) NOT NULL CHECK (type IN (
    -- Authentication notifications
    'UserRegistered', 'EmailVerificationSent', 'EmailVerified', 'PasswordResetRequested',
    'PasswordResetCompleted', 'TwoFactorEnabled', 'TwoFactorDisabled', 'LoginFromNewDevice', 'SuspiciousLoginAttempt',
    -- KYC notifications
    'UserKycVerified', 'UserKycRejected',
    -- Institution notifications
    'InstitutionApplicationVerified', 'InstitutionApplicationRejected', 'InstitutionMemberInvited',
    'InstitutionMemberAccepted', 'InstitutionMemberRejected',
    -- Invoice notifications
    'InvoiceCreated', 'InvoiceDue', 'InvoiceExpired', 'InvoicePartiallyPaid', 'InvoicePaid',
    -- Loan notifications
    'LoanOfferPublished', 'LoanApplicationPublished', 'LoanApplicationMatched', 'LoanOfferMatched',
    'LoanApplicationApproved', 'LoanApplicationRejected', 'LoanOfferClosed', 'LoanDisbursement',
    'LoanActivated', 'LoanRepaymentDue', 'LoanRepaymentCompleted', 'LoanRepaymentReceived',
    'LoanRepaymentFailed', 'LoanLiquidation', 'LoanLtvBreach',
    -- Withdrawal notifications
    'WithdrawalRequested', 'WithdrawalRefunded', 'WithdrawalRefundApproved', 'WithdrawalRefundRejected',
    -- Admin notifications
    'AdminInvitationSent', 'AdminInvitationAccepted', 'AdminInvitationRejected', 'AdminInvitationExpired',
    'UserKycSubmitted', 'InstitutionApplicationSubmitted', 'WithdrawalFailed',
    -- Enhanced loan notifications
    'LiquidationWarning', 'LiquidationCompleted',
    -- System notifications
    'PlatformMaintenanceNotice', 'SecurityAlert'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  read_date TIMESTAMP,
  creation_date TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
