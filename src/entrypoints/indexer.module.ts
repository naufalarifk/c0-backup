import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IndexerModule } from '../modules/indexer/indexer.module';
import { IndexerProcessor } from '../modules/indexer/indexer.processor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.docker'],
    }),
    IndexerModule,
  ],
  providers: [IndexerProcessor],
})
export class IndexerEntrypointModule {}
