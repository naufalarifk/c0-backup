/** biome-ignore-all lint/suspicious/noExplicitAny: any */
/** biome-ignore-all lint/correctness/noUnusedVariables: any */

import { v7 } from 'uuid';

import {
  assertArrayOf,
  assertDefined,
  assertPropDefined,
  assertPropNullableString,
  assertPropNullableStringOrNumber,
  assertPropString,
  assertPropStringOrNumber,
  setAssertPropValue,
} from '../utils/assertions';
import { BaseRepository } from './base.repository';

function tryToDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function alignBetterAuthUserData(user: unknown) {
  assertDefined(user);
  if ('profile_picture' in user) {
    setAssertPropValue(user, 'image', user.profile_picture ?? null);
  }
  if ('email_verified_date' in user) {
    setAssertPropValue(user, 'emailVerified', !!user.email_verified_date);
    setAssertPropValue(
      user,
      'emailVerifiedDate',
      'email_verified_date' in user && tryToDate(user.email_verified_date),
    );
  }
  if ('phone_number' in user) {
    setAssertPropValue(user, 'phoneNumber', user.phone_number ?? null);
  }
  if ('phone_number_verified' in user) {
    setAssertPropValue(user, 'phoneNumberVerified', !!user.phone_number_verified);
  }
  if ('two_factor_enabled' in user) {
    setAssertPropValue(user, 'twoFactorEnabled', !!user.two_factor_enabled);
  }
  if ('user_type' in user) {
    setAssertPropValue(user, 'userType', user.user_type);
  }
  if ('kyc_status' in user) {
    setAssertPropValue(user, 'kycStatus', user.kyc_status);
  }
  if ('created_date' in user) {
    setAssertPropValue(user, 'createdAt', 'created_date' in user && tryToDate(user.created_date));
  }
  if ('updated_date' in user) {
    setAssertPropValue(user, 'updatedAt', 'updated_date' in user && tryToDate(user.updated_date));
  }
}

/**
 * BetterAuthRepository <- BaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as encryption, hashing, TOTP verification, etc.
 * should be handled by services that use this repository.
 */
