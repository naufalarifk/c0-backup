import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { Module } from '@nestjs/common';

import { ConfigService } from '../services/config.service';

import * as schema from './schema';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');
export type DrizzleDB = NodePgDatabase<typeof schema>;

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
