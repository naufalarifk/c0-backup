/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
/** biome-ignore-all lint/correctness/noUnusedVariables: <explanation> */
import { Injectable } from '@nestjs/common';

import { v7 } from 'uuid';

import {
  AdminApprovesInstitutionApplicationParams,
  AdminApprovesInstitutionApplicationResult,
  AdminApprovesKycParams,
  AdminApprovesKycResult,
  AdminRejectsInstitutionApplicationParams,
  AdminRejectsInstitutionApplicationResult,
  AdminRejectsKycParams,
  AdminRejectsKycResult,
  AdminViewPendingKycsResult,
  OwnerUserInvitesUserToInstitutionParams,
  OwnerUserInvitesUserToInstitutionResult,
  UserAcceptsInstitutionInvitationParams,
  UserAcceptsInstitutionInvitationResult,
  UserAppliesForInstitutionParams,
  UserAppliesForInstitutionResult,
  UserRejectsInstitutionInvitationParams,
  UserRejectsInstitutionInvitationResult,
  UserSubmitsKYCResult,
  UserSubmitsKycParams,
  UserUpdatesProfileParams,
  UserUpdatesProfileResult,
  UserViewKYCSStatusResult,
  UserViewKYCStatusParams,
} from '../types';
import { assertDefined } from '../utils';
import { BaseRepository } from './base.repository';

/**
 * UserRepository <- DatabaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as encryption, hashing, TOTP verification, etc.
 * should be handled by services that use this repository.
 */
@Injectable()
export abstract class UserRepository extends BaseRepository {
  async betterAuthCreateUser(data: any): Promise<any> {
    const {
      name,
      email,
      email_address,
      emailVerified = false,
      createdAt = new Date(),
      updatedAt = new Date(),
      id,
    } = data;

    // Handle field mapping: email_address maps to email column
    const emailValue = email_address || email;

    const result = await this.sql`
      INSERT INTO users (name, email, email_verified, created_date, updated_date)
      VALUES (${name}, ${emailValue}, ${emailVerified}, ${createdAt}, ${updatedAt})
      RETURNING id, name, email, email_verified as "emailVerified", created_date as "createdAt", updated_date as "updatedAt";
    `;

    const user = Array.isArray(result) ? result[0] : result;

    // If original data had email_address, return it as email_address in response
    if (email_address) {
      user.email_address = user.email;
      // biome-ignore lint/correctness/noSelfAssign: <explanation>
      user.email = user.email; // Keep both for compatibility
    }

    return user;
  }

