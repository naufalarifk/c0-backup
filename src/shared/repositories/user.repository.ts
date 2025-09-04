/** biome-ignore-all lint/suspicious/noExplicitAny: any */
/** biome-ignore-all lint/correctness/noUnusedVariables: any */

import { CleanedWhere } from 'better-auth/adapters';
import { v7 } from 'uuid';

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
  OwnerUserInvitesUserToInstitutionParams,
  OwnerUserInvitesUserToInstitutionResult,
  SystemCreatesInstitutionApplicationWithValidationParams,
  SystemCreatesInstitutionApplicationWithValidationResult,
  UserAcceptsInstitutionInvitationParams,
  UserAcceptsInstitutionInvitationResult,
  UserAppliesForInstitutionParams,
  UserAppliesForInstitutionResult,
  UserDecidesUserTypeParams,
  UserRejectsInstitutionInvitationParams,
  UserRejectsInstitutionInvitationResult,
  UserSubmitsKYCResult,
  UserSubmitsKycParams,
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
  isDefined,
  setAssertPropValue,
} from '../utils/assertions';
import { BaseRepository } from './base.repository';

/**
 * UserRepository <- BaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as encryption, hashing, TOTP verification, etc.
 * should be handled by services that use this repository.
 */
export abstract class UserRepository extends BaseRepository {
  async betterAuthCreateUser(data: any): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      const {
        name,
        email,
        email_address,
        emailVerified = false,
        createdAt,
        updatedAt,
        id,
        image,
        callbackURL,
      } = data;

      if (id) {
        console.warn('Creating user with specific ID is not supported.', id);
      }

      // Handle field mapping: email_address maps to email column
      const emailValue = email_address || email;

      // Convert Dates to UTC milliseconds for database storage
      const createdAtUtc = new Date(createdAt ?? Date.now());
      const updatedAtUtc = new Date(updatedAt ?? Date.now());

      const rows = await tx.sql`
        INSERT INTO users (name, profile_picture, email, created_date, updated_date)
        VALUES (${name}, ${image}, ${emailValue}, ${createdAtUtc}, ${updatedAtUtc})
        RETURNING id, name, profile_picture as "image", email, created_date as "createdAt", updated_date as "updatedAt";
      `;

      const user = rows[0];
      assertDefined(user);
      assertPropString(user, 'email');
      assertPropNullableStringOrNumber(user, 'image');

      // If original data had email_address, return it as email_address in response
      if (email_address) {
        setAssertPropValue(user, 'email_address', user.email);
      }
      if (callbackURL) {
        setAssertPropValue(user, 'callbackURL', callbackURL);
      }

      await tx.commitTransaction();

      return user;
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthFindOneUser(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    const idCondition = where.find(w => w.field === 'id');
    const emailCondition = where.find(w => w.field === 'email' || w.field === 'email_address');

    let rows: Array<unknown> = [];
    if (idCondition) {
      rows = await this.sql`
        SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
               created_date as "createdAt", updated_date as "updatedAt"
        FROM users
        WHERE id = ${idCondition.value}
      `;
    } else if (emailCondition) {
      rows = await this.sql`
        SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
               created_date as "createdAt", updated_date as "updatedAt"
        FROM users
        WHERE email = ${emailCondition.value}
      `;
    } else {
      return null;
    }

    assertArrayOf(rows, function (row) {
      assertDefined(row);
      return row;
    });

    if (rows.length > 0) {
      const user = rows[0];
      assertDefined(user);
      // Add email_address field if original query used email_address
      if (where.some(w => w.field === 'email_address')) {
        if ('email' in user) {
          setAssertPropValue(user, 'email_address', user.email);
        }
      }
      if ('emailVerifiedDate' in user) {
        setAssertPropValue(user, 'emailVerified', !!user.emailVerifiedDate);
      }
      return user;
    }
    return null;
  }

