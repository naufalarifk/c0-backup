import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AuthConfig } from './modules/auth/auth.config';
import { AuthModule } from './modules/auth/auth.module';
import { BlockchainsModule } from './modules/blockchains/blockchains.module';
import { AppConfigService } from './shared/services/app-config.service';
import { SharedModule } from './shared/shared.module';

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

    // Authentication
    AuthModule.forRootAsync({ useClass: AuthConfig }),

    BlockchainsModule,
  ],
  controllers: [AppController],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
