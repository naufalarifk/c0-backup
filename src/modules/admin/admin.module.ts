import { Module } from '@nestjs/common';

import { AdminInstitutionsModule } from './institutions/admin-institutions.module';
import { AdminKycModule } from './kyc/admin-kyc.module';
import { AdminSettingsModule } from './settings/admin-settings.module';
import { AdminTestDataModule } from './test-data/admin-test-data.module';
import { AdminUsersModule } from './users/admin-users.module';
import { AdminWithdrawalModule } from './withdrawals/admin-withdrawal.module';

@Module({
  imports: [
    AdminKycModule,
    AdminWithdrawalModule,
    AdminInstitutionsModule,
    AdminTestDataModule,
    AdminSettingsModule,
    AdminUsersModule,
  ],
})
export class AdminModule {}
