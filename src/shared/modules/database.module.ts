import { Module } from '@nestjs/common';

import { ConfigService } from '../services/config.service';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.drizzleConfig,
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
