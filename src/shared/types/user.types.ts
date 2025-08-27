// Profile management types
export type UserUpdatesProfileParams = {
  id: number;
  fullName?: string;
  profilePictureUrl?: string;
  updateDate: Date;
};

export type UserUpdatesProfileResult = {
  id: number;
  fullName?: string;
  profilePictureUrl?: string;
  updatedDate: Date;
};

// KYC types
export type UserSubmitsKycParams = {
  userId: number;
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
  id: number;
  userId: number;
};

export type UserViewKYCStatusParams = {
  userId: number;
};

export type UserViewKYCSStatusResult = {
  id?: number;
  userId: number;
  status: 'none' | 'pending' | 'verified' | 'rejected';
  submittedDate?: Date;
  verifiedDate?: Date;
  rejectedDate?: Date;
  rejectionReason?: string;
  canResubmit: boolean;
};

export type AdminApprovesKycParams = {
  kycId: number;
  verifierUserId: number;
  approvalDate: Date;
};

export type AdminApprovesKycResult = {
  id: number;
  userId: number;
  verifiedDate: Date;
};

export type AdminRejectsKycParams = {
  kycId: number;
  verifierUserId: number;
  rejectionReason: string;
  rejectionDate: Date;
};

export type AdminRejectsKycResult = {
  id: number;
  userId: number;
  rejectedDate: Date;
};

export type AdminViewPendingKycsResult = {
  kycs: Array<{
    id: number;
    userId: number;
    fullName: string;
    nik: string;
    submittedDate: Date;
  }>;
};

// Institution types
export type UserAppliesForInstitutionParams = {
  applicantUserId: number;
  businessName: string;
  applicationDate: Date;
};

export type UserAppliesForInstitutionResult = {
  id: number;
  applicantUserId: number;
  businessName: string;
};

export type AdminApprovesInstitutionApplicationParams = {
  applicationId: number;
  reviewerUserId: number;
  approvalDate: Date;
};

export type AdminApprovesInstitutionApplicationResult = {
  institutionId: number;
  applicationId: number;
};

export type AdminRejectsInstitutionApplicationParams = {
  applicationId: number;
  reviewerUserId: number;
  rejectionReason: string;
  rejectionDate: Date;
};

export type AdminRejectsInstitutionApplicationResult = {
  id: number;
  rejectedDate: Date;
};

export type OwnerUserInvitesUserToInstitutionParams = {
  institutionId: number;
  userId: number;
  role: 'Owner' | 'Finance';
  invitationDate: Date;
};

export type OwnerUserInvitesUserToInstitutionResult = {
  id: number;
  institutionId: number;
  userId: number;
  role: string;
};

export type UserAcceptsInstitutionInvitationParams = {
  invitationId: number;
  userId: number;
  acceptanceDate: Date;
};

export type UserAcceptsInstitutionInvitationResult = {
  id: number;
  institutionId: number;
  acceptedDate: Date;
};

export type UserRejectsInstitutionInvitationParams = {
  invitationId: number;
  userId: number;
  rejectionReason?: string;
  rejectionDate: Date;
};

export type UserRejectsInstitutionInvitationResult = {
  id: number;
  rejectedDate: Date;
};
