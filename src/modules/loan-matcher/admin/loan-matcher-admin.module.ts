import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { RepositoryModule } from '../../../shared/repositories/repository.module';
import { AuthModule } from '../../auth/auth.module';
import { LoanMatcherController } from '../controllers/loan-matcher.controller';
import { LoanMatcherScheduler } from '../schedulers/loan-matcher.scheduler';
import { LoanMatcherService } from '../services/core/loan-matcher.service';

@Module({
  imports: [ConfigModule, RepositoryModule, ScheduleModule.forRoot(), AuthModule],
  controllers: [LoanMatcherController],
  providers: [LoanMatcherService, LoanMatcherScheduler],
  exports: [LoanMatcherService, LoanMatcherScheduler],
})
export class LoanMatcherAdminModule {}
