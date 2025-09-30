export const NotificationChannelEnum = {
  Email: 'Email' as const,
  SMS: 'SMS' as const,
  FCM: 'FCM' as const,
  APN: 'APN' as const,
} as const;

export function assertIsNotificationChannel(value: unknown): asserts value is NotificationChannel {
  if (
    typeof value !== 'string' ||
    !Object.values(NotificationChannelEnum).includes(value as NotificationChannel)
  ) {
    throw new Error(`Invalid notification channel: ${value}`);
  }
}

export type NotificationChannel =
  (typeof NotificationChannelEnum)[keyof typeof NotificationChannelEnum];

export interface NotificationPayload {
  channel: NotificationChannel;
}

export interface PushNotificationPayload extends NotificationPayload {
  channel: typeof NotificationChannelEnum.FCM | typeof NotificationChannelEnum.APN;
  to: string;
  title: string;
  body: string;
}

export interface FCMNotificationPayload extends PushNotificationPayload {
  channel: typeof NotificationChannelEnum.FCM;
  data?: Record<string, string>;
  icon?: string;
  clickAction?: string;
  sound?: string;
  badge?: string;
}

export interface APNSNotificationPayload extends PushNotificationPayload {
  channel: typeof NotificationChannelEnum.APN;
  sound?: string;
  badge?: number;
  category?: string;
}

export interface EmailNotificationPayload extends NotificationPayload {
  channel: typeof NotificationChannelEnum.Email;
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface SMSNotificationPayload extends NotificationPayload {
  channel: typeof NotificationChannelEnum.SMS;
  to: string;
  message: string;
}

export type NotificationType =
  // Authentication notifications
  | 'UserRegistered'
  | 'PhoneNumberVerification'
  | 'PhoneNumberVerified'
  | 'EmailVerification'
  | 'EmailVerified'
  | 'PasswordResetRequested'
  | 'PasswordResetCompleted'
  | 'TwoFactorEnabled'
  | 'TwoFactorDisabled'
  | 'LoginFromNewDevice'
  | 'SuspiciousLoginAttempt'
  // KYC notifications
  | 'UserKycVerified'
  | 'UserKycRejected'
  // Institution notifications
  | 'InstitutionApplicationVerified'
  | 'InstitutionApplicationRejected'
  | 'InstitutionMemberInvited'
  | 'InstitutionMemberAccepted'
  | 'InstitutionMemberRejected'
  // Invoice notifications
  | 'InvoiceCreated'
  | 'InvoiceDue'
  | 'InvoiceExpired'
  | 'InvoicePartiallyPaid'
  | 'InvoicePaid'
  // Loan notifications
  | 'LoanOfferPublished'
  | 'LoanApplicationPublished'
  | 'LoanApplicationMatched'
  | 'LoanOfferMatched'
  | 'LoanApplicationApproved'
  | 'LoanApplicationRejected'
  | 'LoanOfferClosed'
  | 'LoanDisbursement'
  | 'LoanActivated'
  | 'LoanRepaymentDue'
  | 'LoanRepaymentCompleted'
  | 'LoanRepaymentReceived'
  | 'LoanRepaymentFailed'
  | 'LoanLiquidation'
  | 'LoanLtvBreach'
  // Beneficiary notifications
  | 'BeneficiaryVerification'
  // Withdrawal notifications
  | 'WithdrawalRequested'
  | 'WithdrawalRefunded'
  | 'WithdrawalRefundApproved'
  | 'WithdrawalRefundRejected'
  | 'WithdrawalSent'
  | 'WithdrawalConfirmed'
  | 'WithdrawalTimeout'
  | 'WithdrawalFailed'
  | 'WithdrawalInfoRequested'
  // Admin notifications
  | 'AdminInvitationSent'
  | 'AdminInvitationAccepted'
  | 'AdminInvitationRejected'
  | 'AdminInvitationExpired'
  | 'UserKycSubmitted'
  | 'InstitutionApplicationSubmitted'
  | 'AdminWithdrawalFailure'
  | 'AdminRefundProcessed'
  | 'AdminMonitoringFailure'
  // Enhanced loan notifications
  | 'LiquidationWarning'
  | 'LiquidationCompleted'
  // System notifications
  | 'PlatformMaintenanceNotice'
  | 'SecurityAlert';

export interface NotificationData {
  type: NotificationType;
  [key: string]: unknown;
}

export type AnyNotificationPayload =
  | EmailNotificationPayload
  | SMSNotificationPayload
  | FCMNotificationPayload
  | APNSNotificationPayload;
