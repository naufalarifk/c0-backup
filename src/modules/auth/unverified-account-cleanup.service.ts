import { Injectable, Logger } from '@nestjs/common';
import { and, eq, lt } from 'drizzle-orm';
import parse from 'parse-duration';

import { db } from '../../database';
import { users } from '../../database/schema';

/**
 * Service untuk membersihkan akun yang tidak diverifikasi secara berkala
 * Ini mengurangi beban pada hook dan meningkatkan performance
 */
@Injectable()
export class UnverifiedAccountCleanupService {
  private readonly logger = new Logger(UnverifiedAccountCleanupService.name);

  // Grace period dari environment variable (sama dengan konfigurasi di auth.ts)
  private readonly GRACE_PERIOD = parse(process.env.EMAIL_VERIFICATION_GRACE_PERIOD || '24h', 'millisecond')!;

  /**
   * Cleanup method yang bisa dipanggil manual atau dijadwalkan
   */
  async cleanupUnverifiedAccounts() {
    this.logger.log('Starting scheduled cleanup of unverified accounts...');

    try {
      const cutoffTime = new Date(Date.now() - this.GRACE_PERIOD);

      // Cari akun yang belum diverifikasi dan sudah melewati grace period
      const unverifiedUsers = await db.query.users.findMany({
        where: and(eq(users.emailVerified, false), lt(users.createdAt, cutoffTime)),
        columns: {
          id: true,
          email: true,
          createdAt: true,
        },
      });

      if (unverifiedUsers.length === 0) {
        this.logger.log('No unverified accounts found to cleanup');
        return;
      }

      this.logger.log(`Found ${unverifiedUsers.length} unverified accounts to cleanup`);

      // Better Auth biasanya menggunakan cascading delete, jadi kita hanya perlu hapus user
      await db
        .delete(users)
        .where(and(eq(users.emailVerified, false), lt(users.createdAt, cutoffTime)));

      this.logger.log(`Cleanup completed. Removed ${unverifiedUsers.length} unverified accounts`);

      // Log detail untuk monitoring
      unverifiedUsers.forEach(user => {
        this.logger.debug(`Cleaned up: ${user.email} (created: ${user.createdAt})`);
      });
    } catch (error) {
      this.logger.error('Error during unverified accounts cleanup:', error);
    }
  }

  /**
   * Manual cleanup method untuk testing atau emergency cleanup
   */
  async manualCleanup(olderThanHours: number = 24): Promise<{ count: number; emails: string[] }> {
    this.logger.log(`Starting manual cleanup of accounts older than ${olderThanHours} hours...`);

    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const unverifiedUsers = await db.query.users.findMany({
      where: and(eq(users.emailVerified, false), lt(users.createdAt, cutoffTime)),
      columns: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (unverifiedUsers.length > 0) {
      await db
        .delete(users)
        .where(and(eq(users.emailVerified, false), lt(users.createdAt, cutoffTime)));
    }

    const cleanedEmails = unverifiedUsers.map(user => user.email);

    this.logger.log(`Manual cleanup completed. Removed ${unverifiedUsers.length} accounts`);

    return {
      count: unverifiedUsers.length,
      emails: cleanedEmails,
    };
  }

  /**
   * Check status untuk specific email - berguna untuk debugging
   */
  async checkEmailStatus(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: {
        id: true,
        email: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return {
        status: 'available',
        message: 'Email is available for registration',
      };
    }

    if (user.emailVerified) {
      return {
        status: 'verified',
        message: 'Email is already registered and verified',
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
      };
    }

    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const hoursLeft = Math.ceil((this.GRACE_PERIOD - accountAge) / (60 * 60 * 1000));

    if (accountAge > this.GRACE_PERIOD) {
      return {
        status: 'expired',
        message: 'Unverified account has expired and will be cleaned up',
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
      };
    }

    return {
      status: 'unverified',
      message: `Email is registered but not verified. ${hoursLeft} hours left to verify.`,
      hoursLeft,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Get statistics tentang unverified accounts
   */
  async getCleanupStats() {
    const now = new Date();
    const gracePeriodCutoff = new Date(now.getTime() - this.GRACE_PERIOD);
    const soonToExpire = new Date(now.getTime() - (this.GRACE_PERIOD - 6 * 60 * 60 * 1000)); // 6 hours before expiry

    const [totalUsers, verifiedUsers, unverifiedUsers, expiredUsers, soonToExpireUsers] =
      await Promise.all([
        db.query.users.findMany().then(users => users.length),
        db.query.users
          .findMany({ where: eq(users.emailVerified, true) })
          .then(users => users.length),
        db.query.users
          .findMany({ where: eq(users.emailVerified, false) })
          .then(users => users.length),
        db.query.users
          .findMany({
            where: and(eq(users.emailVerified, false), lt(users.createdAt, gracePeriodCutoff)),
          })
          .then(users => users.length),
        db.query.users
          .findMany({
            where: and(
              eq(users.emailVerified, false),
              lt(users.createdAt, soonToExpire),
              // gte(users.createdAt, gracePeriodCutoff) // not expired yet
            ),
          })
          .then(users => users.length),
      ]);

    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      expiredUsers,
      soonToExpireUsers,
      gracePeriodHours: this.GRACE_PERIOD / (60 * 60 * 1000),
    };
  }
}
