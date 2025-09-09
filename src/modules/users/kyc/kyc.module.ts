import { Module } from '@nestjs/common';

import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycFileService } from './kyc-file.service';

@Module({
  controllers: [KycController],
  providers: [KycService, KycFileService],
  exports: [KycService, KycFileService],
})
export class KycModule {}
