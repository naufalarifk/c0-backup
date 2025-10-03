import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { NotificationModule } from '../notifications/notification.module';
import { LoanMatcherProcessor } from './loan-matcher.processor';
import { LoanMatcherService } from './loan-matcher.service';
import { LoanMatcherQueueService } from './loan-matcher-queue.service';
import { LoanMatcherStrategyFactory } from './loan-matcher-strategy.factory';
import { EnhancedLoanMatcherStrategy } from './strategies/enhanced-loan-matcher.strategy';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'loanMatcherQueue',
    }),
    SharedModule,
    NotificationModule,
  ],
  providers: [
    LoanMatcherService,
    LoanMatcherQueueService,
    LoanMatcherProcessor,
    LoanMatcherStrategyFactory,
    // Register all strategies
    EnhancedLoanMatcherStrategy,
  ],
  exports: [LoanMatcherService, LoanMatcherQueueService],
})
export class LoanMatcherModule {}
