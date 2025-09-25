import { Module } from '@nestjs/common';

import { InstitutionApplicationsController } from './institution-applications.controller';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';

@Module({
  providers: [InstitutionsService],
  controllers: [InstitutionsController, InstitutionApplicationsController],
})
export class InstitutionsModule {}
