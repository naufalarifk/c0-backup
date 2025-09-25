import { Module } from '@nestjs/common';

import { SharedModule } from '../../../shared/shared.module';
import { AdminInstitutionsController } from './admin-institutions.controller';

@Module({
  imports: [SharedModule],
  controllers: [AdminInstitutionsController],
})
export class AdminInstitutionsModule {}
