import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

import { KycIndividualModule } from './individual/kyc-individual.module';
import { KycInstitutionModule } from './institution/kyc-institution.module';

@Module({
  imports: [
    KycIndividualModule,
    KycInstitutionModule,
    RouterModule.register([
      {
        path: 'kyc',
        module: KycModule,
        children: [KycIndividualModule, KycInstitutionModule],
      },
    ]),
  ],
})
export class KycModule {}
