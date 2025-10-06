// Profile management types
export type UserUpdatesProfileParams = {
  id: string;
  name?: string;
  profilePictureUrl?: string;
  expoPushToken?: string;
  updateDate: Date;
};

export type UserUpdatesProfileResult = {
  id: string;
  name?: string;
  profilePictureUrl?: string | null;
  expoPushToken?: string | null;
  updatedDate: Date;
};

export type UserDecidesUserTypeParams = {
  userId: string;
  userType: 'Individual' | 'Institution';
  decisionDate: Date;
};

// KYC types
export type UserSubmitsKycParams = {
  userId: string;
  idCardPhoto: string;
  selfieWithIdCardPhoto: string;
  nik: string;
  name: string;
  birthCity: string;
  birthDate: Date;
  province: string;
  city: string;
  district: string;
  subdistrict: string;
  address: string;
  postalCode: string;
  submissionDate: Date;
};

export type UserSubmitsKYCResult = {
  id: string;
  userId: string;
};

export type UserViewKYCStatusParams = {
  userId: string;
};

export type UserViewKYCSStatusResult = {
  id?: string;
  userId: string;
  status: 'none' | 'pending' | 'verified' | 'rejected';
  submittedDate?: Date;
  verifiedDate?: Date;
  rejectedDate?: Date;
  rejectionReason?: string;
  canResubmit: boolean;
};

export type AdminApprovesKycParams = {
  kycId: string;
  verifierUserId: string;
  approvalDate: Date;
};

export type AdminApprovesKycResult = {
  id: string;
  userId: string;
  verifiedDate: Date;
};

export type AdminRejectsKycParams = {
  kycId: string;
  verifierUserId: string;
  rejectionReason: string;
  rejectionDate: Date;
};

export type AdminRejectsKycResult = {
  id: string;
  userId: string;
  rejectedDate: Date;
};

export type AdminViewPendingKycsResult = {
  kycs: Array<{
    id: string;
    userId: string;
    name: string;
    nik: string;
    submittedDate: Date;
  }>;
};

// Institution types
export type UserAppliesForInstitutionParams = {
  applicantUserId: string;
  businessName: string;
  businessDescription?: string;
  businessType: string;
  npwpNumber: string;
  npwpDocumentPath: string;
  registrationNumber: string;
  registrationDocumentPath: string;
  establishmentNumber: string;
  deedOfEstablishmentPath: string;
  businessAddress: string;
  businessCity: string;
  businessProvince: string;
  businessDistrict: string;
  businessSubdistrict: string;
  businessPostalCode: string;
  directorName: string;
  directorPosition?: string;
  directorIdCardPath: string;
  ministryApprovalDocumentPath: string;
  applicationDate: Date;
};

export type UserAppliesForInstitutionResult = {
  id: string;
  applicantUserId: string;
  businessName: string;
};

export type AdminApprovesInstitutionApplicationParams = {
  applicationId: string;
  reviewerUserId: string;
  approvalDate: Date;
};

export type AdminApprovesInstitutionApplicationResult = {
  institutionId: string;
  applicationId: string;
};

export type AdminRejectsInstitutionApplicationParams = {
  applicationId: string;
  reviewerUserId: string;
  rejectionReason: string;
  rejectionDate: Date;
};

export type AdminRejectsInstitutionApplicationResult = {
  id: string;
  rejectedDate: Date;
};

export type OwnerUserInvitesUserToInstitutionParams = {
  institutionId: string;
  userId: string;
  role: 'Owner' | 'Finance';
  invitationDate: Date;
};

export type OwnerUserInvitesUserToInstitutionResult = {
  id: string;
  institutionId: string;
  userId: string;
  role: string;
};

export type UserAcceptsInstitutionInvitationParams = {
  invitationId: string;
  userId: string;
  acceptanceDate: Date;
};

export type UserAcceptsInstitutionInvitationResult = {
  id: string;
  institutionId: string;
  acceptedDate: Date;
};

export type UserRejectsInstitutionInvitationParams = {
  invitationId: string;
  userId: string;
  rejectionReason?: string;
  rejectionDate: Date;
};

export type UserRejectsInstitutionInvitationResult = {
  id: string;
  rejectedDate: Date;
};

