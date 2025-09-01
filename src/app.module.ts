import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthConfig } from './modules/auth/auth.config';
import { AuthModule } from './modules/auth/auth.module';
import { BlockchainsModule } from './modules/blockchains/blockchains.module';
import { ConfigService } from './shared/services/config.service';
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
      useFactory: (configService: ConfigService) => ({
        throttlers: [configService.throttlerConfigs],
      }),
      inject: [ConfigService],
    }),

    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          ...configService.redisConfig,
        },
      }),
      inject: [ConfigService],
    }),

    EventEmitterModule.forRoot(),

    // Authentication
    AuthModule.forRootAsync({ useClass: AuthConfig }),

    BlockchainsModule,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
