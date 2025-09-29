import { Module } from '@nestjs/common';

import { NotificationModule } from '../../notifications/notification.module';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { AdminWithdrawalsService } from './admin-withdrawals.service';

@Module({
  imports: [NotificationModule],
  controllers: [AdminWithdrawalsController],
  providers: [AdminWithdrawalsService],
  exports: [AdminWithdrawalsService],
})
export class AdminWithdrawalModule {}
