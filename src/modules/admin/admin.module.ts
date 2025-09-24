import { Module } from '@nestjs/common';

import { AdminKycModule } from './kyc/admin-kyc.module';
import { AdminWithdrawalModule } from './withdrawals/admin-withdrawal.module';

@Module({
  imports: [AdminKycModule, AdminWithdrawalModule],
})
export class AdminModule {}
