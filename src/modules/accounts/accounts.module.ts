import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { AccountsController, PortfolioController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [AccountsController, PortfolioController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
