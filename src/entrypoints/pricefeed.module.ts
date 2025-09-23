import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PriceFeedModule } from '../modules/pricefeed/pricefeed.module';
import { PriceFeedProcessor } from '../modules/pricefeed/pricefeed.processor';
import { AppConfigService } from '../shared/services/app-config.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.docker'],
    }),
    SharedModule,
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      useFactory(configService: AppConfigService) {
        return {
          connection: configService.redisConfig,
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 5,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
      inject: [AppConfigService],
    }),
    BullModule.registerQueue({
      name: 'pricefeedQueue',
    }),
    PriceFeedModule,
  ],
  providers: [PriceFeedProcessor],
})
export class PriceFeedEntrypointModule {}
