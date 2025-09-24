import {
  AdminAddUserToInstitutionParams,
  AdminAddUserToInstitutionResult,
  AdminApprovesInstitutionApplicationParams,
  AdminApprovesInstitutionApplicationResult,
  AdminApprovesKycParams,
  AdminApprovesKycResult,
  AdminChecksUserInstitutionDataParams,
  AdminChecksUserInstitutionDataResult,
  AdminChecksUserKycIdParams,
  AdminChecksUserKycIdResult,
  AdminRejectsInstitutionApplicationParams,
  AdminRejectsInstitutionApplicationResult,
  AdminRejectsKycParams,
  AdminRejectsKycResult,
  AdminRemoveUserFromInstitutionParams,
  AdminRemoveUserFromInstitutionResult,
  AdminViewPendingKycsResult,
  AdminViewsNotificationsByTypeParams,
  AdminViewsNotificationsByTypeResult,
  NotificationType,
  OwnerUserInvitesUserToInstitutionParams,
  OwnerUserInvitesUserToInstitutionResult,
  PlatformNotifyUserParams,
  PlatformNotifyUserResult,
  TestCreatesInstitutionApplicationWithValidationParams,
  TestCreatesInstitutionApplicationWithValidationResult,
  UserAcceptsInstitutionInvitationParams,
  UserAcceptsInstitutionInvitationResult,
  UserAppliesForInstitutionParams,
  UserAppliesForInstitutionResult,
  UserDecidesUserTypeParams,
  UserDeletesNotificationParams,
  UserDeletesNotificationResult,
  UserGetPreferencesParams,
  UserGetPreferencesResult,
  UserListsNotificationsParams,
  UserListsNotificationsResult,
  UserMarksAllNotificationsReadParams,
  UserMarksAllNotificationsReadResult,
  UserMarksNotificationReadParams,
  UserMarksNotificationReadResult,
  UserRejectsInstitutionInvitationParams,
  UserRejectsInstitutionInvitationResult,
  UserSubmitsKYCResult,
  UserSubmitsKycParams,
  UserUpdatePreferencesParams,
  UserUpdatePreferencesResult,
  UserUpdatesProfileParams,
  UserUpdatesProfileResult,
  UserViewKYCSStatusResult,
  UserViewKYCStatusParams,
  UserViewsProfileParams,
  UserViewsProfileResult,
} from '../types';
import {
  assertArrayOf,
  assertDefined,
  assertPropDate,
  assertPropDefined,
  assertPropNullableString,
  assertPropNullableStringOrNumber,
  assertPropString,
  assertPropStringOrNumber,
} from '../utils/assertions';
import { BetterAuthRepository } from './better-auth.repository';

/**
 * UserRepository <- BetterAuthRepository <- BaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as encryption, hashing, TOTP verification, etc.
 * should be handled by services that use this repository.
 */
