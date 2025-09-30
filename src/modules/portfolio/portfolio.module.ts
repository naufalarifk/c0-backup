import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/accounts.module';
import { PortfolioController } from './portfolio.controller';

@Module({
  imports: [AccountsModule],
  controllers: [PortfolioController],
})
export class PortfolioModule {}
