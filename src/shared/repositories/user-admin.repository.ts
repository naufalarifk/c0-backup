import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

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
} from './user.types';
import { UserUserRepository } from './user-user.repository';

export abstract class UserAdminRepository extends UserUserRepository {
  async adminApprovesKyc(params: AdminApprovesKycParams): Promise<AdminApprovesKycResult> {
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
      assertProp(check(isString, isNumber), kyc, 'id');
      assertProp(check(isString, isNumber), kyc, 'user_id');
      assertProp(isInstanceOf(Date), kyc, 'verified_date');

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
      assertProp(check(isString, isNumber), kyc, 'id');
      assertProp(check(isString, isNumber), kyc, 'user_id');
      assertProp(isInstanceOf(Date), kyc, 'rejected_date');

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
        assertProp(check(isString, isNumber), kyc, 'id');
        assertProp(check(isString, isNumber), kyc, 'user_id');
        assertPropString(kyc, 'name');
        assertPropString(kyc, 'nik');
        assertProp(isInstanceOf(Date), kyc, 'submitted_date');
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
      assertProp(check(isString, isNumber), application, 'id');
      assertProp(check(isString, isNumber), application, 'applicant_user_id');
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
      assertProp(check(isString, isNumber), application, 'id');
      assertProp(isInstanceOf(Date), application, 'rejected_date');

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

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Failed to add user to institution');
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'institution_user_id');
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

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Failed to remove user from institution');
        assertProp(check(isString, isNumber), row, 'id');
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
    assertProp(check(isString, isNumber), user, 'kyc_id');

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
        assertProp(check(isNullable, isString, isNumber), notification, 'user_kyc_id');
        assertProp(
          check(isNullable, isString, isNumber),
          notification,
          'institution_application_id',
        );
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
}
