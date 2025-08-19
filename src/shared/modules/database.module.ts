import { Module } from '@nestjs/common';

import { ConfigService } from '../services/config.service';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: (configService: ConfigService) => configService.drizzleConfig,
      inject: [ConfigService],
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
