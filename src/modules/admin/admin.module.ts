import { Module } from '@nestjs/common';

import { AdminInstitutionsModule } from './institutions/admin-institutions.module';
import { AdminKycModule } from './kyc/admin-kyc.module';
import { AdminWithdrawalModule } from './withdrawals/admin-withdrawal.module';

@Module({
  imports: [AdminKycModule, AdminWithdrawalModule, AdminInstitutionsModule],
})
export class AdminModule {}