  async betterAuthFindManyUsers(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    const hasEmailAddressField = where && where.some(w => w.field === 'email_address');

    let users: Array<unknown> = [];
    if (!where || where.length === 0) {
      users = await this.sql`
        SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
               created_date as "createdAt", updated_date as "updatedAt"
        FROM users
        ORDER BY created_date DESC
        LIMIT ${limit || 100}
        OFFSET ${offset || 0}
      `;
    } else {
      const idCondition = where.find(w => w.field === 'id');
      const emailCondition = where.find(w => w.field === 'email' || w.field === 'email_address');
      const nameCondition = where.find(w => w.field === 'name');

      if (idCondition && idCondition.operator === 'in') {
        const ids = idCondition.value;
        users = await this.sql`
          SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                 created_date as "createdAt", updated_date as "updatedAt"
          FROM users
          WHERE id = ANY(${ids})
          ORDER BY created_date DESC
          LIMIT ${limit || 100}
          OFFSET ${offset || 0}
        `;
      } else if (emailCondition) {
        if (emailCondition.operator === 'contains') {
          const searchTerm = `%${emailCondition.value}%`;
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                   created_date as "createdAt", updated_date as "updatedAt"
            FROM users
            WHERE email LIKE ${searchTerm}
            ORDER BY created_date DESC
            LIMIT ${limit || 100}
            OFFSET ${offset || 0}
          `;
        } else {
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                   created_date as "createdAt", updated_date as "updatedAt"
            FROM users
            WHERE email = ${emailCondition.value}
            ORDER BY created_date DESC
            LIMIT ${limit || 100}
            OFFSET ${offset || 0}
          `;
        }
      } else if (nameCondition) {
        if (nameCondition.operator === 'contains') {
          const searchTerm = `%${nameCondition.value}%`;
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                   created_date as "createdAt", updated_date as "updatedAt"
            FROM users
            WHERE name LIKE ${searchTerm}
            ORDER BY created_date DESC
            LIMIT ${limit || 100}
            OFFSET ${offset || 0}
          `;
        } else {
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                   created_date as "createdAt", updated_date as "updatedAt"
            FROM users
            WHERE name = ${nameCondition.value}
            ORDER BY created_date DESC
            LIMIT ${limit || 100}
            OFFSET ${offset || 0}
          `;
        }
      } else {
        users = await this.sql`
          SELECT id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                 created_date as "createdAt", updated_date as "updatedAt"
          FROM users
          ORDER BY created_date DESC
          LIMIT ${limit || 100}
          OFFSET ${offset || 0}
        `;
      }
    }

    // Add email_address field if original query used email_address
    if (hasEmailAddressField) {
      users.forEach(function (user) {
        assertDefined(user);
        assertPropDefined(user, 'email');
        setAssertPropValue(user, 'email_address', user.email);
        setAssertPropValue(
          user,
          'emailVerified',
          'emailVerifiedDate' in user && !!user.emailVerifiedDate,
        );
      });
    }

    return users;
  }

