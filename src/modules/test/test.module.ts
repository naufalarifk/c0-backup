import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { LoanMatcherModule } from '../loan-matcher/loan-matcher.module';
import { LoansModule } from '../loans/loans.module';
import { NotificationModule } from '../notifications/notification.module';
import { AccountingTestController } from './accounting-test.controller';
import { AdminTestController } from './admin-test.controller';
import { BlockchainTestController } from './blockchain-test.controller';
import { LoanTestController } from './loan-test.controller';
import { PricefeedTestController } from './pricefeed-test.controller';
import { UserTestController } from './user-test.controller';
import { WithdrawalTestController } from './withdrawal-test.controller';

@Module({
  imports: [SharedModule, LoansModule, LoanMatcherModule, NotificationModule],
  controllers: [
    UserTestController,
    AdminTestController,
    AccountingTestController,
    LoanTestController,
    PricefeedTestController,
    BlockchainTestController,
    WithdrawalTestController,
  ],
})
export class TestModule {}
