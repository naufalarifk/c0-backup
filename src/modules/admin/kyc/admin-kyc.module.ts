import { Module } from '@nestjs/common';

import { AdminKycController } from './admin-kyc.controller';

@Module({
  controllers: [AdminKycController],
})
export class AdminKycModule {}