export abstract class UserRepository extends BetterAuthRepository {
  // Profile management methods
  async userUpdatesProfile(params: UserUpdatesProfileParams): Promise<UserUpdatesProfileResult> {
    const tx = await this.beginTransaction();
    try {
      const { id, name, profilePictureUrl, updateDate } = params;

      const rows = await tx.sql`
        UPDATE users
        SET name = COALESCE(${name}, name),
            profile_picture = COALESCE(${profilePictureUrl}, profile_picture),
            updated_date = ${updateDate}
        WHERE id = ${id}
        RETURNING id, name, profile_picture, updated_date;
      `;

      assertArrayOf(rows, function (row) {
        assertDefined(row, 'User not found or update failed');
        assertPropStringOrNumber(row, 'id');
        assertPropString(row, 'name');
        assertPropNullableString(row, 'profile_picture');
        return row;
      });

      const user = rows[0];

      const returnValue: UserUpdatesProfileResult = {
        id: String(user.id),
        name: user.name,
        profilePictureUrl: user.profile_picture,
        updatedDate: updateDate,
      };

      await tx.commitTransaction();
      return returnValue;
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  /**
   * userViewsProfile
   * Returns user profile data based on the user schema
   */
  async userViewsProfile(params: UserViewsProfileParams): Promise<UserViewsProfileResult> {
    const { userId } = params;

    const rows = await this.sql`
      SELECT id, name, email, email_verified_date, last_login_date, profile_picture, role,
             two_factor_enabled, phone_number_verified,
             created_date, updated_date, google_id,
             user_type, user_type_selected_date,
             institution_user_id, institution_role,
             kyc_id, business_name, business_type
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const user = rows[0];
    assertDefined(user);
    assertPropStringOrNumber(user, 'id');

    // Get KYC status using existing helper; default to 'none' if not available
    let kycStatus: 'none' | 'pending' | 'verified' | 'rejected' = 'none';
    try {
      const kyc = await this.userViewsKYCStatus({ userId });
      if (kyc && kyc.status) kycStatus = kyc.status;
    } catch (_error) {
      // Ignore errors and default to 'none'
    }

    return {
      id: String(user.id),
      name: 'name' in user && typeof user.name === 'string' ? user.name : undefined,
      email: 'email' in user && typeof user.email === 'string' ? user.email : undefined,
      emailVerified: 'email_verified_date' in user ? !!user.email_verified_date : false,
      emailVerifiedDate:
        'email_verified_date' in user && user.email_verified_date instanceof Date
          ? user.email_verified_date
          : undefined,
      lastLoginDate:
        'last_login_date' in user && user.last_login_date instanceof Date
          ? user.last_login_date
          : undefined,
      profilePicture:
        'profile_picture' in user && typeof user.profile_picture === 'string'
          ? user.profile_picture
          : undefined,
      googleId:
        'google_id' in user && typeof user.google_id === 'string' ? user.google_id : undefined,
      role:
        'role' in user && typeof user.role === 'string'
          ? (user.role as 'System' | 'Admin' | 'User')
          : 'User',
      twoFactorEnabled: 'two_factor_enabled' in user ? !!user.two_factor_enabled : false,
      createdAt:
        'created_date' in user && user.created_date instanceof Date ? user.created_date : undefined,
      updatedAt:
        'updated_date' in user && user.updated_date instanceof Date ? user.updated_date : undefined,
      userType:
        'user_type' in user && typeof user.user_type === 'string'
          ? (user.user_type as 'Undecided' | 'Individual' | 'Institution')
          : 'Undecided',
      userTypeSelectedDate:
        'user_type_selected_date' in user && user.user_type_selected_date instanceof Date
          ? user.user_type_selected_date
          : undefined,
      institutionUserId:
        'institution_user_id' in user && user.institution_user_id
          ? String(user.institution_user_id)
          : null,
      institutionRole:
        'institution_role' in user && typeof user.institution_role === 'string'
          ? (user.institution_role as 'Owner' | 'Finance')
          : null,
      kycId: 'kyc_id' in user && user.kyc_id ? String(user.kyc_id) : null,
      kycStatus,
      businessName:
        'business_name' in user && typeof user.business_name === 'string'
          ? user.business_name
          : null,
      businessType:
        'business_type' in user && typeof user.business_type === 'string'
          ? user.business_type
          : null,
    };
  }

  // Mandatory choise between KYC or Institution Application
  async userDecidesUserType(params: UserDecidesUserTypeParams): Promise<void> {
    const tx = await this.beginTransaction();
    try {
      const { userId, userType, decisionDate } = params;

      const rows = await tx.sql`
        UPDATE users
        SET user_type = ${userType}, user_type_selected_date = ${decisionDate}
        WHERE id = ${userId} AND user_type = 'Undecided'
        RETURNING id;
      `;

      const row = rows[0];

      if (!row) {
        await tx.rollbackTransaction();
        throw new Error('User type decision failed or already made');
      }

      await tx.commitTransaction();
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // KYC methods
  async userSubmitsKyc(params: UserSubmitsKycParams): Promise<UserSubmitsKYCResult> {
    const tx = await this.beginTransaction();
    try {
      const {
        userId,
        idCardPhoto,
        selfieWithIdCardPhoto,
        nik,
        name,
        birthCity,
        birthDate,
        province,
        city,
        district,
        subdistrict,
        address,
        postalCode,
        submissionDate,
      } = params;

      const rows = await tx.sql`
        INSERT INTO user_kycs (
          user_id, submitted_date, id_card_photo, selfie_with_id_card_photo,
          nik, name, birth_city, birth_date, province, city,
          district, subdistrict, address, postal_code
        )
        VALUES (
          ${userId}, ${submissionDate}, ${idCardPhoto}, ${selfieWithIdCardPhoto},
          ${nik}, ${name}, ${birthCity}, ${birthDate}, ${province}, ${city},
          ${district}, ${subdistrict}, ${address}, ${postalCode}
        )
        RETURNING id, user_id;
      `;

      const kyc = rows[0];
      assertDefined(kyc);
      assertPropStringOrNumber(kyc, 'id');
      assertPropStringOrNumber(kyc, 'user_id');

      await tx.commitTransaction();

      return {
        id: String(kyc.id),
        userId: String(kyc.user_id),
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userViewsKYCStatus(params: UserViewKYCStatusParams): Promise<UserViewKYCSStatusResult> {
    const { userId } = params;

    const rows = await this.sql`
      SELECT id, user_id, submitted_date, verified_date, rejected_date, rejection_reason
      FROM user_kycs
      WHERE user_id = ${userId}
      ORDER BY submitted_date DESC
      LIMIT 1
    `;
    const kycs = rows;

    if (kycs.length === 0 || !kycs[0]) {
      return {
        userId: String(userId),
        status: 'none' as const,
        canResubmit: true,
      };
    }

    const kyc = kycs[0];
    assertPropStringOrNumber(kyc, 'id');
    assertPropStringOrNumber(kyc, 'user_id');

    let status: 'none' | 'pending' | 'verified' | 'rejected';
    if ('verified_date' in kyc && kyc.verified_date) {
      status = 'verified';
    } else if ('rejected_date' in kyc && kyc.rejected_date) {
      status = 'rejected';
    } else {
      status = 'pending';
    }

    return {
      id: String(kyc.id),
      userId: String(kyc.user_id),
      status,
      submittedDate:
        'submitted_date' in kyc && kyc.submitted_date instanceof Date
          ? kyc.submitted_date
          : undefined,
      verifiedDate:
        'verified_date' in kyc && kyc.verified_date instanceof Date ? kyc.verified_date : undefined,
      rejectedDate:
        'rejected_date' in kyc && kyc.rejected_date instanceof Date ? kyc.rejected_date : undefined,
      rejectionReason:
        'rejection_reason' in kyc && typeof kyc.rejection_reason === 'string'
          ? kyc.rejection_reason
          : undefined,
      canResubmit: status === 'rejected',
    };
  }

  async adminApprovesKYCParam(params: AdminApprovesKycParams): Promise<AdminApprovesKycResult> {
    const tx = await this.beginTransaction();
    try {
      const { kycId, verifierUserId, approvalDate } = params;

      const rows = await tx.sql`
        UPDATE user_kycs
        SET verifier_user_id = ${verifierUserId},
            verified_date = ${approvalDate}
        WHERE id = ${kycId} AND verified_date IS NULL AND rejected_date IS NULL
        RETURNING id, user_id, verified_date;
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('KYC approval failed');
      }

      const kyc = rows[0];
      assertDefined(kyc, 'KYC not found or already processed');
      assertPropStringOrNumber(kyc, 'id');
      assertPropStringOrNumber(kyc, 'user_id');
      assertPropDate(kyc, 'verified_date');

      await tx.commitTransaction();

      return {
        id: String(kyc.id),
        userId: String(kyc.user_id),
        verifiedDate: kyc.verified_date,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminRejectsKyc(params: AdminRejectsKycParams): Promise<AdminRejectsKycResult> {
    const tx = await this.beginTransaction();
    try {
      const { kycId, verifierUserId, rejectionReason, rejectionDate } = params;

      const rows = await tx.sql`
        UPDATE user_kycs
        SET verifier_user_id = ${verifierUserId},
            rejected_date = ${rejectionDate},
            rejection_reason = ${rejectionReason}
        WHERE id = ${kycId} AND verified_date IS NULL AND rejected_date IS NULL
        RETURNING id, user_id, rejected_date;
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('KYC not found or already processed');
      }

      const kyc = rows[0];
      assertDefined(kyc, 'KYC not found or already processed');
      assertPropStringOrNumber(kyc, 'id');
      assertPropStringOrNumber(kyc, 'user_id');
      assertPropDate(kyc, 'rejected_date');

      await tx.commitTransaction();

      return {
        id: String(kyc.id),
        userId: String(kyc.user_id),
        rejectedDate: kyc.rejected_date,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminViewsPendingKYCs(): Promise<AdminViewPendingKycsResult> {
    const rows = await this.sql`
      SELECT id, user_id, name, nik, submitted_date
      FROM user_kycs
      WHERE verified_date IS NULL AND rejected_date IS NULL
      ORDER BY submitted_date ASC
    `;

    const kycs = rows;

    return {
      kycs: kycs.map(function (kyc: unknown) {
        assertDefined(kyc);
        assertPropStringOrNumber(kyc, 'id');
        assertPropStringOrNumber(kyc, 'user_id');
        assertPropString(kyc, 'name');
        assertPropString(kyc, 'nik');
        assertPropDate(kyc, 'submitted_date');
        return {
          id: String(kyc.id),
          userId: String(kyc.user_id),
          name: kyc.name,
          nik: kyc.nik,
          submittedDate: kyc.submitted_date,
        };
      }),
    };
  }

  // Institution methods
  async userAppliesForInstitution(
    params: UserAppliesForInstitutionParams,
  ): Promise<UserAppliesForInstitutionResult> {
    const tx = await this.beginTransaction();
    try {
      const {
        applicantUserId,
        businessName,
        businessDescription,
        businessType,
        npwpNumber,
        npwpDocumentPath,
        registrationNumber,
        registrationDocumentPath,
        deedOfEstablishmentPath,
        businessAddress,
        businessCity,
        businessProvince,
        businessDistrict,
        businessSubdistrict,
        businessPostalCode,
        directorName,
        directorIdCardPath,
        applicationDate,
      } = params;

      const rows = await tx.sql`
        INSERT INTO institution_applications (
          applicant_user_id, business_name, business_description, business_type,
          npwp_number, npwp_document_path, registration_number, registration_document_path,
          deed_of_establishment_path, business_address,
          business_city, business_province, business_district, business_subdistrict,
          business_postal_code, director_name, director_id_card_path, submitted_date
        )
        VALUES (
          ${applicantUserId}, ${businessName}, ${businessDescription}, ${businessType},
          ${npwpNumber}, ${npwpDocumentPath}, ${registrationNumber}, ${registrationDocumentPath},
          ${deedOfEstablishmentPath}, ${businessAddress},
          ${businessCity}, ${businessProvince}, ${businessDistrict}, ${businessSubdistrict},
          ${businessPostalCode}, ${directorName}, ${directorIdCardPath}, ${applicationDate}
        )
        RETURNING id, applicant_user_id, business_name;
      `;

      const application = rows[0];
      assertDefined(application, 'Institution application failed');
      assertPropStringOrNumber(application, 'id');
      assertPropStringOrNumber(application, 'applicant_user_id');
      assertPropString(application, 'business_name');

      await tx.commitTransaction();

      return {
        id: String(application.id),
        applicantUserId: String(application.applicant_user_id),
        businessName: application.business_name,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminApprovesInstitutionApplication(
    params: AdminApprovesInstitutionApplicationParams,
  ): Promise<AdminApprovesInstitutionApplicationResult> {
    const tx = await this.beginTransaction();
    try {
      const { applicationId, reviewerUserId, approvalDate } = params;

      // Get application details
      const rows = await tx.sql`
        SELECT id, applicant_user_id, business_name
        FROM institution_applications
        WHERE id = ${applicationId} AND verified_date IS NULL AND rejected_date IS NULL
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Application not found or already processed');
      }

      const application = rows[0];
      assertDefined(application, 'Application not found or already processed');
      assertPropStringOrNumber(application, 'id');
      assertPropStringOrNumber(application, 'applicant_user_id');
      assertPropString(application, 'business_name');

      // Update application status (trigger will handle user update)
      await tx.sql`
        UPDATE institution_applications
        SET reviewer_user_id = ${reviewerUserId}, verified_date = ${approvalDate}
        WHERE id = ${applicationId}
      `;

      await tx.commitTransaction();

      return {
        institutionId: String(application.applicant_user_id), // The applicant becomes the institution owner
        applicationId: String(applicationId),
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminRejectInstitutionApplication(
    params: AdminRejectsInstitutionApplicationParams,
  ): Promise<AdminRejectsInstitutionApplicationResult> {
    const tx = await this.beginTransaction();
    try {
      const { applicationId, reviewerUserId, rejectionReason, rejectionDate } = params;

      const rows = await tx.sql`
        UPDATE institution_applications
        SET reviewer_user_id = ${reviewerUserId},
            rejected_date = ${rejectionDate},
            rejection_reason = ${rejectionReason}
        WHERE id = ${applicationId} AND verified_date IS NULL AND rejected_date IS NULL
        RETURNING id, rejected_date;
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Application rejection failed');
      }

      const application = rows[0];
      assertDefined(application, 'Application not found or already processed');
      assertPropStringOrNumber(application, 'id');
      assertPropDate(application, 'rejected_date');

      await tx.commitTransaction();
      return {
        id: String(application.id),
        rejectedDate: application.rejected_date,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async ownerUserInvitesUserToInstitution(
    params: OwnerUserInvitesUserToInstitutionParams,
  ): Promise<OwnerUserInvitesUserToInstitutionResult> {
    const tx = await this.beginTransaction();
    try {
      const { institutionId, userId, role, invitationDate } = params;

      // Calculate expiration date (7 days from invitation date)
      const expirationDate = new Date(invitationDate);
      expirationDate.setDate(expirationDate.getDate() + 7);

      // Create pending invitation (not auto-accepted)
      const rows = await tx.sql`
        INSERT INTO institution_invitations (institution_user_id, target_user_id, role, invited_date, expires_date)
        VALUES (${institutionId}, ${userId}, ${role}, ${invitationDate}, ${expirationDate})
        RETURNING id, institution_user_id, target_user_id, role;
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Institution invitation failed');
      }

      const invitation = rows[0];
      assertDefined(invitation, 'Institution invitation failed');
      assertPropStringOrNumber(invitation, 'id');
      assertPropStringOrNumber(invitation, 'institution_user_id');
      assertPropStringOrNumber(invitation, 'target_user_id');
      assertPropString(invitation, 'role');

      await tx.commitTransaction();

      return {
        id: String(invitation.id),
        institutionId: String(invitation.institution_user_id),
        userId: String(invitation.target_user_id),
        role: invitation.role,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userAcceptsInstitutionInvitation(
    params: UserAcceptsInstitutionInvitationParams,
  ): Promise<UserAcceptsInstitutionInvitationResult> {
    const tx = await this.beginTransaction();
    try {
      const { invitationId, userId: _userId, acceptanceDate } = params;

      // Get invitation details
      const invitationRows = await tx.sql`
        SELECT institution_user_id, role
        FROM institution_invitations
        WHERE id = ${invitationId} AND accepted_date IS NULL AND rejected_date IS NULL
      `;

      if (invitationRows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Invitation not found or already processed');
      }

      // Convert Date to UTC timestamp for database storage
      const acceptanceTimestamp = acceptanceDate.toISOString();

      // Update invitation status (trigger will handle user update)
      const updatedInvitationRows = await tx.sql`
        UPDATE institution_invitations
        SET accepted_date = ${acceptanceTimestamp}
        WHERE id = ${invitationId}
        RETURNING id, institution_user_id, accepted_date;
      `;

      const updatedInvitation = updatedInvitationRows[0];
      assertDefined(updatedInvitation, 'Failed to update invitation status');
      assertPropStringOrNumber(updatedInvitation, 'id');
      assertPropStringOrNumber(updatedInvitation, 'institution_user_id');
      assertPropDate(updatedInvitation, 'accepted_date');

      await tx.commitTransaction();

      return {
        id: String(updatedInvitation.id),
        institutionId: String(updatedInvitation.institution_user_id),
        acceptedDate: new Date(updatedInvitation.accepted_date),
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userRejectsInstitutionInvitation(
    params: UserRejectsInstitutionInvitationParams,
  ): Promise<UserRejectsInstitutionInvitationResult> {
    const tx = await this.beginTransaction();
    try {
      const { invitationId, userId: _userId, rejectionReason, rejectionDate } = params;

      // Convert Date to UTC timestamp for database storage
      const rejectionTimestamp = rejectionDate.toISOString();

      const rows = await tx.sql`
        UPDATE institution_invitations
        SET rejected_date = ${rejectionTimestamp},
            rejection_reason = ${rejectionReason}
        WHERE id = ${invitationId} AND accepted_date IS NULL AND rejected_date IS NULL
        RETURNING id, rejected_date;
      `;

      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        await tx.rollbackTransaction();
        throw new Error('Invitation rejection failed');
      }

      const invitation = rows[0];
      assertDefined(invitation, 'Invitation not found or already processed');
      assertPropStringOrNumber(invitation, 'id');
      assertPropDate(invitation, 'rejected_date');

      await tx.commitTransaction();

      return {
        id: String(invitation.id),
        rejectedDate: invitation.rejected_date,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Institution membership management (explicit methods for services to call)
  async adminAddUserToInstitution(
    params: AdminAddUserToInstitutionParams,
  ): Promise<AdminAddUserToInstitutionResult> {
    const tx = await this.beginTransaction();
    try {
      const { userId, institutionId, role, assignedDate: _assignedDate } = params;

      const rows = await tx.sql`
        UPDATE users
        SET institution_user_id = ${institutionId}, institution_role = ${role}
        WHERE id = ${userId}
        RETURNING id, institution_user_id, institution_role;
      `;

      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        await tx.rollbackTransaction();
        throw new Error('Failed to add user to institution');
      }

      assertArrayOf(rows, function (row) {
        assertDefined(row, 'Failed to add user to institution');
        assertPropStringOrNumber(row, 'id');
        assertPropStringOrNumber(row, 'institution_user_id');
        assertPropString(row, 'institution_role');
        return row;
      });

      const row = Array.isArray(rows) ? rows[0] : rows;

      await tx.commitTransaction();

      return {
        userId: String(row.id),
        institutionId: String(row.institution_user_id),
        role: row.institution_role,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminRemoveUserFromInstitution(
    params: AdminRemoveUserFromInstitutionParams,
  ): Promise<AdminRemoveUserFromInstitutionResult> {
    const tx = await this.beginTransaction();
    try {
      const { userId, removedDate: _removedDate } = params;

      const rows = await tx.sql`
        UPDATE users
        SET institution_user_id = NULL, institution_role = NULL
        WHERE id = ${userId}
        RETURNING id;
      `;

      assertArrayOf(rows, function (row) {
        assertDefined(row, 'Failed to remove user from institution');
        assertPropStringOrNumber(row, 'id');
        return row;
      });

      if (rows.length === 0) {
        const returnValue = { userId, removed: false };
        await tx.commitTransaction();
        return returnValue;
      }

      const row = rows[0];

      await tx.commitTransaction();

      return {
        userId: String(row.id),
        removed: true,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Test-specific methods for verifying internal state
  async adminChecksUserKycId(
    params: AdminChecksUserKycIdParams,
  ): Promise<AdminChecksUserKycIdResult> {
    const { userId } = params;

    const rows = await this.sql`SELECT kyc_id FROM users WHERE id = ${userId}`;
    const user = rows[0];
    assertDefined(user, 'User not found');
    assertPropStringOrNumber(user, 'kyc_id');

    return {
      userId: String(userId),
      kycId: user.kyc_id ? String(user.kyc_id) : null,
    };
  }

  async adminChecksUserInstitutionData(
    params: AdminChecksUserInstitutionDataParams,
  ): Promise<AdminChecksUserInstitutionDataResult> {
    const { userId } = params;

    const rows = await this.sql`
      SELECT institution_user_id, institution_role FROM users WHERE id = ${userId}
    `;
    const user = rows[0];
    assertDefined(user, 'User not found');

    return {
      userId: String(userId),
      institutionUserId: 'institution_user_id' in user ? String(user.institution_user_id) : null,
      institutionRole:
        'institution_role' in user && user.institution_role ? String(user.institution_role) : null,
    };
  }

  async adminViewsNotificationsByType(
    params: AdminViewsNotificationsByTypeParams,
  ): Promise<AdminViewsNotificationsByTypeResult> {
    const { userId, type } = params;

    const rows = await this.sql`
      SELECT type, title, content, user_kyc_id, institution_application_id FROM notifications
      WHERE user_id = ${userId} AND type = ${type}
    `;

    const notifications = rows;

    return {
      notifications: notifications.map(function (notification: unknown) {
        assertDefined(notification);
        assertPropString(notification, 'type');
        assertPropString(notification, 'title');
        assertPropString(notification, 'content');
        assertPropNullableStringOrNumber(notification, 'user_kyc_id');
        assertPropNullableStringOrNumber(notification, 'institution_application_id');
        return {
          type: notification.type,
          title: notification.title,
          content: notification.content,
          userKycId: notification.user_kyc_id ? String(notification.user_kyc_id) : undefined,
          institutionApplicationId: notification.institution_application_id
            ? String(notification.institution_application_id)
            : undefined,
        };
      }),
    };
  }

  // Notification management methods
  async userListsNotifications(
    params: UserListsNotificationsParams,
  ): Promise<UserListsNotificationsResult> {
    try {
      const { userId, page = 1, limit = 20, type, unreadOnly = false } = params;

      // Validate pagination parameters
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(Math.max(1, limit), 100);
      const offset = (validatedPage - 1) * validatedLimit;

      // Base query with conditional WHERE clauses
      let notificationsQuery: unknown[] = [];
      let countQuery: unknown[] = [];
      let unreadCountQuery: unknown[] = [];

      if (type && unreadOnly) {
        // Both type and unread filters
        notificationsQuery = await this.sql`
          SELECT id, type, title, content, read_date, creation_date
          FROM notifications
          WHERE user_id = ${userId} AND type = ${type} AND read_date IS NULL
          ORDER BY creation_date DESC
          LIMIT ${validatedLimit} OFFSET ${offset}
        `;
        countQuery = await this.sql`
          SELECT COUNT(*) as count FROM notifications
          WHERE user_id = ${userId} AND type = ${type} AND read_date IS NULL
        `;
      } else if (type) {
        // Only type filter
        notificationsQuery = await this.sql`
          SELECT id, type, title, content, read_date, creation_date
          FROM notifications
          WHERE user_id = ${userId} AND type = ${type}
          ORDER BY creation_date DESC
          LIMIT ${validatedLimit} OFFSET ${offset}
        `;
        countQuery = await this.sql`
          SELECT COUNT(*) as count FROM notifications
          WHERE user_id = ${userId} AND type = ${type}
        `;
      } else if (unreadOnly) {
        // Only unread filter
        notificationsQuery = await this.sql`
          SELECT id, type, title, content, read_date, creation_date
          FROM notifications
          WHERE user_id = ${userId} AND read_date IS NULL
          ORDER BY creation_date DESC
          LIMIT ${validatedLimit} OFFSET ${offset}
        `;
        countQuery = await this.sql`
          SELECT COUNT(*) as count FROM notifications
          WHERE user_id = ${userId} AND read_date IS NULL
        `;
      } else {
        // No filters
        notificationsQuery = await this.sql`
          SELECT id, type, title, content, read_date, creation_date
          FROM notifications
          WHERE user_id = ${userId}
          ORDER BY creation_date DESC
          LIMIT ${validatedLimit} OFFSET ${offset}
        `;
        countQuery = await this.sql`
          SELECT COUNT(*) as count FROM notifications
          WHERE user_id = ${userId}
        `;
      }

      // Get unread count (always the same)
      unreadCountQuery = await this.sql`
        SELECT COUNT(*) as count FROM notifications
        WHERE user_id = ${userId} AND read_date IS NULL
      `;
      assertDefined(countQuery[0]);
      assertPropDefined(countQuery[0], 'count');
      assertDefined(unreadCountQuery[0]);
      assertPropDefined(unreadCountQuery[0], 'count');

      const totalCount = Number(countQuery[0]?.count || 0);
      const unreadCount = Number(unreadCountQuery[0]?.count || 0);

      // Transform notifications
      const notifications = notificationsQuery.map(function (row: unknown) {
        assertDefined(row);
        assertPropStringOrNumber(row, 'id');
        assertPropString(row, 'type');
        assertPropString(row, 'title');
        assertPropString(row, 'content');
        assertPropDate(row, 'creation_date');

        return {
          id: String(row.id),
          type: row.type as NotificationType,
          title: row.title,
          content: row.content,
          isRead: 'read_date' in row && !!row.read_date,
          readDate: 'read_date' in row && row.read_date instanceof Date ? row.read_date : undefined,
          createdAt: row.creation_date,
        };
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / validatedLimit);

      return {
        notifications,
        pagination: {
          page: validatedPage,
          limit: validatedLimit,
          total: totalCount,
          totalPages,
          hasNext: validatedPage < totalPages,
          hasPrev: validatedPage > 1,
        },
        unreadCount,
      };
    } catch (error) {
      console.error('UserRepository', error);
      throw error;
    }
  }

  async userMarksNotificationRead(
    params: UserMarksNotificationReadParams,
  ): Promise<UserMarksNotificationReadResult> {
    const tx = await this.beginTransaction();
    try {
      const { userId, notificationId } = params;
      const readDate = new Date();

      const rows = await tx.sql`
        UPDATE notifications
        SET read_date = ${readDate}
        WHERE id = ${notificationId} AND user_id = ${userId} AND read_date IS NULL
        RETURNING id, read_date
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Notification not found or already read');
      }

      const notification = rows[0];
      assertDefined(notification);
      assertPropStringOrNumber(notification, 'id');
      assertPropDate(notification, 'read_date');

      await tx.commitTransaction();

      return {
        id: String(notification.id),
        readDate: notification.read_date,
      };
    } catch (error) {
      console.error('UserRepository', error);
      // Only rollback if error was not a manual rollback
      if (!error.message?.includes('Notification not found or already read')) {
        await tx.rollbackTransaction();
      }
      throw error;
    }
  }

  async userMarksAllNotificationsRead(
    params: UserMarksAllNotificationsReadParams,
  ): Promise<UserMarksAllNotificationsReadResult> {
    const tx = await this.beginTransaction();
    try {
      const { userId } = params;
      const readDate = new Date();

      const rows = await tx.sql`
        UPDATE notifications
        SET read_date = ${readDate}
        WHERE user_id = ${userId} AND read_date IS NULL
        RETURNING id
      `;

      await tx.commitTransaction();

      return {
        updatedCount: rows.length,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async userDeletesNotification(
    params: UserDeletesNotificationParams,
  ): Promise<UserDeletesNotificationResult> {
    const tx = await this.beginTransaction();
    try {
      const { userId, notificationId } = params;

      const rows = await tx.sql`
        DELETE FROM notifications
        WHERE id = ${notificationId} AND user_id = ${userId}
        RETURNING id
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Notification not found or access denied');
      }

      const notification = rows[0];
      assertDefined(notification);
      assertPropStringOrNumber(notification, 'id');

      await tx.commitTransaction();

      return {
        id: String(notification.id),
        deleted: true,
      };
    } catch (error) {
      console.error('UserRepository', error);
      // Only rollback if error was not a manual rollback
      if (!error.message?.includes('Notification not found or access denied')) {
        await tx.rollbackTransaction();
      }
      throw error;
    }
  }

  async platformNotifyUser(params: PlatformNotifyUserParams): Promise<PlatformNotifyUserResult> {
    const tx = await this.beginTransaction();
    try {
      const {
        userId,
        type,
        title,
        content,
        creationDate = new Date(),
        userKycId: _userKycId,
        institutionApplicationId: _institutionApplicationId,
      } = params;

      // For now, create notification without optional fields due to in-memory database limitations
      // The optional fields will be handled in production with proper PostgreSQL migrations
      let rows;
      try {
        rows = await tx.sql`
          INSERT INTO notifications (user_id, type, title, content, creation_date)
          VALUES (${userId}, ${type}, ${title}, ${content}, ${creationDate})
          RETURNING id, user_id
        `;
      } catch (insertError) {
        console.error('UserRepository Error during notification INSERT:', insertError);
        try {
          await tx.rollbackTransaction();
        } catch (rollbackError) {
          console.error('UserRepository Error during rollback:', rollbackError);
        }
        throw new Error('Failed to create notification');
      }

      if (rows.length === 0) {
        try {
          await tx.rollbackTransaction();
        } catch (rollbackError) {
          console.error('UserRepository Error during rollback:', rollbackError);
        }
        throw new Error('Failed to create notification');
      }

      const notification = rows[0];
      assertDefined(notification);
      assertPropStringOrNumber(notification, 'id');
      assertPropStringOrNumber(notification, 'user_id');

      await tx.commitTransaction();

      return {
        id: String(notification.id),
        userId: String(notification.user_id),
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async testCreatesInstitutionApplicationWithValidation(
    params: TestCreatesInstitutionApplicationWithValidationParams,
  ): Promise<TestCreatesInstitutionApplicationWithValidationResult> {
    const tx = await this.beginTransaction();
    try {
      const {
        applicantUserId,
        businessName,
        npwpNumber,
        npwpDocumentPath,
        registrationNumber,
        registrationDocumentPath,
        deedOfEstablishmentPath,
        // domicileCertificatePath, # TBD
        businessAddress,
        businessCity,
        businessProvince,
        businessDistrict,
        businessSubdistrict,
        businessPostalCode,
        directorName,
        directorIdCardPath,
        submittedDate,
      } = params;

      const rows = await tx.sql`
        INSERT INTO institution_applications (
          applicant_user_id, business_name, npwp_number, npwp_document_path,
          registration_number, registration_document_path, deed_of_establishment_path,
          business_address, business_city, business_province, business_district,
          business_subdistrict, business_postal_code, director_name, director_id_card_path, submitted_date
        ) VALUES (
          ${applicantUserId}, ${businessName}, ${npwpNumber}, ${npwpDocumentPath},
          ${registrationNumber}, ${registrationDocumentPath}, ${deedOfEstablishmentPath},
          ${businessAddress}, ${businessCity}, ${businessProvince}, ${businessDistrict},
          ${businessSubdistrict}, ${businessPostalCode}, ${directorName}, ${directorIdCardPath}, ${submittedDate}
        ) RETURNING id, applicant_user_id, business_name
      `;

      const application = rows[0];
      assertDefined(application, 'Institution application creation failed');
      assertPropStringOrNumber(application, 'id');
      assertPropStringOrNumber(application, 'applicant_user_id');
      assertPropString(application, 'business_name');

      await tx.commitTransaction();

      return {
        id: String(application.id),
        applicantUserId: String(application.applicant_user_id),
        businessName: application.business_name,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // User preferences methods
  async userGetsPreferences(params: UserGetPreferencesParams): Promise<UserGetPreferencesResult> {
    const { userId } = params;

    const rows = await this.sql`
      SELECT id, user_id,
             email_notifications_enabled, email_payment_alerts, email_system_notifications,
             push_notifications_enabled, push_payment_alerts, push_system_notifications,
             sms_notifications_enabled, sms_payment_alerts, sms_system_notifications,
             theme, language, currency, timezone, date_format, number_format,
             profile_visibility, analytics_enabled, third_party_integrations_enabled, market_research_enabled, activity_tracking_enabled,
             created_date, updated_date
      FROM user_preferences
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Return default preferences if none exist
      return {
        userId: String(userId),
        notifications: {
          email: {
            enabled: true,
            types: {
              paymentAlerts: true,
              systemNotifications: true,
            },
          },
          push: {
            enabled: true,
            types: {
              paymentAlerts: true,
              systemNotifications: true,
            },
          },
          sms: {
            enabled: false,
            types: {
              paymentAlerts: false,
              systemNotifications: false,
            },
          },
        },
        display: {
          theme: 'light' as const,
          language: 'en' as const,
          currency: 'USD' as const,
        },
        privacy: {
          profileVisibility: 'private' as const,
          dataSharing: {
            analytics: true,
            thirdPartyIntegrations: false,
            marketResearch: false,
          },
          activityTracking: false,
        },
      };
    }

    const preferences = rows[0];
    assertDefined(preferences);
    assertPropStringOrNumber(preferences, 'id');
    assertPropStringOrNumber(preferences, 'user_id');

    return {
      id: String(preferences.id),
      userId: String(preferences.user_id),
      notifications: {
        email: {
          enabled:
            'email_notifications_enabled' in preferences
              ? Boolean(preferences.email_notifications_enabled)
              : true,
          types: {
            paymentAlerts:
              'email_payment_alerts' in preferences
                ? Boolean(preferences.email_payment_alerts)
                : true,
            systemNotifications:
              'email_system_notifications' in preferences
                ? Boolean(preferences.email_system_notifications)
                : true,
          },
        },
        push: {
          enabled:
            'push_notifications_enabled' in preferences
              ? Boolean(preferences.push_notifications_enabled)
              : true,
          types: {
            paymentAlerts:
              'push_payment_alerts' in preferences
                ? Boolean(preferences.push_payment_alerts)
                : true,
            systemNotifications:
              'push_system_notifications' in preferences
                ? Boolean(preferences.push_system_notifications)
                : true,
          },
        },
        sms: {
          enabled:
            'sms_notifications_enabled' in preferences
              ? Boolean(preferences.sms_notifications_enabled)
              : false,
          types: {
            paymentAlerts:
              'sms_payment_alerts' in preferences ? Boolean(preferences.sms_payment_alerts) : false,
            systemNotifications:
              'sms_system_notifications' in preferences
                ? Boolean(preferences.sms_system_notifications)
                : false,
          },
        },
      },
      display: {
        theme: ('theme' in preferences && typeof preferences.theme === 'string'
          ? preferences.theme
          : 'light') as 'light' | 'dark',
        language: ('language' in preferences && typeof preferences.language === 'string'
          ? preferences.language
          : 'en') as 'en' | 'id',
        currency: ('currency' in preferences && typeof preferences.currency === 'string'
          ? preferences.currency
          : 'USD') as 'USD' | 'IDR' | 'EUR' | 'BTC' | 'ETH',
        timezone:
          'timezone' in preferences && typeof preferences.timezone === 'string'
            ? preferences.timezone
            : undefined,
        dateFormat:
          'date_format' in preferences && typeof preferences.date_format === 'string'
            ? preferences.date_format
            : undefined,
        numberFormat:
          'number_format' in preferences && typeof preferences.number_format === 'string'
            ? preferences.number_format
            : undefined,
      },
      privacy: {
        profileVisibility: ('profile_visibility' in preferences &&
        typeof preferences.profile_visibility === 'string'
          ? preferences.profile_visibility
          : 'private') as 'public' | 'private',
        dataSharing: {
          analytics:
            'analytics_enabled' in preferences ? Boolean(preferences.analytics_enabled) : true,
          thirdPartyIntegrations:
            'third_party_integrations_enabled' in preferences
              ? Boolean(preferences.third_party_integrations_enabled)
              : false,
          marketResearch:
            'market_research_enabled' in preferences
              ? Boolean(preferences.market_research_enabled)
              : false,
        },
        activityTracking:
          'activity_tracking_enabled' in preferences
            ? Boolean(preferences.activity_tracking_enabled)
            : false,
      },
      createdAt:
        'created_date' in preferences && preferences.created_date instanceof Date
          ? preferences.created_date
          : undefined,
      updatedAt:
        'updated_date' in preferences && preferences.updated_date instanceof Date
          ? preferences.updated_date
          : undefined,
    };
  }

  async userUpdatesPreferences(
    params: UserUpdatePreferencesParams,
  ): Promise<UserUpdatePreferencesResult> {
    const tx = await this.beginTransaction();
    try {
      const { userId, preferences, updateDate } = params;

      // Get current preferences to merge with updates
      const current = await this.userGetsPreferences({ userId });

      // Merge preferences
      const updated = {
        email_notifications_enabled:
          preferences.notifications?.email?.enabled ?? current.notifications.email.enabled,
        email_payment_alerts:
          preferences.notifications?.email?.types?.paymentAlerts ??
          current.notifications.email.types.paymentAlerts,
        email_system_notifications:
          preferences.notifications?.email?.types?.systemNotifications ??
          current.notifications.email.types.systemNotifications,
        push_notifications_enabled:
          preferences.notifications?.push?.enabled ?? current.notifications.push.enabled,
        push_payment_alerts:
          preferences.notifications?.push?.types?.paymentAlerts ??
          current.notifications.push.types.paymentAlerts,
        push_system_notifications:
          preferences.notifications?.push?.types?.systemNotifications ??
          current.notifications.push.types.systemNotifications,
        sms_notifications_enabled:
          preferences.notifications?.sms?.enabled ?? current.notifications.sms.enabled,
        sms_payment_alerts:
          preferences.notifications?.sms?.types?.paymentAlerts ??
          current.notifications.sms.types.paymentAlerts,
        sms_system_notifications:
          preferences.notifications?.sms?.types?.systemNotifications ??
          current.notifications.sms.types.systemNotifications,
        theme: preferences.display?.theme ?? current.display.theme,
        language: preferences.display?.language ?? current.display.language,
        currency: preferences.display?.currency ?? current.display.currency,
        timezone: preferences.display?.timezone ?? current.display.timezone,
        date_format: preferences.display?.dateFormat ?? current.display.dateFormat,
        number_format: preferences.display?.numberFormat ?? current.display.numberFormat,
        profile_visibility:
          preferences.privacy?.profileVisibility ?? current.privacy.profileVisibility,
        analytics_enabled:
          preferences.privacy?.dataSharing?.analytics ?? current.privacy.dataSharing.analytics,
        third_party_integrations_enabled:
          preferences.privacy?.dataSharing?.thirdPartyIntegrations ??
          current.privacy.dataSharing.thirdPartyIntegrations,
        market_research_enabled:
          preferences.privacy?.dataSharing?.marketResearch ??
          current.privacy.dataSharing.marketResearch,
        activity_tracking_enabled:
          preferences.privacy?.activityTracking ?? current.privacy.activityTracking,
      };

      let rows;
      if (current.id) {
        // Update existing preferences
        rows = await tx.sql`
          UPDATE user_preferences
          SET email_notifications_enabled = ${updated.email_notifications_enabled},
              email_payment_alerts = ${updated.email_payment_alerts},
              email_system_notifications = ${updated.email_system_notifications},
              push_notifications_enabled = ${updated.push_notifications_enabled},
              push_payment_alerts = ${updated.push_payment_alerts},
              push_system_notifications = ${updated.push_system_notifications},
              sms_notifications_enabled = ${updated.sms_notifications_enabled},
              sms_payment_alerts = ${updated.sms_payment_alerts},
              sms_system_notifications = ${updated.sms_system_notifications},
              theme = ${updated.theme},
              language = ${updated.language},
              currency = ${updated.currency},
              timezone = ${updated.timezone},
              date_format = ${updated.date_format},
              number_format = ${updated.number_format},
              profile_visibility = ${updated.profile_visibility},
              analytics_enabled = ${updated.analytics_enabled},
              third_party_integrations_enabled = ${updated.third_party_integrations_enabled},
              market_research_enabled = ${updated.market_research_enabled},
              activity_tracking_enabled = ${updated.activity_tracking_enabled},
              updated_date = ${updateDate}
          WHERE user_id = ${userId}
          RETURNING id, user_id, updated_date
        `;
      } else {
        // Insert new preferences
        rows = await tx.sql`
          INSERT INTO user_preferences (
            user_id,
            email_notifications_enabled, email_payment_alerts, email_system_notifications,
            push_notifications_enabled, push_payment_alerts, push_system_notifications,
            sms_notifications_enabled, sms_payment_alerts, sms_system_notifications,
            theme, language, currency, timezone, date_format, number_format,
            profile_visibility, analytics_enabled, third_party_integrations_enabled, market_research_enabled, activity_tracking_enabled,
            created_date, updated_date
          )
          VALUES (
            ${userId},
            ${updated.email_notifications_enabled}, ${updated.email_payment_alerts}, ${updated.email_system_notifications},
            ${updated.push_notifications_enabled}, ${updated.push_payment_alerts}, ${updated.push_system_notifications},
            ${updated.sms_notifications_enabled}, ${updated.sms_payment_alerts}, ${updated.sms_system_notifications},
            ${updated.theme}, ${updated.language}, ${updated.currency}, ${updated.timezone}, ${updated.date_format}, ${updated.number_format},
            ${updated.profile_visibility}, ${updated.analytics_enabled}, ${updated.third_party_integrations_enabled}, ${updated.market_research_enabled}, ${updated.activity_tracking_enabled},
            ${updateDate}, ${updateDate}
          )
          RETURNING id, user_id, updated_date
        `;
      }

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Failed to update user preferences');
      }

      const result = rows[0];
      assertDefined(result);
      assertPropStringOrNumber(result, 'id');
      assertPropStringOrNumber(result, 'user_id');
      assertPropDate(result, 'updated_date');

      await tx.commitTransaction();

      return {
        id: String(result.id),
        userId: String(result.user_id),
        updatedAt: result.updated_date,
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }
}
