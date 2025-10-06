import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isBoolean,
  isInstanceOf,
  isNullable,
  isString,
  setPropValue,
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
      const rows = await tx.sql`
        UPDATE user_kycs
        SET verifier_user_id = ${params.verifierUserId},
            verified_date = ${params.approvalDate}
        WHERE id = ${params.kycId} AND verified_date IS NULL AND rejected_date IS NULL
        RETURNING id::text AS id, user_id::text AS "userId", verified_date AS "verifiedDate";
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('KYC approval failed');
      }

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'KYC not found or already processed');
        assertPropString(row, 'id');
        assertPropString(row, 'userId');
        assertProp(isInstanceOf(Date), row, 'verifiedDate');
        return row;
      });

      await tx.commitTransaction();
      return rows[0];
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminRejectsKyc(params: AdminRejectsKycParams): Promise<AdminRejectsKycResult> {
    const tx = await this.beginTransaction();
    try {
      const rows = await tx.sql`
        UPDATE user_kycs
        SET verifier_user_id = ${params.verifierUserId},
            rejected_date = ${params.rejectionDate},
            rejection_reason = ${params.rejectionReason}
        WHERE id = ${params.kycId} AND verified_date IS NULL AND rejected_date IS NULL
        RETURNING id::text AS id, user_id::text AS "userId", rejected_date AS "rejectedDate";
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('KYC not found or already processed');
      }

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'KYC not found or already processed');
        assertPropString(row, 'id');
        assertPropString(row, 'userId');
        assertProp(isInstanceOf(Date), row, 'rejectedDate');
        return row;
      });

      await tx.commitTransaction();
      return rows[0];
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminViewsPendingKYCs(): Promise<AdminViewPendingKycsResult> {
    const kycs = await this.sql`
      SELECT id::text AS id, user_id::text AS "userId", name, nik, submitted_date AS "submittedDate"
      FROM user_kycs
      WHERE verified_date IS NULL AND rejected_date IS NULL
      ORDER BY submitted_date ASC
    `;

    assertArrayMapOf(kycs, function (row) {
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'userId');
      assertPropString(row, 'name');
      assertPropString(row, 'nik');
      assertProp(isInstanceOf(Date), row, 'submittedDate');
      return row;
    });

    return { kycs };
  }

  async adminApprovesInstitutionApplication(
    params: AdminApprovesInstitutionApplicationParams,
  ): Promise<AdminApprovesInstitutionApplicationResult> {
    const tx = await this.beginTransaction();
    try {
      const rows = await tx.sql`
        SELECT id::text AS "applicationId", applicant_user_id::text AS "institutionId"
        FROM institution_applications
        WHERE id = ${params.applicationId} AND verified_date IS NULL AND rejected_date IS NULL
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Application not found or already processed');
      }

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Application not found or already processed');
        assertPropString(row, 'applicationId');
        assertPropString(row, 'institutionId');
        return row;
      });

      await tx.sql`
        UPDATE institution_applications
        SET reviewer_user_id = ${params.reviewerUserId}, verified_date = ${params.approvalDate}
        WHERE id = ${params.applicationId}
      `;

      await tx.commitTransaction();
      return rows[0];
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
      const rows = await tx.sql`
        UPDATE institution_applications
        SET reviewer_user_id = ${params.reviewerUserId},
            rejected_date = ${params.rejectionDate},
            rejection_reason = ${params.rejectionReason}
        WHERE id = ${params.applicationId} AND verified_date IS NULL AND rejected_date IS NULL
        RETURNING id::text AS id, rejected_date AS "rejectedDate";
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Application rejection failed');
      }

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Application not found or already processed');
        assertPropString(row, 'id');
        assertProp(isInstanceOf(Date), row, 'rejectedDate');
        return row;
      });

      await tx.commitTransaction();
      return rows[0];
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminAddUserToInstitution(
    params: AdminAddUserToInstitutionParams,
  ): Promise<AdminAddUserToInstitutionResult> {
    const tx = await this.beginTransaction();
    try {
      const rows = await tx.sql`
        UPDATE users
        SET institution_user_id = ${params.institutionId}, institution_role = ${params.role}
        WHERE id = ${params.userId}
        RETURNING id::text AS "userId", institution_user_id::text AS "institutionId", institution_role AS role;
      `;

      if (rows.length === 0) {
        await tx.rollbackTransaction();
        throw new Error('Failed to add user to institution');
      }

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Failed to add user to institution');
        assertPropString(row, 'userId');
        assertPropString(row, 'institutionId');
        assertPropString(row, 'role');
        return row;
      });

      await tx.commitTransaction();
      return rows[0];
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
      const rows = await tx.sql`
        UPDATE users
        SET institution_user_id = NULL, institution_role = NULL
        WHERE id = ${params.userId}
        RETURNING id::text AS "userId", true AS removed;
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Failed to remove user from institution');
        assertPropString(row, 'userId');
        assertProp(isBoolean, row, 'removed');
        return row;
      });

      if (rows.length === 0) {
        await tx.commitTransaction();
        return { userId: params.userId, removed: false };
      }

      await tx.commitTransaction();
      return rows[0];
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminChecksUserKycId(
    params: AdminChecksUserKycIdParams,
  ): Promise<AdminChecksUserKycIdResult> {
    const rows = await this.sql`
      SELECT id::text AS "userId", kyc_id::text AS "kycId" FROM users WHERE id = ${params.userId}
    `;

    if (rows.length === 0) {
      throw new Error('User not found');
    }

    assertArrayMapOf(rows, function (row) {
      assertDefined(row, 'User not found');
      assertPropString(row, 'userId');
      assertProp(check(isNullable, isString), row, 'kycId');
      setPropValue(row, 'kycId', row.kycId ?? null);
      return row;
    });

    return rows[0];
  }

  async adminChecksUserInstitutionData(
    params: AdminChecksUserInstitutionDataParams,
  ): Promise<AdminChecksUserInstitutionDataResult> {
    const rows = await this.sql`
      SELECT id::text AS "userId", institution_user_id::text AS "institutionUserId", institution_role AS "institutionRole"
      FROM users WHERE id = ${params.userId}
    `;

    if (rows.length === 0) {
      throw new Error('User not found');
    }

    assertArrayMapOf(rows, function (row) {
      assertDefined(row, 'User not found');
      assertPropString(row, 'userId');
      assertProp(check(isNullable, isString), row, 'institutionUserId');
      assertProp(check(isNullable, isString), row, 'institutionRole');
      setPropValue(row, 'institutionUserId', row.institutionUserId ?? null);
      setPropValue(row, 'institutionRole', row.institutionRole ?? null);
      return row;
    });

    return rows[0];
  }

  async adminViewsNotificationsByType(
    params: AdminViewsNotificationsByTypeParams,
  ): Promise<AdminViewsNotificationsByTypeResult> {
    const rows = await this.sql`
      SELECT type, title, content, user_kyc_id::text AS "userKycId", institution_application_id::text AS "institutionApplicationId"
      FROM notifications
      WHERE user_id = ${params.userId} AND type = ${params.type}
    `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row);
      assertPropString(row, 'type');
      assertPropString(row, 'title');
      assertPropString(row, 'content');
      assertProp(check(isNullable, isString), row, 'userKycId');
      assertProp(check(isNullable, isString), row, 'institutionApplicationId');
      setPropValue(row, 'userKycId', row.userKycId ?? undefined);
      setPropValue(row, 'institutionApplicationId', row.institutionApplicationId ?? undefined);
      return row;
    });

    return { notifications: rows };
  }
}
