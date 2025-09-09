import { Module } from '@nestjs/common';

import { AdminKycModule } from './kyc/admin-kyc.module';

@Module({
  imports: [AdminKycModule],
})
export class AdminModule {}
