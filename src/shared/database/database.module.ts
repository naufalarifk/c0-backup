import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { Module } from '@nestjs/common';

import { AppConfigService } from '../services/app-config.service';
import * as schema from './schema';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');
export type DrizzleDB = NodePgDatabase<typeof schema>;

@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      useFactory: (configService: AppConfigService) => configService.drizzleConfig,
      inject: [AppConfigService],
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
