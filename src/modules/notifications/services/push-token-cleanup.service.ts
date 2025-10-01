import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';

/**
 * Push Token Cleanup Service
 *
 * Handles scheduled cleanup of orphaned session references in push_tokens table.
 * Orphaned sessions occur when:
 * 1. User logs out (session deleted from Redis, but DB reference remains)
 * 2. Session expires via TTL (Redis auto-deletes, DB reference remains)
 * 3. Admin revokes session (Redis deleted, DB reference remains)
 *
 * This service ensures accurate targeting for 'active_sessions' notifications
 * and prevents sending notifications to logged-out devices.
 */
@Injectable()
export class PushTokenCleanupService {
  private readonly logger = new TelemetryLogger(PushTokenCleanupService.name);

  constructor(private readonly repository: CryptogadaiRepository) {}

  /**
   * Scheduled cleanup job - runs daily at 3 AM
   * Non-blocking: errors are logged but don't crash the service
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOrphanedSessions() {
    this.logger.log('Starting scheduled cleanup of orphaned session references');

    try {
      const startTime = Date.now();

      const result = await this.repository.cleanupOrphanedSessions();

      const duration = Date.now() - startTime;

      this.logger.log(
        `Cleanup completed: ${result.orphanedSessionsNullified} orphaned sessions nullified (${duration}ms)`,
      );
    } catch (error) {
      // Log error but don't throw - allow retry on next schedule
      this.logger.error('Failed to cleanup orphaned sessions:', error);
    }
  }

  /**
   * Manual cleanup trigger (for testing or admin operations)
   * Can be called via admin endpoint if needed
   */
  async manualCleanup(): Promise<{ orphanedSessionsNullified: number }> {
    this.logger.log('Manual cleanup triggered');

    const result = await this.repository.cleanupOrphanedSessions();

    this.logger.log(
      `Manual cleanup completed: ${result.orphanedSessionsNullified} orphaned sessions`,
    );

    return result;
  }
}
