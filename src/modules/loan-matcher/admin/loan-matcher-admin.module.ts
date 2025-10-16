import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { RepositoryModule } from '../../../shared/repositories/repository.module';
import { AuthModule } from '../../auth/auth.module';
import { LoansModule } from '../../loans/loans.module';
import { NotificationModule } from '../../notifications/notification.module';
import { LoanMatcherController } from '../controllers/loan-matcher.controller';
import { LoanMatcherScheduler } from '../schedulers/loan-matcher.scheduler';
import { LoanMatcherService } from '../services/core/loan-matcher.service';
import { EnhancedLoanMatcherStrategy } from '../services/strategies/enhanced-loan-matcher.strategy';
import { LoanMatcherStrategyFactory } from '../services/strategies/loan-matcher-strategy.factory';

@Module({
  imports: [
    ConfigModule,
    RepositoryModule,
    ScheduleModule.forRoot(),
    DiscoveryModule,
    AuthModule,
    NotificationModule,
    forwardRef(() => LoansModule),
  ],
  controllers: [LoanMatcherController],
  providers: [
    LoanMatcherService,
    LoanMatcherScheduler,
    LoanMatcherStrategyFactory,
    EnhancedLoanMatcherStrategy,
  ],
  exports: [LoanMatcherService, LoanMatcherScheduler],
})
export class LoanMatcherAdminModule {}