  async betterAuthUpdateUser(where: CleanedWhere[], update: any): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      if (!Array.isArray(where) || where.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const { name, email, emailVerified, createdAt, updatedAt, image } = update;

      // Convert Dates to UTC milliseconds for database storage if they exist
      const createdAtUtc = createdAt ? new Date(createdAt ?? Date.now()) : new Date();
      const updatedAtUtc = updatedAt ? new Date(updatedAt ?? Date.now()) : new Date();

      const rows = await tx.sql`
        UPDATE users
        SET name = COALESCE(${name}, name),
            email = COALESCE(${email}, email),
            email_verified_date = CASE
              WHEN ${emailVerified ? 1 : 0} = 1 AND email_verified_date IS NULL THEN ${updatedAtUtc}
              WHEN ${emailVerified ? 1 : 0} = 0 THEN NULL
              ELSE email_verified_date
            END,
            profile_picture = COALESCE(${image}, profile_picture),
            created_date = COALESCE(${createdAtUtc}, created_date),
            updated_date = COALESCE(${updatedAtUtc}, updated_date)
        WHERE id = ${where.find(w => w.field === 'id')?.value}
        RETURNING id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                 created_date as "createdAt", updated_date as "updatedAt"
      `;

      assertArrayOf(rows, function (row) {
        assertDefined(row);
        setAssertPropValue(
          row,
          'emailVerified',
          'emailVerifiedDate' in row && !!row.emailVerifiedDate,
        );
        return row;
      });

      const row = rows.length > 0 ? rows[0] : null;

      await tx.commitTransaction();

      return row;
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthUpdateManyUsers(where: any[], update: any): Promise<any[]> {
    const tx = await this.beginTransaction();
    try {
      if (!Array.isArray(where) || where.length === 0) {
        await tx.rollbackTransaction();
        return [];
      }

      const { name, email, emailVerified, createdAt, updatedAt, image } = update;

      // Convert Dates to UTC milliseconds for database storage if they exist
      const createdAtUtc = createdAt ? new Date(createdAt ?? Date.now()) : null;
      const updatedAtUtc = updatedAt ? new Date(updatedAt ?? Date.now()) : null;

      // For multiple users, we need to handle where conditions properly
      const idCondition = where.find(w => w.field === 'id');
      if (idCondition) {
        const rows = await tx.sql`
          UPDATE users
          SET name = COALESCE(${name}, name),
              email = COALESCE(${email}, email),
              profile_picture = COALESCE(${image}, profile_picture),
              email_verified_date = CASE
                WHEN ${emailVerified ? 1 : 0} = 1 AND email_verified_date IS NULL THEN ${updatedAtUtc}
                WHEN ${emailVerified ? 1 : 0} = 0 THEN NULL
                ELSE email_verified_date
              END,
              created_date = COALESCE(${createdAtUtc}, created_date),
              updated_date = COALESCE(${updatedAtUtc}, updated_date)
          WHERE id = ${idCondition.value}
          RETURNING id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                   created_date as "createdAt", updated_date as "updatedAt"
        `;
        await tx.commitTransaction();
        assertArrayOf(rows, function (row) {
          assertDefined(row);
          setAssertPropValue(
            row,
            'emailVerified',
            'emailVerifiedDate' in row && !!row.emailVerifiedDate,
          );
          return row;
        });
        return rows;
      }

      await tx.commitTransaction();
      return [];
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteUser(where: any[]): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      if (!Array.isArray(where) || where.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const idCondition = where.find(w => w.field === 'id');
      if (idCondition) {
        const rows = await tx.sql`
          DELETE FROM users
          WHERE id = ${idCondition.value}
          RETURNING id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                   created_date as "createdAt", updated_date as "updatedAt"
        `;

        const row = rows.length > 0 ? rows[0] : null;
        assertDefined(row);
        setAssertPropValue(
          row,
          'emailVerified',
          'emailVerifiedDate' in row && !!row.emailVerifiedDate,
        );

        await tx.commitTransaction();
        return row;
      }

      await tx.commitTransaction();
      return null;
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteManyUsers(where: any[]): Promise<any[]> {
    const tx = await this.beginTransaction();
    try {
      if (!Array.isArray(where) || where.length === 0) {
        await tx.rollbackTransaction();
        return [];
      }

      const idCondition = where.find(w => w.field === 'id');
      if (idCondition) {
        const rows = await tx.sql`
          DELETE FROM users
          WHERE id = ${idCondition.value}
          RETURNING id, name, profile_picture as "image", email, email_verified_date as "emailVerifiedDate",
                   created_date as "createdAt", updated_date as "updatedAt"
        `;
        await tx.commitTransaction();
        assertArrayOf(rows, function (row) {
          assertDefined(row);
          setAssertPropValue(
            row,
            'emailVerified',
            'emailVerifiedDate' in row && !!row.emailVerifiedDate,
          );
          return row;
        });
        return rows;
      }

      await tx.commitTransaction();
      return [];
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Session methods for better-auth (using Redis)
  async betterAuthCreateSession(data: any): Promise<any> {
    const { token, userId, expiresAt, createdAt = new Date(), updatedAt = new Date(), id } = data;

    const sessionId = id || v7();

    const session = {
      id: String(sessionId),
      token,
      userId,
      expiresAt,
      createdAt,
      updatedAt,
    };

    // Store session in Redis with TTL based on expiration
    const ttl = expiresAt
      ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      : undefined;
    await this.set(`session:token:${token}`, sessionId, ttl);
    await this.set(`session:userId:${userId}`, sessionId, ttl);
    await this.set(`session:${sessionId}`, session, ttl);

    return session;
  }

  async betterAuthFindOneSession(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Handle different search criteria
    for (const condition of where) {
      if (condition.field === 'token') {
        // Find session by token
        const sessionId = await this.get(`session:token:${condition.value}`);
        if (sessionId) {
          const session = await this.get(`session:${sessionId}`);
          if (session) {
            return session;
          }
        }
      } else if (condition.field === 'id') {
        // Find session by ID
        const session = await this.get(`session:${condition.value}`);
        if (session) {
          return session;
        }
      } else if (condition.field === 'userId') {
        // Find session by userId
        const sessionId = await this.get(`session:userId:${condition.value}`);
        if (sessionId) {
          const session = await this.get(`session:${sessionId}`);
          if (session) {
            return session;
          }
        }
      }
    }

    return null;
  }

  async betterAuthUpdateSession(where: any[], update: any): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Find the session first
    const session = await this.betterAuthFindOneSession(where);
    if (!session) {
      return null;
    }

    // Update the session data
    const updatedSession = { ...session, ...update, updatedAt: new Date() };

    // Calculate new TTL if expiresAt changed
    const ttl = updatedSession.expiresAt
      ? Math.floor((new Date(updatedSession.expiresAt).getTime() - Date.now()) / 1000)
      : undefined;

    // Update in Redis
    await this.set(`session:${session.id}`, updatedSession, ttl);
    if (session.token) {
      await this.set(`session:token:${session.token}`, session.id, ttl);
    }

    return updatedSession;
  }

  async betterAuthDeleteSession(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Find the session first
    const session = await this.betterAuthFindOneSession(where);
    if (!session) {
      return null;
    }

    // Delete from Redis
    await this.del(`session:${session.id}`);
    if (session.token) {
      await this.del(`session:token:${session.token}`);
    }

    return session;
  }

  async betterAuthDeleteManySession(where: any[]): Promise<any[]> {
    // For simplicity, this implementation finds and deletes sessions one by one
    // In a production environment, you might want to use Redis patterns or maintain indexes
    const session = await this.betterAuthFindOneSession(where);
    if (session) {
      await this.betterAuthDeleteSession(where);
      return [session];
    }
    return [];
  }

  // Account methods for better-auth (stored in auth_providers table)
  async betterAuthCreateAccount(data: any): Promise<any> {
    const {
      id,
      userId,
      accountId,
      providerId,
      accessToken,
      refreshToken,
      expiresAt,
      password,
      createdAt,
      updatedAt,
    } = data;

    const accountRecordId = id || v7();

    const createdDate = new Date(createdAt);
    const updatedDate = new Date(updatedAt);
    const accessTokenExpiresDate = expiresAt ? new Date(expiresAt) : null;

    const rows = await this.sql`
      INSERT INTO auth_providers (
        id, account_id, provider_id, user_id, access_token, refresh_token, password,
        access_token_expires_date, created_date, updated_date
      ) VALUES (
        ${String(accountRecordId)}, ${accountId}, ${providerId}, ${userId}, ${accessToken}, ${refreshToken}, ${password},
        ${accessTokenExpiresDate}, ${createdDate}, ${updatedDate}
      ) RETURNING id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date;
    `;

    const row = rows[0];
    if (!row) return null;

    assertDefined(row);
    assertPropStringOrNumber(row, 'id');
    assertPropStringOrNumber(row, 'user_id');
    assertPropStringOrNumber(row, 'account_id');
    assertPropStringOrNumber(row, 'provider_id');
    assertPropNullableString(row, 'access_token');
    assertPropNullableString(row, 'refresh_token');
    assertPropNullableString(row, 'password');

    return {
      id: String(row.id),
      userId: row.user_id ? String(row.user_id) : undefined,
      accountId: row.account_id,
      providerId: row.provider_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt:
        'access_token_expires_date' in row && row.access_token_expires_date instanceof Date
          ? row.access_token_expires_date
          : undefined,
      password: row.password,
      createdAt:
        'created_date' in row && row.created_date instanceof Date ? row.created_date : undefined,
      updatedAt:
        'updated_date' in row && row.updated_date instanceof Date ? row.updated_date : undefined,
    };
  }

  async betterAuthFindOneAccount(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) return null;

    const userId = where.find(w => w.field === 'userId')?.value;
    const providerId = where.find(w => w.field === 'providerId')?.value;
    const accountId = where.find(w => w.field === 'accountId')?.value;
    const idField = where.find(w => w.field === 'id')?.value;

    const mapRowToAccount = function (row: unknown) {
      assertDefined(row);
      assertPropStringOrNumber(row, 'id');
      assertPropStringOrNumber(row, 'user_id');
      assertPropStringOrNumber(row, 'account_id');
      assertPropStringOrNumber(row, 'provider_id');
      assertPropNullableString(row, 'access_token');
      assertPropNullableString(row, 'refresh_token');
      assertPropNullableString(row, 'password');
      return {
        id: String(row.id),
        userId: row.user_id ? String(row.user_id) : undefined,
        accountId: row.account_id,
        providerId: row.provider_id,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt:
          'access_token_expires_date' in row && row.access_token_expires_date instanceof Date
            ? row.access_token_expires_date.toISOString()
            : undefined,
        password: row.password,
        createdAt:
          'created_date' in row && row.created_date instanceof Date
            ? row.created_date.toISOString()
            : undefined,
        updatedAt:
          'updated_date' in row && row.updated_date instanceof Date
            ? row.updated_date.toISOString()
            : undefined,
      };
    };

    if (idField) {
      const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE id = ${String(idField)} LIMIT 1
      `;
      const row = rows[0];
      if (row) return mapRowToAccount(row);
    }

    if (accountId && providerId) {
      const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE account_id = ${accountId} AND provider_id = ${providerId} LIMIT 1
      `;
      const row = rows[0];
      if (row) return mapRowToAccount(row);
    }

    if (userId && providerId) {
      const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE user_id = ${userId} AND provider_id = ${providerId} LIMIT 1
      `;
      const row = rows[0];
      if (row) return mapRowToAccount(row);
    }

    if (userId && !providerId) {
      const rows = await this.sql`
        SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
        FROM auth_providers WHERE user_id = ${userId} AND provider_id = 'credential' LIMIT 1
      `;
      let row = rows[0];
      if (!row) {
        const rows = await this.sql`
          SELECT id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date
          FROM auth_providers WHERE user_id = ${userId} LIMIT 1
        `;
        row = rows[0];
      }
      if (row) return mapRowToAccount(row);
    }

    return null;
  }

  async betterAuthFindManyAccounts(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    if (!where || where.length === 0) return [];

    const account = await this.betterAuthFindOneAccount(where);
    return account ? [account] : [];
  }

  async betterAuthUpdateAccount(where: any[], update: any): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) return null;
    const account = await this.betterAuthFindOneAccount(where);
    if (!account) return null;

    const { accountId, providerId, userId, accessToken, refreshToken, expiresAt, password } =
      update;

    const updatedAt = new Date();
    const updatedAtUtc = updatedAt;
    const accessTokenExpiresUtc = expiresAt ? new Date(expiresAt) : null;

    const rows = await this.sql`
      UPDATE auth_providers SET
        account_id = COALESCE(${accountId}, account_id),
        provider_id = COALESCE(${providerId}, provider_id),
        user_id = COALESCE(${userId}, user_id),
        access_token = COALESCE(${accessToken}, access_token),
        refresh_token = COALESCE(${refreshToken}, refresh_token),
        password = COALESCE(${password}, password),
        access_token_expires_date = COALESCE(${accessTokenExpiresUtc}, access_token_expires_date),
        updated_date = ${updatedAtUtc}
      WHERE id = ${account.id}
      RETURNING id, account_id, provider_id, user_id, access_token, refresh_token, password, access_token_expires_date, created_date, updated_date;
    `;

    const row = rows[0];
    if (!row) return null;

    assertDefined(row);
    assertPropStringOrNumber(row, 'id');
    assertPropStringOrNumber(row, 'user_id');
    assertPropStringOrNumber(row, 'account_id');
    assertPropStringOrNumber(row, 'provider_id');
    assertPropNullableString(row, 'access_token');
    assertPropNullableString(row, 'refresh_token');
    assertPropNullableString(row, 'password');

    return {
      id: String(row.id),
      userId: row.user_id ? String(row.user_id) : undefined,
      accountId: row.account_id,
      providerId: row.provider_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt:
        'access_token_expires_date' in row && row.access_token_expires_date instanceof Date
          ? row.access_token_expires_date
          : undefined,
      password: row.password,
      createdAt:
        'created_date' in row && row.created_date instanceof Date ? row.created_date : undefined,
      updatedAt:
        'updated_date' in row && row.updated_date instanceof Date ? row.updated_date : undefined,
    };
  }

  async betterAuthUpdateManyAccounts(where: any[], update: any): Promise<any[]> {
    const account = await this.betterAuthUpdateAccount(where, update);
    return account ? [account] : [];
  }

  async betterAuthDeleteAccount(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) return null;
    const account = await this.betterAuthFindOneAccount(where);
    if (!account) return null;

    await this.sql`DELETE FROM auth_providers WHERE id = ${account.id}`;
    return account;
  }

  async betterAuthDeleteManyAccounts(where: any[]): Promise<any[]> {
    const account = await this.betterAuthDeleteAccount(where);
    return account ? [account] : [];
  }

  async betterAuthCreateVerification(data: any): Promise<any> {
    const {
      id,
      identifier,
      value,
      expiresAt,
      createdAt = new Date(),
      updatedAt = new Date(),
    } = data;

    const verificationId = id || v7();

    const verification = {
      id: verificationId,
      identifier,
      value,
      expiresAt,
      createdAt,
      updatedAt,
    };

    // Store verification in Redis with TTL based on expiration
    const ttl = expiresAt ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000) : 3600; // Default 1 hour if no expiration

    await this.set(`verification:${verificationId}`, verification, ttl);

    // Also store a direct mapping from token value -> verification id so we can
    // efficiently lookup verifications by token value (Better Auth sometimes
    // queries by value).
    if (value) {
      await this.set(`verification:value:${value}`, verificationId, ttl);
    }

    // For multiple verifications per identifier, store in a list
    const listKey = `verification:list:${identifier}`;
    const existingList = ((await this.get(listKey)) as Array<any>) || [];
    existingList.push(verificationId);
    await this.set(listKey, existingList, ttl);

    return verification;
  }

  async betterAuthFindOneVerification(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Handle different search criteria
    for (const condition of where) {
      if (condition.field === 'identifier') {
        // Find verification by identifier - return the most recent one
        const listKey = `verification:list:${condition.value}`;
        const verificationIds = ((await this.get(listKey)) as Array<any>) || [];

        // Get all verifications and sort by createdAt desc
        const verifications: any[] = [];
        for (const verificationId of verificationIds) {
          const verification = await this.get(`verification:${verificationId}`);
          if (verification) {
            verifications.push(verification);
          }
        }

        if (verifications.length > 0) {
          // Sort by createdAt desc and return the most recent
          verifications.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          return verifications[0];
        }
      } else if (condition.field === 'id') {
        // Find verification by ID
        const verification = await this.get(`verification:${condition.value}`);
        if (verification) {
          return verification;
        }
      } else if (condition.field === 'value' || condition.field === 'token') {
        // Better Auth sometimes queries verifications by the token value itself.
        // Support lookup by value -> id mapping stored at verification:value:{value}
        const mappedId = await this.get(`verification:value:${condition.value}`);
        if (mappedId) {
          const verification = await this.get(`verification:${String(mappedId)}`);
          if (verification) return verification;
        }
        // Fallback: try direct key by value (in case some implementations store the
        // token under a value key)
        const direct = await this.get(`verification:value:${condition.value}`);
        if (direct && typeof direct === 'object') return direct;
      }
    }

    return null;
  }

  async betterAuthFindManyVerifications(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    if (!where || where.length === 0) {
      return [];
    }

    // Find by identifier and return array
    const identifier = where.find(w => w.field === 'identifier')?.value;
    if (identifier) {
      const listKey = `verification:list:${identifier}`;
      const verificationIds = ((await this.get(listKey)) as Array<any>) || [];

      const verifications: any[] = [];
      for (const verificationId of verificationIds) {
        const verification = await this.get(`verification:${verificationId}`);
        if (verification) {
          verifications.push(verification);
        }
      }

      // Sort by createdAt desc if specified
      if (sortBy?.field === 'createdAt' && sortBy?.direction === 'desc') {
        verifications.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }

      // Apply limit
      if (limit && limit > 0) {
        return verifications.slice(0, limit);
      }

      return verifications;
    }

    return [];
  }

  async betterAuthUpdateVerification(where: any[], update: any): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Find the verification first
    const verification = await this.betterAuthFindOneVerification(where);
    if (!verification) {
      return null;
    }

    // Update the verification data
    const updatedVerification = { ...verification, ...update, updatedAt: new Date() };

    // Calculate new TTL if expiresAt changed
    const ttl = updatedVerification.expiresAt
      ? Math.floor((new Date(updatedVerification.expiresAt).getTime() - Date.now()) / 1000)
      : 3600;

    // Update in Redis
    await this.set(`verification:${verification.id}`, updatedVerification, ttl);
    if (verification.identifier) {
      await this.set(
        `verification:list:${verification.identifier}`,
        (await this.get(`verification:list:${verification.identifier}`)) as any[],
      );
    }

    // If the value (token) changed, update the value -> id mapping
    if (verification.value && verification.value !== updatedVerification.value) {
      await this.del(`verification:value:${verification.value}`);
    }
    if (updatedVerification.value) {
      await this.set(`verification:value:${updatedVerification.value}`, verification.id, ttl);
    }

    return updatedVerification;
  }

  async betterAuthDeleteVerification(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Find the verification first
    const verification = await this.betterAuthFindOneVerification(where);
    if (!verification) {
      return null;
    }

    // Delete from Redis
    await this.del(`verification:${verification.id}`);

    // Remove from the list if identifier exists
    if (verification.identifier) {
      const listKey = `verification:list:${verification.identifier}`;
      const verificationIds = ((await this.get(listKey)) as Array<any>) || [];
      const updatedIds = verificationIds.filter((id: string) => id !== verification.id);

      if (updatedIds.length > 0) {
        await this.set(listKey, updatedIds);
      } else {
        await this.del(listKey);
      }
    }

    // Remove value -> id mapping if exists
    if (verification.value) {
      await this.del(`verification:value:${verification.value}`);
    }

    return verification;
  }

  async betterAuthDeleteManyVerifications(where: any[]): Promise<any[]> {
    if (!Array.isArray(where) || where.length === 0) {
      return [];
    }

    // Handle lt operator for cleanup
    const expiresAtCondition = where.find(w => w.field === 'expiresAt' && w.operator === 'lt');
    if (expiresAtCondition) {
      // For cleanup, we need to scan all verification keys and check expiration
      // This is a simplified implementation - in production you might want better indexing
      const deletedVerifications: any[] = [];

      // Get all verification keys (this is not efficient for large datasets)
      // In a real implementation, you'd maintain a separate index for expiration times
      const _currentTime = new Date(expiresAtCondition.value);

      // Since Redis automatically expires keys, we can rely on natural expiration
      // or implement a background cleanup job. For now, return empty array.
      return deletedVerifications;
    }

    // For other cases, try to delete single verification
    const verification = await this.betterAuthDeleteVerification(where);
    return verification ? [verification] : [];
  }

  // Profile management methods
  async userUpdatesProfile(params: UserUpdatesProfileParams): Promise<UserUpdatesProfileResult> {
    const tx = await this.beginTransaction();
    try {
      const { id, fullName, profilePictureUrl, updateDate } = params;

      const rows = await tx.sql`
        UPDATE users
        SET name = COALESCE(${fullName}, name),
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
        fullName: user.name,
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
      SELECT id, name, email, email_verified_date, profile_picture, role,
             two_factor_enabled_date,
             created_date, updated_date,
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
    } catch (err) {
      // ignore and keep default
    }

    return {
      id: String(user.id),
      name: 'name' in user && typeof user.name === 'string' ? user.name : undefined,
      email: 'email' in user && typeof user.email === 'string' ? user.email : undefined,
      emailVerified: 'email_verified_date' in user ? !!user.email_verified_date : false,
      profilePicture:
        'profile_picture' in user && typeof user.profile_picture === 'string'
          ? user.profile_picture
          : undefined,
      role:
        'role' in user && typeof user.role === 'string'
          ? (user.role as 'System' | 'Admin' | 'User')
          : 'User',
      twoFactorEnabled: 'two_factor_enabled_date' in user ? !!user.two_factor_enabled_date : false,
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
        selfiePhoto,
        selfieWithIdCardPhoto,
        nik,
        fullName,
        birthCity,
        birthDate,
        province,
        city,
        district,
        subdistrict,
        address,
        postalCode,
        phoneNumber,
        submissionDate,
      } = params;

      const rows = await tx.sql`
        INSERT INTO user_kycs (
          user_id, submitted_date, id_card_photo, selfie_photo, selfie_with_id_card_photo,
          nik, name, birth_city, birth_date, province, city,
          district, subdistrict, address, postal_code, phone_number
        )
        VALUES (
          ${userId}, ${submissionDate}, ${idCardPhoto}, ${selfiePhoto}, ${selfieWithIdCardPhoto},
          ${nik}, ${fullName}, ${birthCity}, ${birthDate}, ${province}, ${city},
          ${district}, ${subdistrict}, ${address}, ${postalCode}, ${phoneNumber}
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
          fullName: kyc.name,
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
      const { applicantUserId, businessName, applicationDate } = params;

      const rows = await tx.sql`
        INSERT INTO institution_applications (
          applicant_user_id, business_name, business_description, business_type,
          npwp_number, npwp_document_path, registration_number, registration_document_path,
          deed_of_establishment_path, business_address,
          business_city, business_province, business_postal_code, director_name,
          director_id_card_path, submitted_date
        )
        VALUES (
          ${applicantUserId}, ${businessName}, 'Business Description', 'PT',
          '01.234.567.8-901.234', '/path/to/npwp.pdf', 'NIB1234567890', '/path/to/registration.pdf',
          '/path/to/deed.pdf', 'Business Address',
          'Jakarta', 'DKI Jakarta', '12345', 'Director Name',
          '/path/to/director_id.pdf', ${applicationDate}
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

  async rejectInstitutionApplication(
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
      const { invitationId, userId, acceptanceDate } = params;

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
      const { invitationId, userId, rejectionReason, rejectionDate } = params;

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
      const { userId, institutionId, role, assignedDate } = params;

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
      const { userId, removedDate } = params;

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

  async systemCreatesInstitutionApplicationWithValidation(
    params: SystemCreatesInstitutionApplicationWithValidationParams,
  ): Promise<SystemCreatesInstitutionApplicationWithValidationResult> {
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
        businessPostalCode,
        directorName,
        directorIdCardPath,
        submittedDate,
      } = params;

      const rows = await tx.sql`
        INSERT INTO institution_applications (
          applicant_user_id, business_name, npwp_number, npwp_document_path,
          registration_number, registration_document_path, deed_of_establishment_path,
          business_address, business_city, business_province,
          business_postal_code, director_name, director_id_card_path, submitted_date
        ) VALUES (
          ${applicantUserId}, ${businessName}, ${npwpNumber}, ${npwpDocumentPath},
          ${registrationNumber}, ${registrationDocumentPath}, ${deedOfEstablishmentPath},
          ${businessAddress}, ${businessCity}, ${businessProvince},
          ${businessPostalCode}, ${directorName}, ${directorIdCardPath}, ${submittedDate}
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
}