  async betterAuthFindOneUser(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (let i = 0; i < where.length; i++) {
      const condition = where[i];
      // Handle field mapping: email_address maps to email column
      const fieldName = condition.field === 'email_address' ? 'email' : condition.field;
      conditions.push(`${fieldName} = $${i + 1}`);
      params.push(condition.value);
    }

    const query = `
      SELECT id, name, email, email_verified as "emailVerified",
             created_date as "createdAt", updated_date as "updatedAt"
      FROM users
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.rawQuery(query, params);
    const rows = Array.isArray(result) ? result : result ? [result] : [];
    if (rows.length > 0) {
      const user = rows[0];
      // Add email_address field if original query used email_address
      if (where.some(w => w.field === 'email_address')) {
        user.email_address = user.email;
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
    let query = `
      SELECT id, name, email, email_verified as "emailVerified",
             created_date as "createdAt", updated_date as "updatedAt"
      FROM users
    `;

    const params: any[] = [];

    const hasEmailAddressField = where && where.some(w => w.field === 'email_address');

    if (where && where.length > 0) {
      const conditions: string[] = [];
      for (let i = 0; i < where.length; i++) {
        const condition = where[i];
        // Handle field mapping: email_address maps to email column
        const fieldName = condition.field === 'email_address' ? 'email' : condition.field;
        let operator = '=';
        let value = condition.value;

        switch (condition.operator) {
          case 'eq':
            operator = '=';
            conditions.push(`${fieldName} ${operator} $${params.length + 1}`);
            params.push(value);
            break;
          case 'in': {
            operator = 'IN';
            const placeholders = condition.value
              .map((_: any, idx: number) => `$${params.length + idx + 1}`)
              .join(',');
            conditions.push(`${fieldName} ${operator} (${placeholders})`);
            params.push(...condition.value);
            break;
          }
          case 'contains':
            operator = 'LIKE';
            value = `%${condition.value}%`;
            params.push(value);
            conditions.push(`${fieldName} ${operator} $${params.length}`);
            break;
          case 'starts_with':
            operator = 'LIKE';
            value = `${condition.value}%`;
            params.push(value);
            conditions.push(`${fieldName} ${operator} $${params.length}`);
            break;
          case 'ends_with':
            operator = 'LIKE';
            value = `%${condition.value}`;
            params.push(value);
            conditions.push(`${fieldName} ${operator} $${params.length}`);
            break;
          default:
            params.push(value);
            conditions.push(`${fieldName} = $${params.length}`);
            break;
        }
      }
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (sortBy) {
      // Handle field mapping for sortBy as well
      const sortFieldName = sortBy.field === 'email_address' ? 'email' : sortBy.field;
      query += ` ORDER BY ${sortFieldName} ${sortBy.direction.toUpperCase()}`;
    }

    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    if (offset) {
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.rawQuery(query, params);
    const users = Array.isArray(result) ? result : result ? [result] : [];

    // Add email_address field if original query used email_address
    if (hasEmailAddressField) {
      users.forEach(user => {
        user.email_address = user.email;
      });
    }

    return users;
  }

  async betterAuthUpdateUser(where: any[], update: any): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    const updateFields: string[] = [];
    const params: any[] = [];

    // Build update fields
    Object.keys(update).forEach(key => {
      const dbField =
        key === 'emailVerified'
          ? 'email_verified'
          : key === 'createdAt'
            ? 'created_date'
            : key === 'updatedAt'
              ? 'updated_date'
              : key;
      updateFields.push(`${dbField} = $${params.length + 1}`);
      params.push(update[key]);
    });

    // Build where conditions
    const whereConditions: string[] = [];
    for (const condition of where) {
      whereConditions.push(`${condition.field} = $${params.length + 1}`);
      params.push(condition.value);
    }

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}, updated_date = NOW()
      WHERE ${whereConditions.join(' AND ')}
      RETURNING id, name, email, email_verified as "emailVerified",
               created_date as "createdAt", updated_date as "updatedAt"
    `;

    const result = await this.rawQuery(query, params);
    const rows = Array.isArray(result) ? result : result ? [result] : [];
    return rows.length > 0 ? rows[0] : null;
  }

