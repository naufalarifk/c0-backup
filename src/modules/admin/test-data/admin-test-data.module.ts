import { Module } from '@nestjs/common';

import { SharedModule } from '../../../shared/shared.module';
import { AdminTestDataController } from './admin-test-data.controller';

@Module({
  imports: [SharedModule],
  controllers: [AdminTestDataController],
})
export class AdminTestDataModule {}