// Admin institution management types
export type AdminAddUserToInstitutionParams = {
  userId: string;
  institutionId: string;
  role: 'Owner' | 'Finance' | string;
  assignedDate: Date;
};

export type AdminAddUserToInstitutionResult = {
  userId: string;
  institutionId: string;
  role: string;
};

export type AdminRemoveUserFromInstitutionParams = {
  userId: string;
  removedDate: Date;
};

export type AdminRemoveUserFromInstitutionResult = {
  userId: string;
  removed: boolean;
};

// Admin verification types
export type AdminChecksUserKycIdParams = {
  userId: string;
};

export type AdminChecksUserKycIdResult = {
  userId: string;
  kycId: string | null;
};

export type AdminChecksUserInstitutionDataParams = {
  userId: string;
};

export type AdminChecksUserInstitutionDataResult = {
  userId: string;
  institutionUserId: string | null;
  institutionRole: string | null;
};

export type AdminViewsNotificationsByTypeParams = {
  userId: string;
  type:
    | 'UserKycVerified'
    | 'UserKycRejected'
    | 'InstitutionApplicationVerified'
    | 'InstitutionApplicationRejected';
};

export type AdminViewsNotificationsByTypeResult = {
  notifications: Array<{
    type: string;
    title: string;
    content: string;
    userKycId?: string;
    institutionApplicationId?: string;
  }>;
};

// User profile viewing types
export type UserViewsProfileParams = {
  userId: string;
};

export type UserViewsProfileResult = {
  id: string;
  name?: string;
  email?: string;
  emailVerified: boolean;
  emailVerifiedDate?: Date;
  lastLoginDate?: Date;
  profilePicture?: string;
  googleId?: string;
  role: 'System' | 'Admin' | 'User';
  twoFactorEnabled: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
  userType: 'Undecided' | 'Individual' | 'Institution';
  userTypeSelectedDate?: Date;
  institutionUserId?: string | null;
  institutionRole?: 'Owner' | 'Finance' | null;
  kycId?: string | null;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected' | 'approved';
  businessName?: string | null;
  businessType?: string | null;
  expoPushToken?: string | null;
};

export const notificationTypes = [
  // Authentication notifications
  'UserRegistered',
  'EmailVerificationSent',
  'EmailVerified',
  'PhoneNumberVerification',
  'PhoneNumberVerified',
  'PasswordResetRequested',
  'PasswordResetCompleted',
  'TwoFactorEnabled',
  'TwoFactorDisabled',
  'LoginFromNewDevice',
  'SuspiciousLoginAttempt',
  // KYC notifications
  'UserKycVerified',
  'UserKycRejected',
  'UserKycSubmitted',
  // Institution notifications
  'InstitutionApplicationVerified',
  'InstitutionApplicationRejected',
  'InstitutionApplicationSubmitted',
  'InstitutionMemberInvited',
  'InstitutionMemberAccepted',
  'InstitutionMemberRejected',
  // Invoice notifications
  'InvoiceCreated',
  'InvoiceDue',
  'InvoiceExpired',
  'InvoicePartiallyPaid',
  'InvoicePaid',
  // Loan notifications
  'LoanOfferPublished',
  'LoanApplicationPublished',
  'LoanApplicationMatched',
  'LoanOfferMatched',
  'LoanApplicationApproved',
  'LoanApplicationRejected',
  'LoanOfferClosed',
  'LoanDisbursement',
  'LoanActivated',
  'LoanRepaymentDue',
  'LoanRepaymentCompleted',
  'LoanRepaymentReceived',
  'LoanRepaymentFailed',
  'LoanLiquidation',
  'LoanLtvBreach',
  // Beneficiary notifications
  'BeneficiaryVerification',
  // Withdrawal notifications
  'WithdrawalRequested',
  'WithdrawalRefunded',
  'WithdrawalRefundApproved',
  'WithdrawalRefundRejected',
  'WithdrawalFailed',
  'WithdrawalConfirmed',
  'WithdrawalInfoRequested',
  'WithdrawalTimeout',
  // Admin notifications
  'AdminInvitationSent',
  'AdminInvitationAccepted',
  'AdminInvitationRejected',
  'AdminInvitationExpired',
  'AdminWithdrawalFailure',
  'AdminRefundProcessed',
  'AdminMonitoringFailure',
  // Enhanced loan notifications
  'LiquidationWarning',
  'LiquidationCompleted',
  // System notifications
  'PlatformMaintenanceNotice',
  'SecurityAlert',
] as const;