export abstract class BetterAuthRepository extends BaseRepository {
  async betterAuthCreateUser(data: any): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      const {
        name,
        email,
        email_address,
        emailVerified = false,
        phoneNumber,
        phoneNumberVerified = false,
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
      const emailValue = email_address || email || `user-${Date.now()}@example.com`;

      // Convert Dates to UTC milliseconds for database storage
      const createdAtUtc = new Date(createdAt ?? Date.now());
      const updatedAtUtc = new Date(updatedAt ?? Date.now());

      const rows = await tx.sql`
        INSERT INTO users (name, profile_picture, email, phone_number, phone_number_verified, created_date, updated_date, email_verified_date)
        VALUES (${name}, ${image}, ${emailValue}, ${phoneNumber}, ${phoneNumberVerified}, ${createdAtUtc}, ${updatedAtUtc}, ${emailVerified ? updatedAtUtc : null})
        RETURNING id, name, profile_picture as "image", email, phone_number, phone_number_verified, two_factor_enabled, role, user_type, created_date, updated_date, email_verified_date
      `;

      assertArrayOf(rows, function (row) {
        assertDefined(row);
        assertPropString(row, 'email');
        assertPropNullableStringOrNumber(row, 'image');
        if (email_address) {
          setAssertPropValue(row, 'email_address', row.email);
        }
        if (callbackURL) {
          setAssertPropValue(row, 'callbackURL', callbackURL);
        }
        alignBetterAuthUserData(row);
        return row;
      });

      const user = rows[0];

      await tx.commitTransaction();

      return user;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthFindOneUser(where: any[]): Promise<any> {
    try {
      if (!Array.isArray(where) || where.length === 0) {
        return null;
      }

      const idCondition = where.find(w => w.field === 'id');
      const emailCondition = where.find(w => w.field === 'email' || w.field === 'email_address');
      const phoneCondition = where.find(w => w.field === 'phoneNumber');

      let rows: Array<unknown> = [];
      if (idCondition) {
        rows = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
            role, user_type, created_date, updated_date
          FROM users
          WHERE id = ${idCondition.value}
        `;
      } else if (emailCondition) {
        rows = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
            role, user_type, created_date, updated_date
          FROM users
          WHERE email = ${emailCondition.value}
        `;
      } else if (phoneCondition) {
        rows = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
            role, user_type, created_date, updated_date
          FROM users
          WHERE phone_number = ${phoneCondition.value}
        `;
      } else {
        console.warn('Find user requires id, email, or phone number condition.');
        return null;
      }

      assertArrayOf(rows, function (row) {
        assertDefined(row);
        if (where.some(w => w.field === 'email_address')) {
          if ('email' in row) setAssertPropValue(row, 'email_address', row.email);
        }
        alignBetterAuthUserData(row);
        return row;
      });

      if (rows.length > 0) {
        const user = rows[0];
        assertDefined(user);
        return user;
      }

      return null;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindManyUsers(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    try {
      const hasEmailAddressField = where && where.some(w => w.field === 'email_address');

      let users: Array<unknown> = [];
      if (!where || where.length === 0) {
        users = await this.sql`
          SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                 role, user_type, created_date, updated_date
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
            SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                   role, user_type, created_date, updated_date
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
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
              FROM users
              WHERE email LIKE ${searchTerm}
              ORDER BY created_date DESC
              LIMIT ${limit || 100}
              OFFSET ${offset || 0}
            `;
          } else {
            users = await this.sql`
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
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
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
              FROM users
              WHERE name LIKE ${searchTerm}
              ORDER BY created_date DESC
              LIMIT ${limit || 100}
              OFFSET ${offset || 0}
            `;
          } else {
            users = await this.sql`
              SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                     role, user_type, created_date, updated_date
              FROM users
              WHERE name = ${nameCondition.value}
              ORDER BY created_date DESC
              LIMIT ${limit || 100}
              OFFSET ${offset || 0}
            `;
          }
        } else {
          users = await this.sql`
            SELECT id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date, two_factor_enabled,
                   role, user_type, created_date, updated_date
            FROM users
            ORDER BY created_date DESC
            LIMIT ${limit || 100}
            OFFSET ${offset || 0}
          `;
        }
      }

      assertArrayOf(users, alignBetterAuthUserData);

      // Add email_address field if original query used email_address
      if (hasEmailAddressField) {
        users.forEach(function (user) {
          assertDefined(user);
          assertPropDefined(user, 'email');
          setAssertPropValue(user, 'email_address', user.email);
          alignBetterAuthUserData(user);
        });
      }

      return users;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthUpdateUser(where: any[], update: any): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      if (!Array.isArray(where) || where.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const {
        name,
        email,
        emailVerified,
        phoneNumber,
        phoneNumberVerified,
        twoFactorEnabled,
        createdAt,
        updatedAt,
        image,
      } = update;

      // Convert Dates to UTC milliseconds for database storage if they exist
      const createdAtUtc = createdAt ? new Date(createdAt ?? Date.now()) : new Date();
      const updatedAtUtc = updatedAt ? new Date(updatedAt ?? Date.now()) : new Date();

      const rows = await tx.sql`
        UPDATE users
        SET name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          phone_number = COALESCE(${phoneNumber}, phone_number),
          phone_number_verified = COALESCE(${phoneNumberVerified}, phone_number_verified),
          two_factor_enabled = COALESCE(${twoFactorEnabled}, two_factor_enabled),
          email_verified_date = CASE
            WHEN email_verified_date IS NOT NULL THEN email_verified_date
            WHEN ${emailVerified ? 1 : 0} = 1 AND email_verified_date IS NULL THEN ${updatedAtUtc}
            WHEN ${emailVerified ? 1 : 0} = 0 THEN NULL
            ELSE email_verified_date
          END,
          profile_picture = COALESCE(${image}, profile_picture),
          created_date = COALESCE(${createdAtUtc}, created_date),
          updated_date = COALESCE(${updatedAtUtc}, updated_date)
        WHERE id = ${where.find(w => w.field === 'id')?.value}
          OR email = ${where.find(w => w.field === 'email' || w.field === 'email_address')?.value}
        RETURNING id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date,
          two_factor_enabled, role, user_type, created_date, updated_date
      `;

      assertArrayOf(rows, alignBetterAuthUserData);

      const row = rows.length > 0 ? rows[0] : null;

      await tx.commitTransaction();

      return row;
    } catch (error) {
      console.error('BetterAuthRepository', error);
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

      const {
        name,
        email,
        emailVerified,
        phoneNumber,
        phoneNumberVerified,
        createdAt,
        updatedAt,
        image,
      } = update;

      // Convert Dates to UTC milliseconds for database storage if they exist
      const createdAtUtc = createdAt ? new Date(createdAt ?? Date.now()) : null;
      const updatedAtUtc = updatedAt ? new Date(updatedAt ?? Date.now()) : null;

      // For multiple users, we need to handle where conditions properly
      const idCondition = where.find(w => w.field === 'id');

      if (!idCondition) {
        console.warn('Update many users requires id condition.');
        return [];
      }

      const rows = await tx.sql`
        UPDATE users
        SET name = COALESCE(${name}, name),
            email = COALESCE(${email}, email),
            phone_number = COALESCE(${phoneNumber}, phone_number),
            phone_number_verified = COALESCE(${phoneNumberVerified}, phone_number_verified),
            profile_picture = COALESCE(${image}, profile_picture),
            email_verified_date = CASE
              WHEN ${emailVerified ? 1 : 0} = 1 AND email_verified_date IS NULL THEN ${updatedAtUtc}
              WHEN ${emailVerified ? 1 : 0} = 0 THEN NULL
              ELSE email_verified_date
            END,
            created_date = COALESCE(${createdAtUtc}, created_date),
            updated_date = COALESCE(${updatedAtUtc}, updated_date)
        WHERE id = ${idCondition.value}
          OR email = ${where.find(w => w.field === 'email' || w.field === 'email_address')?.value}
        RETURNING id, name, profile_picture as "image", email, phone_number, phone_number_verified, email_verified_date,
          two_factor_enabled, role, user_type, created_date, updated_date
      `;

      assertArrayOf(rows, alignBetterAuthUserData);

      await tx.commitTransaction();

      return rows;
    } catch (error) {
      console.error('BetterAuthRepository', error);
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

      if (!idCondition) {
        console.warn('Delete user requires id condition.');
        return null;
      }

      const rows = await tx.sql`
          DELETE FROM users
          WHERE id = ${idCondition.value}
          RETURNING id, name, profile_picture as "image", email, email_verified_date,
                   created_date, updated_date
        `;

      assertArrayOf(rows, alignBetterAuthUserData);

      const row = rows.length > 0 ? rows[0] : null;

      await tx.commitTransaction();

      return row;
    } catch (error) {
      console.error('BetterAuthRepository', error);
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

      if (!idCondition) {
        console.warn('Delete many users requires id condition.');
        return [];
      }

      const rows = await tx.sql`
          DELETE FROM users
          WHERE id = ${idCondition.value}
          RETURNING id, name, profile_picture as "image", email, email_verified_date,
            created_date, updated_date
        `;
      assertArrayOf(rows, alignBetterAuthUserData);

      await tx.commitTransaction();

      return rows;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  // Session methods for better-auth (using Redis)
  async betterAuthCreateSession(data: any): Promise<any> {
    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindOneSession(where: any[]): Promise<any> {
    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
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
    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
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
    const tx = await this.beginTransaction();
    try {
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

      const rows = await tx.sql`
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

      await tx.commitTransaction();

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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindOneAccount(where: any[]): Promise<any> {
    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindManyAccounts(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    if (!where || where.length === 0) return [];

    try {
      const account = await this.betterAuthFindOneAccount(where);
      return account ? [account] : [];
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
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

    const tx = await this.beginTransaction();
    try {
      const rows = await tx.sql`
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

      await tx.commitTransaction();

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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthUpdateManyAccounts(where: any[], update: any): Promise<any[]> {
    const account = await this.betterAuthUpdateAccount(where, update);
    return account ? [account] : [];
  }

  async betterAuthDeleteAccount(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) return null;
    const account = await this.betterAuthFindOneAccount(where);
    if (!account) return null;

    const tx = await this.beginTransaction();
    try {
      await tx.sql`DELETE FROM auth_providers WHERE id = ${account.id}`;
      await tx.commitTransaction();
      return account;
    } catch (error) {
      console.error('BetterAuthRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteManyAccounts(where: any[]): Promise<any[]> {
    const account = await this.betterAuthDeleteAccount(where);
    return account ? [account] : [];
  }

  async betterAuthCreateVerification(data: any): Promise<any> {
    try {
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
      const ttl = expiresAt
        ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
        : 3600; // Default 1 hour if no expiration

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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindOneVerification(where: any[]): Promise<any> {
    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
  }

  async betterAuthFindManyVerifications(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
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

    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
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

    try {
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
    } catch (error) {
      console.error('BetterAuthRepository', error);
      throw error;
    }
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

  // TwoFactor methods for better-auth two-factor plugin
  async betterAuthCreateTwoFactor(data: any): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      const { id, secret, backupCodes, userId } = data;

      const twoFactorId = id || v7();

      const rows = await tx.sql`
        INSERT INTO two_factor (id, secret, backup_codes, user_id)
        VALUES (${String(twoFactorId)}, ${secret}, ${backupCodes}, ${userId})
        RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
      `;

      const row = rows[0];
      if (!row) return null;

      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertPropStringOrNumber(row, 'userId');

      await tx.commitTransaction();

      return {
        id: row.id,
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthCreateTwoFactor', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthFindOneTwoFactor(where: any[]): Promise<any> {
    try {
      if (!Array.isArray(where) || where.length === 0) {
        return null;
      }

      const userIdCondition = where.find(w => w.field === 'userId');
      const idCondition = where.find(w => w.field === 'id');

      let rows: Array<unknown> = [];
      if (idCondition) {
        rows = await this.sql`
          SELECT id, secret, backup_codes as "backupCodes", user_id as "userId"
          FROM two_factor
          WHERE id = ${idCondition.value}
        `;
      } else if (userIdCondition) {
        rows = await this.sql`
          SELECT id, secret, backup_codes as "backupCodes", user_id as "userId"
          FROM two_factor
          WHERE user_id = ${userIdCondition.value}
        `;
      } else {
        return null;
      }

      if (rows.length === 0) return null;

      const row = rows[0];
      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertPropStringOrNumber(row, 'userId');

      return {
        id: row.id,
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthFindOneTwoFactor', error);
      throw error;
    }
  }

  async betterAuthFindManyTwoFactor(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    try {
      if (!where || where.length === 0) {
        const rows = await this.sql`
          SELECT id, secret, backup_codes as "backupCodes", user_id as "userId"
          FROM two_factor
          LIMIT ${limit || 100}
          OFFSET ${offset || 0}
        `;

        return rows.map(row => {
          assertDefined(row);
          assertPropString(row, 'id');
          assertPropString(row, 'secret');
          assertPropString(row, 'backupCodes');
          assertPropStringOrNumber(row, 'userId');

          return {
            id: row.id,
            secret: row.secret,
            backupCodes: row.backupCodes,
            userId: String(row.userId),
          };
        });
      }

      const twoFactor = await this.betterAuthFindOneTwoFactor(where);
      return twoFactor ? [twoFactor] : [];
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthFindManyTwoFactor', error);
      throw error;
    }
  }

  async betterAuthUpdateTwoFactor(where: any[], update: any): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      if (!Array.isArray(where) || where.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const { secret, backupCodes } = update;
      const userIdCondition = where.find(w => w.field === 'userId');
      const idCondition = where.find(w => w.field === 'id');

      if (!userIdCondition && !idCondition) {
        await tx.rollbackTransaction();
        return null;
      }

      let rows: Array<unknown> = [];
      if (idCondition) {
        rows = await tx.sql`
          UPDATE two_factor
          SET secret = COALESCE(${secret}, secret),
              backup_codes = COALESCE(${backupCodes}, backup_codes)
          WHERE id = ${idCondition.value}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      } else if (userIdCondition) {
        rows = await tx.sql`
          UPDATE two_factor
          SET secret = COALESCE(${secret}, secret),
              backup_codes = COALESCE(${backupCodes}, backup_codes)
          WHERE user_id = ${userIdCondition.value}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      }

      const row = rows.length > 0 ? rows[0] : null;
      if (!row) {
        await tx.rollbackTransaction();
        return null;
      }

      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertPropStringOrNumber(row, 'userId');

      await tx.commitTransaction();

      return {
        id: row.id,
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthUpdateTwoFactor', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthUpdateManyTwoFactor(where: any[], update: any): Promise<any[]> {
    const twoFactor = await this.betterAuthUpdateTwoFactor(where, update);
    return twoFactor ? [twoFactor] : [];
  }

  async betterAuthDeleteTwoFactor(where: any[]): Promise<any> {
    const tx = await this.beginTransaction();
    try {
      if (!Array.isArray(where) || where.length === 0) {
        await tx.rollbackTransaction();
        return null;
      }

      const userIdCondition = where.find(w => w.field === 'userId');
      const idCondition = where.find(w => w.field === 'id');

      if (!userIdCondition && !idCondition) {
        await tx.rollbackTransaction();
        return null;
      }

      let rows: Array<unknown> = [];
      if (idCondition) {
        rows = await tx.sql`
          DELETE FROM two_factor
          WHERE id = ${idCondition.value}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      } else if (userIdCondition) {
        rows = await tx.sql`
          DELETE FROM two_factor
          WHERE user_id = ${userIdCondition.value}
          RETURNING id, secret, backup_codes as "backupCodes", user_id as "userId"
        `;
      }

      const row = rows.length > 0 ? rows[0] : null;
      if (!row) {
        await tx.rollbackTransaction();
        return null;
      }

      assertDefined(row);
      assertPropString(row, 'id');
      assertPropString(row, 'secret');
      assertPropString(row, 'backupCodes');
      assertPropStringOrNumber(row, 'userId');

      await tx.commitTransaction();

      return {
        id: row.id,
        secret: row.secret,
        backupCodes: row.backupCodes,
        userId: String(row.userId),
      };
    } catch (error) {
      console.error('BetterAuthRepository:betterAuthDeleteTwoFactor', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async betterAuthDeleteManyTwoFactor(where: any[]): Promise<any[]> {
    const twoFactor = await this.betterAuthDeleteTwoFactor(where);
    return twoFactor ? [twoFactor] : [];
  }
}
