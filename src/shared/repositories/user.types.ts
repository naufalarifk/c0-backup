// Profile management types
export type UserUpdatesProfileParams = {
  id: string;
  fullName?: string;
  profilePictureUrl?: string;
  updateDate: Date;
};

export type UserUpdatesProfileResult = {
  id: string;
  fullName?: string;
  profilePictureUrl?: string | null;
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
  selfiePhoto: string;
  selfieWithIdCardPhoto: string;
  nik: string;
  fullName: string;
  birthCity: string;
  birthDate: Date;
  province: string;
  city: string;
  district: string;
  subdistrict: string;
  address: string;
  postalCode: string;
  phoneNumber: string;
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
    fullName: string;
    nik: string;
    submittedDate: Date;
  }>;
};

// Institution types
export type UserAppliesForInstitutionParams = {
  applicantUserId: string;
  businessName: string;
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

// System types
export type SystemCreatesInstitutionApplicationWithValidationParams = {
  applicantUserId: string;
  businessName: string;
  npwpNumber: string;
  npwpDocumentPath: string;
  registrationNumber: string;
  registrationDocumentPath: string;
  deedOfEstablishmentPath: string;
  // domicileCertificatePath: string; // TBD
  businessAddress: string;
  businessCity: string;
  businessProvince: string;
  businessPostalCode: string;
  directorName: string;
  directorIdCardPath: string;
  submittedDate: Date;
};

export type SystemCreatesInstitutionApplicationWithValidationResult = {
  id: string;
  applicantUserId: string;
  businessName: string;
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
  profilePicture?: string;
  role: 'System' | 'Admin' | 'User';
  twoFactorEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  userType: 'Undecided' | 'Individual' | 'Institution';
  userTypeSelectedDate?: Date;
  institutionUserId?: string | null;
  institutionRole?: 'Owner' | 'Finance' | null;
  kycId?: string | null;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  businessName?: string | null;
  businessType?: string | null;
};
