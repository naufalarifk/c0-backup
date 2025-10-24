import { Module } from '@nestjs/common';

import { SharedModule } from '../../../shared/shared.module';
import { AdminWalletsController } from './admin-wallets.controller';

@Module({
  imports: [SharedModule],
  controllers: [AdminWalletsController],
})
export class AdminWalletsModule {}
