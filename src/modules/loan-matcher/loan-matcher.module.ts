import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { SharedModule } from '../../shared/shared.module';
import { LoansModule } from '../loans/loans.module';
import { NotificationModule } from '../notifications/notification.module';
import { LoanMatcherTestController } from './controllers/loan-matcher-test.controller';
import { LoanMatcherScheduler } from './schedulers/loan-matcher.scheduler';
import { LoanMatcherService } from './services/loan-matcher.service';
import { EnhancedLoanMatcherStrategy } from './strategies/enhanced-loan-matcher.strategy';
import { LoanMatcherStrategyFactory } from './strategies/loan-matcher-strategy.factory';

/**
 * LoanMatcherModule
 *
 * This module provides loan matching functionality using a cron-based scheduler approach.
 * Matching runs on a scheduled interval (hourly by default) and can be manually triggered
 * via admin API endpoints.
 *
 * **Architecture:**
 * - Cron scheduler: Automatically runs matching every hour
 * - Admin API: Manual trigger endpoints at /admin/loan-matcher
 * - Test API: Testing endpoints at /test/loan-matcher
 *
 * **Deprecated:**
 * - Queue-based matching (LoanMatcherQueueService, LoanMatcherProcessor) has been removed
 * - Use the scheduler pattern for all matching operations
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Required for @Cron decorators
    DiscoveryModule,
    SharedModule,
    NotificationModule,
    forwardRef(() => LoansModule),
  ],
  controllers: [LoanMatcherTestController], // Test endpoints for E2E testing
  providers: [
    LoanMatcherService,
    LoanMatcherStrategyFactory,
    LoanMatcherScheduler,
    // Register all strategies
    EnhancedLoanMatcherStrategy,
  ],
  exports: [LoanMatcherService, LoanMatcherScheduler],
})
export class LoanMatcherModule {}
