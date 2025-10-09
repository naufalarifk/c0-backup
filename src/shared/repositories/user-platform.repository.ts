import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropBoolean,
  assertPropNullableString,
  assertPropString,
  check,
  isInstanceOf,
  isNumber,
  isString,
} from 'typeshaper';

import {
  CleanupOrphanedSessionsResult,
  CleanupStaleTokensResult,
  PushTokenGetActiveParams,
  PushTokenGetActiveResult,
  PushTokenListByUserParams,
  PushTokenListByUserResult,
} from './push-tokens.types';
import { PlatformNotifyUserParams, PlatformNotifyUserResult } from './user.types';
import { UserAdminRepository } from './user-admin.repository';

export abstract class UserPlatformRepository extends UserAdminRepository {
  async platformNotifyUser(params: PlatformNotifyUserParams): Promise<PlatformNotifyUserResult> {
    const tx = await this.beginTransaction();
    try {
      // For now, create notification without optional fields due to in-memory database limitations
      // The optional fields will be handled in production with proper PostgreSQL migrations
      const rows = await tx.sql`
        INSERT INTO notifications (user_id, type, title, content, creation_date)
        VALUES (${params.userId}, ${params.type}, ${params.title}, ${params.content}, ${params.creationDate ?? new Date()})
        RETURNING id AS "id", user_id AS "userId"
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Failed to create notification');
        assertProp(check(isString, isNumber), row, 'id');
        assertProp(check(isString, isNumber), row, 'userId');
        return row;
      });

      if (rows.length === 0) {
        throw new Error('Failed to create notification');
      }

      await tx.commitTransaction();

      // Return directly with string conversion
      return {
        id: String(rows[0].id),
        userId: String(rows[0].userId),
      };
    } catch (error) {
      console.error('UserRepository', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  /**
   * List push tokens by user
   * Returns all devices registered for notifications
   */
  async platformViewsPushTokens(
    params: PushTokenListByUserParams,
  ): Promise<PushTokenListByUserResult> {
    const rows = params.activeOnly
      ? await this.sql`
          SELECT
            id AS "id",
            push_token AS "pushToken",
            device_id AS "deviceId",
            device_type AS "deviceType",
            device_name AS "deviceName",
            device_model AS "deviceModel",
            current_session_id AS "currentSessionId",
            is_active AS "isActive",
            last_used_date AS "lastUsedDate"
          FROM push_tokens
          WHERE user_id = ${params.userId} AND is_active = true
          ORDER BY last_used_date DESC
        `
      : await this.sql`
          SELECT
            id AS "id",
            push_token AS "pushToken",
            device_id AS "deviceId",
            device_type AS "deviceType",
            device_name AS "deviceName",
            device_model AS "deviceModel",
            current_session_id AS "currentSessionId",
            is_active AS "isActive",
            last_used_date AS "lastUsedDate"
          FROM push_tokens
          WHERE user_id = ${params.userId}
          ORDER BY last_used_date DESC
        `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row, 'Failed to list push tokens');
      assertProp(check(isString, isNumber), row, 'id');
      assertPropString(row, 'pushToken');
      assertPropNullableString(row, 'deviceId');
      assertPropString(row, 'deviceType');
      assertPropNullableString(row, 'deviceName');
      assertPropNullableString(row, 'deviceModel');
      assertPropNullableString(row, 'currentSessionId');
      assertPropBoolean(row, 'isActive');
      assertProp(isInstanceOf(Date), row, 'lastUsedDate');
      return row;
    });

    // Minimal mapping for type conversions
    const tokens = rows.map(row => ({
      id: String(row.id),
      pushToken: row.pushToken,
      deviceId: row.deviceId ?? null,
      deviceType: row.deviceType as 'ios' | 'android',
      deviceName: row.deviceName ?? null,
      deviceModel: row.deviceModel ?? null,
      currentSessionId: row.currentSessionId ?? null,
      isActive: Boolean(row.isActive),
      lastUsedDate: row.lastUsedDate,
    }));

    return { tokens };
  }

  /**
   * Get active tokens for notification sending
   * Supports flexible targeting (all, active_sessions, specific devices)
   */
  async platformViewsActivePushTokens(
    params: PushTokenGetActiveParams,
  ): Promise<PushTokenGetActiveResult> {
    // Build query based on target devices
    const rows =
      params.targetDevices === 'active_sessions'
        ? await this.sql`
            SELECT
              id AS "id",
              push_token AS "pushToken",
              device_id AS "deviceId",
              current_session_id AS "currentSessionId"
            FROM push_tokens
            WHERE user_id = ${params.userId} AND is_active = true AND current_session_id IS NOT NULL
          `
        : params.targetDevices === 'specific' && params.deviceIds?.length
          ? await this.sql`
              SELECT
                id AS "id",
                push_token AS "pushToken",
                device_id AS "deviceId",
                current_session_id AS "currentSessionId"
              FROM push_tokens
              WHERE user_id = ${params.userId} AND is_active = true AND device_id = ANY(${params.deviceIds})
            `
          : await this.sql`
              SELECT
                id AS "id",
                push_token AS "pushToken",
                device_id AS "deviceId",
                current_session_id AS "currentSessionId"
              FROM push_tokens
              WHERE user_id = ${params.userId} AND is_active = true
            `;

    assertArrayMapOf(rows, function (row) {
      assertDefined(row, 'Failed to get active tokens');
      assertProp(check(isString, isNumber), row, 'id');
      assertPropString(row, 'pushToken');
      assertPropNullableString(row, 'deviceId');
      assertPropNullableString(row, 'currentSessionId');
      return row;
    });

    // Minimal mapping for type conversions
    const tokens = rows.map(row => ({
      id: String(row.id),
      pushToken: row.pushToken,
      deviceId: row.deviceId ?? null,
      currentSessionId: row.currentSessionId ?? null,
    }));

    return { tokens };
  }

  /**
   * Cleanup stale tokens (mark as inactive after 30 days)
   * Scheduled job runs daily at 3 AM
   */
  async paltformCleanupStaleTokens(): Promise<CleanupStaleTokensResult> {
    const tx = await this.beginTransaction();

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const rows = await tx.sql`
        UPDATE push_tokens
        SET is_active = false, updated_date = NOW()
        WHERE last_used_date < ${thirtyDaysAgo} AND is_active = true
        RETURNING id AS "id"
      `;

      assertArrayMapOf(rows, function (row) {
        assertDefined(row, 'Failed to cleanup stale tokens');
        assertProp(check(isString, isNumber), row, 'id');
        return row;
      });

      await tx.commitTransaction();

      console.log(`[UserRepository] Cleaned up ${rows.length} stale tokens`);

      return {
        staleTokensDeactivated: rows.length,
      };
    } catch (error) {
      console.error('UserRepository.cleanupStaleTokens', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Cleanup orphaned session references (Redis-specific)
   * Nullifies current_session_id where session no longer exists in Redis
   */
  async platformCleanupOrphanedSessions(): Promise<CleanupOrphanedSessionsResult> {
    const tx = await this.beginTransaction();

    try {
      // Get all tokens with session references
      const tokens = await tx.sql`
        SELECT
          id AS "id",
          current_session_id AS "currentSessionId"
        FROM push_tokens
        WHERE current_session_id IS NOT NULL
      `;

      assertArrayMapOf(tokens, function (row) {
        assertDefined(row, 'Failed to get tokens with session references');
        assertProp(check(isString, isNumber), row, 'id');
        assertPropString(row, 'currentSessionId');
        return row;
      });

      const orphanedIds: string[] = [];

      // Check each session in Redis using repository's exists() method
      for (const token of tokens) {
        const sessionKey = `session:${token.currentSessionId}`;
        const exists = await this.exists(sessionKey);

        if (!exists) {
          orphanedIds.push(String(token.id));
        }
      }

      // Nullify orphaned references
      if (orphanedIds.length > 0) {
        await tx.sql`
          UPDATE push_tokens
          SET current_session_id = NULL, updated_date = NOW()
          WHERE id = ANY(${orphanedIds})
        `;
      }

      await tx.commitTransaction();

      console.log(`[UserRepository] Cleaned up ${orphanedIds.length} orphaned session references`);

      return {
        orphanedSessionsNullified: orphanedIds.length,
      };
    } catch (error) {
      console.error('UserRepository.cleanupOrphanedSessions', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Update last_used_date for sent notifications
   * Keeps tokens fresh after successful notification delivery
   */
  async platformUpdatesLastUsedPushTokens(tokenIds: string[]): Promise<void> {
    if (tokenIds.length === 0) return;

    const tx = await this.beginTransaction();

    try {
      await tx.sql`
        UPDATE push_tokens
        SET last_used_date = NOW()
        WHERE id = ANY(${tokenIds})
      `;

      await tx.commitTransaction();
    } catch (error) {
      console.error('UserRepository.updateLastUsedAt', error);
      await tx.rollbackTransaction();
      throw error;
    }
  }
}
