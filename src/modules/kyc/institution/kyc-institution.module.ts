import { Module } from '@nestjs/common';

import { KycInstitutionController } from './kyc-institution.controller';
import { KycInstitutionService } from './kyc-institution.service';

@Module({
  controllers: [KycInstitutionController],
  providers: [KycInstitutionService],
})
export class KycInstitutionModule {}