// Notification management types
export type NotificationType = (typeof notificationTypes)[number];

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  isRead: boolean;
  readDate?: Date;
  createdAt: Date;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type UserListsNotificationsParams = {
  userId: string;
  page?: number;
  limit?: number;
  type?: NotificationType;
  unreadOnly?: boolean;
};

export type UserListsNotificationsResult = {
  notifications: Array<NotificationItem>;
  pagination: PaginationMeta;
  unreadCount: number;
};

export type UserMarksNotificationReadParams = {
  userId: string;
  notificationId: string;
};

export type UserMarksNotificationReadResult = {
  id: string;
  readDate: Date;
};

export type UserMarksAllNotificationsReadParams = {
  userId: string;
};

export type UserMarksAllNotificationsReadResult = {
  updatedCount: number;
};

export type UserDeletesNotificationParams = {
  userId: string;
  notificationId: string;
};

export type UserDeletesNotificationResult = {
  id: string;
  deleted: boolean;
};

export type PlatformNotifyUserParams = {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  creationDate?: Date;
  userKycId?: string;
  institutionApplicationId?: string;
};

export type PlatformNotifyUserResult = {
  id: string;
  userId: string;
};

export type TestCreatesInstitutionApplicationWithValidationParams = {
  applicantUserId: string;
  businessName: string;
  businessDescription?: string;
  businessType: string;
  npwpNumber: string;
  npwpDocumentPath: string;
  registrationNumber: string;
  registrationDocumentPath: string;
  establishmentNumber: string;
  deedOfEstablishmentPath: string;
  // domicileCertificatePath: string; // TBD
  businessAddress: string;
  businessCity: string;
  businessProvince: string;
  businessDistrict: string;
  businessSubdistrict: string;
  businessPostalCode: string;
  directorName: string;
  directorPosition?: string;
  directorIdCardPath: string;
  ministryApprovalDocumentPath?: string;
  submittedDate: Date;
};

export type TestCreatesInstitutionApplicationWithValidationResult = {
  id: string;
  applicantUserId: string;
  businessName: string;
};

// User preferences types
export type UserGetPreferencesParams = {
  userId: string;
};

export type UserGetPreferencesResult = {
  id?: string;
  userId: string;
  notifications: {
    email: {
      enabled: boolean;
      types: {
        paymentAlerts: boolean;
        systemNotifications: boolean;
      };
    };
    push: {
      enabled: boolean;
      types: {
        paymentAlerts: boolean;
        systemNotifications: boolean;
      };
    };
    sms: {
      enabled: boolean;
      types: {
        paymentAlerts: boolean;
        systemNotifications: boolean;
      };
    };
  };
  display: {
    theme: 'light' | 'dark';
    language: 'en' | 'id';
    currency: 'USD' | 'IDR' | 'EUR' | 'BTC' | 'ETH';
    timezone?: string;
    dateFormat?: string;
    numberFormat?: string;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    dataSharing: {
      analytics: boolean;
      thirdPartyIntegrations: boolean;
      marketResearch?: boolean;
    };
    activityTracking?: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
};

export type UserUpdatePreferencesParams = {
  userId: string;
  preferences: {
    notifications?: {
      email?: {
        enabled?: boolean;
        types?: {
          paymentAlerts?: boolean;
          systemNotifications?: boolean;
        };
      };
      push?: {
        enabled?: boolean;
        types?: {
          paymentAlerts?: boolean;
          systemNotifications?: boolean;
        };
      };
      sms?: {
        enabled?: boolean;
        types?: {
          paymentAlerts?: boolean;
          systemNotifications?: boolean;
        };
      };
    };
    display?: {
      theme?: string;
      language?: string;
      currency?: string;
      timezone?: string;
      dateFormat?: string;
      numberFormat?: string;
    };
    privacy?: {
      profileVisibility?: string;
      dataSharing?: {
        analytics?: boolean;
        thirdPartyIntegrations?: boolean;
        marketResearch?: boolean;
      };
      activityTracking?: boolean;
    };
  };
  updateDate: Date;
};

export type UserUpdatePreferencesResult = {
  id: string;
  userId: string;
  updatedAt: Date;
};
