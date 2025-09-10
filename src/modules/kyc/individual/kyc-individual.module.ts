import { Module } from '@nestjs/common';

import { KycIndividualController } from './kyc-individual.controller';
import { KycIndividualService } from './kyc-individual.service';

@Module({
  providers: [KycIndividualService],
  controllers: [KycIndividualController],
})
export class KycIndividualModule {}
