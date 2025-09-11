import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { HealthcheckController } from './healthcheck.controller';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthConfig } from './modules/auth/auth.config';
import { AuthModule } from './modules/auth/auth.module';
import { BlockchainsModule } from './modules/blockchains/blockchains.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { UsersModule } from './modules/users/users.module';
import { AppConfigService } from './shared/services/app-config.service';
import { SharedModule } from './shared/shared.module';
import { TestController } from './test.controller';

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

    EventEmitterModule.forRoot(),

    AuthModule.forRootAsync({ useClass: AuthConfig }),
    UsersModule,
    AccountsModule,
    BlockchainsModule,
    AdminModule,
    InstitutionsModule,
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
