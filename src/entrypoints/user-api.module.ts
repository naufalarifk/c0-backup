import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AccountsModule } from '../modules/accounts/accounts.module';
import { AdminModule } from '../modules/admin/admin.module';
import { AuthConfig } from '../modules/auth/auth.config';
import { AuthModule } from '../modules/auth/auth.module';
import { BeneficiariesModule } from '../modules/beneficiaries/beneficiaries.module';
import { FinanceConfigModule } from '../modules/finance-config/finance-config.module';
import { InstitutionsModule } from '../modules/institutions/institutions.module';
import { LoanMatcherModule } from '../modules/loan-matcher/loan-matcher.module';
import { LoansModule } from './../modules/loans/loans.module';
import { NotificationModule } from '../modules/notifications/notification.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { PortfolioModule } from '../modules/portfolio/portfolio.module';
import { RealtimeModule } from '../modules/realtime/realtime.module';
import { SmsModule } from '../modules/sms/sms.module';
import { TestModule } from '../modules/test/test.module';
import { UsersModule } from '../modules/users/users.module';
import { WithdrawalsModule } from '../modules/withdrawals/withdrawals.module';
import { HealthcheckController } from '../shared/healthcheck.controller';
import { AppConfigService } from '../shared/services/app-config.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SharedModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: (configService: AppConfigService) => ({
        throttlers: [configService.throttlerConfigs],
      }),
      inject: [AppConfigService],
    }),

    AuthModule.forRootAsync({ imports: [NotificationModule], useClass: AuthConfig }),
    NotificationModule,
    NotificationsModule,
    UsersModule,
    InstitutionsModule,
    AccountsModule,
    PortfolioModule,
    BeneficiariesModule,
    FinanceConfigModule,
    WithdrawalsModule,
    RealtimeModule,
    SmsModule,
    LoansModule,
    LoanMatcherModule,
    AdminModule,
    TestModule,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [HealthcheckController],
})
export class AppModule {}
