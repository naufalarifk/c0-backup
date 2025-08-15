import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { UnverifiedAccountCleanupService } from './unverified-account-cleanup.service';

@Controller('auth/email-ownership')
export class EmailOwnershipController {
  constructor(private readonly cleanupService: UnverifiedAccountCleanupService) {}

  /**
   * Check status email tertentu
   */
  @Get('status')
  async checkEmailStatus(@Query('email') email: string) {
    if (!email) {
      return {
        status: 'error',
        message: 'Email parameter is required',
      };
    }

    return await this.cleanupService.checkEmailStatus(email);
  }

  /**
   * Manual cleanup unverified accounts
   */
  @Post('cleanup')
  async manualCleanup(@Body() body: { olderThanHours?: number }) {
    const { olderThanHours = 24 } = body;

    if (olderThanHours < 1) {
      return {
        status: 'error',
        message: 'olderThanHours must be at least 1',
      };
    }

    const result = await this.cleanupService.manualCleanup(olderThanHours);

    return {
      message: `Successfully cleaned up ${result.count} unverified accounts`,
      cleanedCount: result.count,
      cleanedEmails: result.emails,
    };
  }

  /**
   * Get cleanup statistics
   */
  @Get('stats')
  async getStats() {
    const stats = await this.cleanupService.getCleanupStats();

    return {
      ...stats,
      timestamp: new Date().toISOString(),
      message: 'Email ownership statistics',
    };
  }

  /**
   * Trigger scheduled cleanup manually
   */
  @Post('run-cleanup')
  async runScheduledCleanup() {
    await this.cleanupService.cleanupUnverifiedAccounts();

    return {
      message: 'Scheduled cleanup completed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
