import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PricefeedModule } from '../modules/pricefeed/pricefeed.module';
import { PricefeedScheduler } from '../modules/pricefeed/pricefeed.scheduler';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.docker'],
    }),
    SharedModule,
    PricefeedModule,
  ],
  providers: [PricefeedScheduler],
})
export class PriceFeedEntrypointModule {}
