import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AccountsModule } from '../modules/accounts/accounts.module';
import { AdminModule } from '../modules/admin/admin.module';
import { AuthConfig } from '../modules/auth/auth.config';
import { AuthModule } from '../modules/auth/auth.module';
import { BeneficiariesModule } from '../modules/beneficiaries/beneficiaries.module';
import { InstitutionsModule } from '../modules/institutions/institutions.module';
import { LoansModule } from './../modules/loans/loans.module';
import { NotificationModule } from '../modules/notifications/notification.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { SmsModule } from '../modules/sms/sms.module';
import { UsersModule } from '../modules/users/users.module';
import { WithdrawalsModule } from '../modules/withdrawals/withdrawals.module';
import { HealthcheckController } from '../shared/healthcheck.controller';
import { AppConfigService } from '../shared/services/app-config.service';
import { SharedModule } from '../shared/shared.module';
import { TestController } from '../shared/test.controller';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.docker'],
    }),

    // Shared module with common services
    SharedModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: (configService: AppConfigService) => ({
        throttlers: [configService.throttlerConfigs],
      }),
      inject: [AppConfigService],
    }),

    BullModule.forRootAsync({
      useFactory: (configService: AppConfigService) => ({
        connection: {
          ...configService.redisConfig,
        },
      }),
      inject: [AppConfigService],
    }),

    AuthModule.forRootAsync({ imports: [NotificationModule], useClass: AuthConfig }),
    NotificationsModule,
    UsersModule,
    InstitutionsModule,
    AccountsModule,
    BeneficiariesModule,
    WithdrawalsModule,
    SmsModule,
    LoansModule,
    AdminModule,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [HealthcheckController, TestController],
})
export class AppModule {}