  async betterAuthUpdateManyUsers(where: any[], update: any): Promise<any[]> {
    if (!Array.isArray(where) || where.length === 0) {
      return [];
    }

    const updateFields: string[] = [];
    const params: any[] = [];

    // Build update fields
    Object.keys(update).forEach(key => {
      const dbField =
        key === 'emailVerified'
          ? 'email_verified'
          : key === 'createdAt'
            ? 'created_date'
            : key === 'updatedAt'
              ? 'updated_date'
              : key;
      updateFields.push(`${dbField} = $${params.length + 1}`);
      params.push(update[key]);
    });

    // Build where conditions
    const whereConditions: string[] = [];
    for (const condition of where) {
      whereConditions.push(`${condition.field} = $${params.length + 1}`);
      params.push(condition.value);
    }

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}, updated_date = NOW()
      WHERE ${whereConditions.join(' AND ')}
      RETURNING id, name, email, email_verified as "emailVerified",
               created_date as "createdAt", updated_date as "updatedAt"
    `;

    const result = await this.rawQuery(query, params);
    return Array.isArray(result) ? result : result ? [result] : [];
  }

  async betterAuthDeleteUser(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    const whereConditions: string[] = [];
    const params: any[] = [];

    for (const condition of where) {
      whereConditions.push(`${condition.field} = $${params.length + 1}`);
      params.push(condition.value);
    }

    const query = `
      DELETE FROM users
      WHERE ${whereConditions.join(' AND ')}
      RETURNING id, name, email, email_verified as "emailVerified",
               created_date as "createdAt", updated_date as "updatedAt"
    `;

    const result = await this.rawQuery(query, params);
    const rows = Array.isArray(result) ? result : result ? [result] : [];
    return rows.length > 0 ? rows[0] : null;
  }

  async betterAuthDeleteManyUsers(where: any[]): Promise<any[]> {
    if (!Array.isArray(where) || where.length === 0) {
      return [];
    }

    const whereConditions: string[] = [];
    const params: any[] = [];

    for (const condition of where) {
      whereConditions.push(`${condition.field} = $${params.length + 1}`);
      params.push(condition.value);
    }

    const query = `
      DELETE FROM users
      WHERE ${whereConditions.join(' AND ')}
      RETURNING id, name, email, email_verified as "emailVerified",
               created_date as "createdAt", updated_date as "updatedAt"
    `;

    const result = await this.rawQuery(query, params);
    return Array.isArray(result) ? result : result ? [result] : [];
  }

  // Session methods for better-auth (using Redis)
  async betterAuthCreateSession(data: any): Promise<any> {
    const { token, userId, expiresAt, createdAt = new Date(), updatedAt = new Date(), id } = data;

    const sessionId = id || v7();

    const session = {
      id: sessionId,
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

  // Account methods for better-auth (using Redis)
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
      createdAt = new Date(),
      updatedAt = new Date(),
    } = data;

    const accountRecordId = id || v7();

    const account = {
      id: accountRecordId,
      userId,
      accountId,
      providerId,
      accessToken,
      refreshToken,
      expiresAt,
      password, // Include password for credential provider
      createdAt,
      updatedAt,
    };

    // Store account in Redis
    await this.set(`account:${accountRecordId}`, account);
    await this.set(`account:userId:${userId}:${providerId}`, accountRecordId);

    // Also index by accountId + providerId for credential lookups
    if (accountId && providerId) {
      await this.set(`account:accountId:${accountId}:${providerId}`, accountRecordId);
    }

    return account;
  }

  async betterAuthFindOneAccount(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Handle different search criteria
    const userId = where.find(w => w.field === 'userId')?.value;
    const providerId = where.find(w => w.field === 'providerId')?.value;
    const accountId = where.find(w => w.field === 'accountId')?.value;
    const idField = where.find(w => w.field === 'id')?.value;

    // Search by account record id
    if (idField) {
      const account = await this.get(`account:${idField}`);
      if (account) {
        return account;
      }
    }

    // Search by accountId + providerId
    if (accountId && providerId) {
      const accountRecordId = await this.get(`account:accountId:${accountId}:${providerId}`);
      if (accountRecordId) {
        const account = await this.get(`account:${accountRecordId}`);
        if (account) {
          return account;
        }
      }
    }

    // Search by userId + providerId
    if (userId && providerId) {
      const accountRecordId = await this.get(`account:userId:${userId}:${providerId}`);
      if (accountRecordId) {
        const account = await this.get(`account:${accountRecordId}`);
        if (account) {
          return account;
        }
      }
    }

    // Search by userId alone (need to check all providers)
    if (userId && !providerId) {
      // For email/password authentication, try credential provider
      const credentialAccountId = await this.get(`account:userId:${userId}:credential`);
      if (credentialAccountId) {
        const account = await this.get(`account:${credentialAccountId}`);
        if (account) {
          return account;
        }
      }
    }

    return null;
  }

  async betterAuthFindManyAccounts(
    where?: any[],
    limit?: number,
    offset?: number,
    sortBy?: any,
  ): Promise<any[]> {
    // This is a simplified implementation
    // In a real scenario, you'd need proper indexing for accounts

    if (!where || where.length === 0) {
      // Return empty array for now - finding all accounts would require scanning all keys
      return [];
    }

    const account = await this.betterAuthFindOneAccount(where);
    return account ? [account] : [];
  }

  async betterAuthUpdateAccount(where: any[], update: any): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Find the account first
    const account = await this.betterAuthFindOneAccount(where);
    if (!account) {
      return null;
    }

    // Update the account data
    const updatedAccount = { ...account, ...update, updatedAt: new Date() };

    // Update in Redis
    await this.set(`account:${account.id}`, updatedAccount);

    return updatedAccount;
  }

  async betterAuthUpdateManyAccounts(where: any[], update: any): Promise<any[]> {
    const account = await this.betterAuthUpdateAccount(where, update);
    return account ? [account] : [];
  }

  async betterAuthDeleteAccount(where: any[]): Promise<any> {
    if (!Array.isArray(where) || where.length === 0) {
      return null;
    }

    // Find the account first
    const account = await this.betterAuthFindOneAccount(where);
    if (!account) {
      return null;
    }

    // Delete from Redis
    await this.del(`account:${account.id}`);
    if (account.userId && account.providerId) {
      await this.del(`account:userId:${account.userId}:${account.providerId}`);
    }

    return account;
  }

  async betterAuthDeleteManyAccounts(where: any[]): Promise<any[]> {
    const account = await this.betterAuthDeleteAccount(where);
    return account ? [account] : [];
  }

  // Verification methods for better-auth (using Redis)
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
      await this.set(`verification:identifier:${verification.identifier}`, verification.id, ttl);
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
    const { id, fullName, profilePictureUrl, updateDate } = params;

    const result = await this.sql`
      UPDATE users
      SET full_name = COALESCE(${fullName}, full_name),
          profile_picture = COALESCE(${profilePictureUrl}, profile_picture)
      WHERE id = ${id}
      RETURNING id, full_name, profile_picture;
    `;

    assertDefined(result, 'Update operation failed');
    const user = Array.isArray(result) ? result[0] : result;

    return {
      id: user.id,
      fullName: user.full_name,
      profilePictureUrl: user.profile_picture,
      updatedDate: updateDate, // Return the passed Date instance
    };
  }

  // KYC methods
  async userSubmitsKyc(params: UserSubmitsKycParams): Promise<UserSubmitsKYCResult> {
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

    const result = await this.sql`
      INSERT INTO user_kycs (
        user_id, submitted_date, id_card_photo, selfie_photo, selfie_with_id_card_photo,
        nik, full_name, birth_city, birth_date, province, city,
        district, subdistrict, address, postal_code, phone_number
      )
      VALUES (
        ${userId}, ${submissionDate}, ${idCardPhoto}, ${selfiePhoto}, ${selfieWithIdCardPhoto},
        ${nik}, ${fullName}, ${birthCity}, ${birthDate}, ${province}, ${city},
        ${district}, ${subdistrict}, ${address}, ${postalCode}, ${phoneNumber}
      )
      RETURNING id, user_id;
    `;

    assertDefined(result, 'KYC submission failed');
    const kyc = Array.isArray(result) ? result[0] : result;

    return {
      id: kyc.id,
      userId: kyc.user_id,
    };
  }

  async userViewsKYCStatus(params: UserViewKYCStatusParams): Promise<UserViewKYCSStatusResult> {
    const { userId } = params;

    const result = await this.sql`
      SELECT id, user_id, submitted_date, verified_date, rejected_date, rejection_reason
      FROM user_kycs
      WHERE user_id = ${userId}
      ORDER BY submitted_date DESC
      LIMIT 1
    `;

    const kycs = Array.isArray(result) ? result : [result];

    if (kycs.length === 0) {
      return {
        userId,
        status: 'none',
        canResubmit: true,
      };
    }

    const kyc = kycs[0];

    let status: 'none' | 'pending' | 'verified' | 'rejected';
    if (kyc.verified_date) {
      status = 'verified';
    } else if (kyc.rejected_date) {
      status = 'rejected';
    } else {
      status = 'pending';
    }

    return {
      id: kyc.id,
      userId: kyc.user_id,
      status,
      submittedDate: kyc.submitted_date ? new Date(kyc.submitted_date) : undefined,
      verifiedDate: kyc.verified_date ? new Date(kyc.verified_date) : undefined,
      rejectedDate: kyc.rejected_date ? new Date(kyc.rejected_date) : undefined,
      rejectionReason: kyc.rejection_reason,
      canResubmit: status === 'rejected',
    };
  }

  async adminApprovesKYCParam(params: AdminApprovesKycParams): Promise<AdminApprovesKycResult> {
    const { kycId, verifierUserId, approvalDate } = params;

    const result = await this.sql`
      UPDATE user_kycs
      SET verifier_user_id = ${verifierUserId},
          verified_date = ${approvalDate}
      WHERE id = ${kycId} AND verified_date IS NULL AND rejected_date IS NULL
      RETURNING id, user_id, verified_date;
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      throw new Error('KYC approval failed');
    }

    const kyc = Array.isArray(result) ? result[0] : result;

    // KYC ID is no longer stored in users table
    // The relationship is maintained through the user_kycs table

    return {
      id: kyc.id,
      userId: kyc.user_id,
      verifiedDate: new Date(kyc.verified_date),
    };
  }

  async adminRejectsKyc(params: AdminRejectsKycParams): Promise<AdminRejectsKycResult> {
    const { kycId, verifierUserId, rejectionReason, rejectionDate } = params;

    const result = await this.sql`
      UPDATE user_kycs
      SET verifier_user_id = ${verifierUserId},
          rejected_date = ${rejectionDate},
          rejection_reason = ${rejectionReason}
      WHERE id = ${kycId} AND verified_date IS NULL AND rejected_date IS NULL
      RETURNING id, user_id, rejected_date;
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      throw new Error('KYC rejection failed');
    }

    const kyc = Array.isArray(result) ? result[0] : result;

    return {
      id: kyc.id,
      userId: kyc.user_id,
      rejectedDate: new Date(kyc.rejected_date),
    };
  }

  async adminViewsPendingKYCs(): Promise<AdminViewPendingKycsResult> {
    const result = await this.sql`
      SELECT id, user_id, full_name, nik, submitted_date
      FROM user_kycs
      WHERE verified_date IS NULL AND rejected_date IS NULL
      ORDER BY submitted_date ASC
    `;

    const kycs = Array.isArray(result) ? result : result ? [result] : [];

    return {
      kycs: kycs.map((kyc: any) => ({
        id: kyc.id,
        userId: kyc.user_id,
        fullName: kyc.full_name,
        nik: kyc.nik,
        submittedDate: new Date(kyc.submitted_date),
      })),
    };
  }

  // Institution methods
  async userAppliesForInstitution(
    params: UserAppliesForInstitutionParams,
  ): Promise<UserAppliesForInstitutionResult> {
    const { applicantUserId, businessName, applicationDate } = params;

    const result = await this.sql`
      INSERT INTO institution_applications (
        applicant_user_id, business_name, business_description, business_type,
        npwp_number, npwp_document_path, registration_number, registration_document_path,
        deed_of_establishment_path, domicile_certificate_path, business_address,
        business_city, business_province, business_postal_code, director_name,
        director_id_card_path, submitted_date
      )
      VALUES (
        ${applicantUserId}, ${businessName}, 'Business Description', 'PT',
        '01.234.567.8-901.234', '/path/to/npwp.pdf', 'NIB1234567890', '/path/to/registration.pdf',
        '/path/to/deed.pdf', '/path/to/domicile.pdf', 'Business Address',
        'Jakarta', 'DKI Jakarta', '12345', 'Director Name',
        '/path/to/director_id.pdf', ${applicationDate}
      )
      RETURNING id, applicant_user_id, business_name;
    `;

    assertDefined(result, 'Institution application failed');
    const application = Array.isArray(result) ? result[0] : result;

    return {
      id: application.id,
      applicantUserId: application.applicant_user_id,
      businessName: application.business_name,
    };
  }

  async adminApprovesInstitutionApplication(
    params: AdminApprovesInstitutionApplicationParams,
  ): Promise<AdminApprovesInstitutionApplicationResult> {
    const { applicationId, reviewerUserId: verifierUserId, approvalDate } = params;

    // Get application details
    const application = await this.sql`
      SELECT id, applicant_user_id, business_name
      FROM institution_applications
      WHERE id = ${applicationId} AND verified_date IS NULL AND rejected_date IS NULL
    `;

    if (!application || (Array.isArray(application) && application.length === 0)) {
      throw new Error('Application not found or already processed');
    }

    const app = Array.isArray(application) ? application[0] : application;

    // Update application status (trigger will handle user update)
    await this.sql`
      UPDATE institution_applications
      SET reviewer_user_id = ${verifierUserId}, verified_date = ${approvalDate}
      WHERE id = ${applicationId}
    `;

    return {
      institutionId: app.applicant_user_id, // The applicant becomes the institution owner
      applicationId: applicationId,
    };
  }

  async rejectInstitutionApplication(
    params: AdminRejectsInstitutionApplicationParams,
  ): Promise<AdminRejectsInstitutionApplicationResult> {
    const { applicationId, reviewerUserId, rejectionReason, rejectionDate } = params;

    const result = await this.sql`
      UPDATE institution_applications
      SET reviewer_user_id = ${reviewerUserId},
          rejected_date = ${rejectionDate},
          rejection_reason = ${rejectionReason}
      WHERE id = ${applicationId} AND verified_date IS NULL AND rejected_date IS NULL
      RETURNING id, rejected_date;
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      throw new Error('Application rejection failed');
    }

    const app = Array.isArray(result) ? result[0] : result;

    return {
      id: app.id,
      rejectedDate: new Date(app.rejected_date),
    };
  }

  async ownerUserInvitesUserToInstitution(
    params: OwnerUserInvitesUserToInstitutionParams,
  ): Promise<OwnerUserInvitesUserToInstitutionResult> {
    const { institutionId, userId, role, invitationDate } = params;

    // Create pending invitation (not auto-accepted)
    const result = await this.sql`
      INSERT INTO institution_invitations (institution_user_id, role, invited_date)
      VALUES (${institutionId}, ${role}, ${invitationDate})
      RETURNING id, institution_user_id, role;
    `;

    const rows = Array.isArray(result) ? result : [result];
    if (rows.length === 0) {
      throw new Error('Institution invitation failed');
    }

    const invitation = rows[0];

    return {
      id: invitation.id,
      institutionId: invitation.institution_user_id,
      userId: userId, // Note: new schema doesn't have user_id in invitations
      role: invitation.role,
    };
  }

  async userAcceptsInstitutionInvitation(
    params: UserAcceptsInstitutionInvitationParams,
  ): Promise<UserAcceptsInstitutionInvitationResult> {
    const { invitationId, userId, acceptanceDate } = params;

    // Get invitation details
    const invitation = await this.sql`
      SELECT institution_user_id, role
      FROM institution_invitations
      WHERE id = ${invitationId} AND accepted_date IS NULL AND rejected_date IS NULL
    `;

    if (!invitation || (Array.isArray(invitation) && invitation.length === 0)) {
      throw new Error('Invitation not found or already processed');
    }

    const _inv = Array.isArray(invitation) ? invitation[0] : invitation;

    // Update invitation status (trigger will handle user update)
    const result = await this.sql`
      UPDATE institution_invitations
      SET accepted_date = ${acceptanceDate}
      WHERE id = ${invitationId}
      RETURNING id, institution_user_id, accepted_date;
    `;

    assertDefined(result, 'Invitation acceptance failed');
    const updatedInv = Array.isArray(result) ? result[0] : result;

    return {
      id: updatedInv.id,
      institutionId: updatedInv.institution_user_id,
      acceptedDate: new Date(updatedInv.accepted_date),
    };
  }

  async userRejectsInstitutionInvitation(
    params: UserRejectsInstitutionInvitationParams,
  ): Promise<UserRejectsInstitutionInvitationResult> {
    const { invitationId, userId, rejectionReason, rejectionDate } = params;

    const result = await this.sql`
      UPDATE institution_invitations
      SET rejected_date = ${rejectionDate},
          rejection_reason = ${rejectionReason}
      WHERE id = ${invitationId} AND accepted_date IS NULL AND rejected_date IS NULL
      RETURNING id, rejected_date;
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      throw new Error('Invitation rejection failed');
    }

    const inv = Array.isArray(result) ? result[0] : result;

    return {
      id: inv.id,
      rejectedDate: new Date(inv.rejected_date),
    };
  }

  // Institution membership management (explicit methods for services to call)
  async adminAddUserToInstitution(params: {
    userId: string;
    institutionId: string;
    role: 'Owner' | 'Finance' | string;
    assignedDate: string;
  }): Promise<{ userId: string; institutionId: string; role: string }> {
    const { userId, institutionId, role, assignedDate } = params;

    const result = await this.sql`
      UPDATE users
      SET institution_user_id = ${institutionId}, institution_role = ${role}
      WHERE id = ${userId}
      RETURNING id, institution_user_id, institution_role;
    `;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      throw new Error('Failed to add user to institution');
    }

    const row = Array.isArray(result) ? result[0] : result;
    return {
      userId: row.id,
      institutionId: row.institution_user_id,
      role: row.institution_role,
    };
  }

  async adminRemoveUserFromInstitution(params: {
    userId: string;
    removedDate: string;
  }): Promise<{ userId: string; removed: boolean }> {
    const { userId } = params;

    const result = await this.sql`
      UPDATE users
      SET institution_user_id = NULL, institution_role = NULL
      WHERE id = ${userId}
      RETURNING id;
    `;
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return { userId, removed: false };
    }

    const row = Array.isArray(result) ? result[0] : result;
    return {
      userId: row.id,
      removed: true,
    };
  }
}
