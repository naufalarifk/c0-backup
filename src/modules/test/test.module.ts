import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { LoanMatcherModule } from '../loan-matcher/loan-matcher.module';
import { LoansModule } from '../loans/loans.module';
import { NotificationModule } from '../notifications/notification.module';
import { AccountingTestController } from './accounting-test.controller';
import { AdminTestController } from './admin-test.controller';
import { BlockchainTestController } from './blockchain-test.controller';
import { FinanceTestController } from './finance-test.controller';
import { LoanTestController } from './loan-test.controller';
import { NotificationTestController } from './notification-test.controller';
import { PricefeedTestController } from './pricefeed-test.controller';
import { UserTestController } from './user-test.controller';
import { WithdrawalTestController } from './withdrawal-test.controller';

@Module({
  imports: [SharedModule, LoansModule, LoanMatcherModule, NotificationModule],
  controllers: [
    UserTestController,
    AdminTestController,
    AccountingTestController,
    FinanceTestController,
    LoanTestController,
    NotificationTestController,
    PricefeedTestController,
    BlockchainTestController,
    WithdrawalTestController,
  ],
})
export class TestModule {}
