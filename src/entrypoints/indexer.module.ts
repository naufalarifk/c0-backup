import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IndexerModule } from '../modules/indexer/indexer.module';
import { IndexerProcessor } from '../modules/indexer/indexer.processor';
import { AppConfigService } from '../shared/services/app-config.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.docker'],
    }),
    SharedModule,
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
    IndexerModule,
  ],
  providers: [IndexerProcessor],
})
export class IndexerEntrypointModule {}
