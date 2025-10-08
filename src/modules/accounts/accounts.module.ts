import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
