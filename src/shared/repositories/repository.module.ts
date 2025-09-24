import { Module } from '@nestjs/common';

import Redis from 'ioredis';
import { Pool } from 'pg';

import { AppConfigService } from '../services/app-config.service';
import { CryptogadaiRepository } from './cryptogadai.repository';
import { InMemoryCryptogadaiRepository } from './in-memory-cryptogadai.repository';
import { PgRedisCryptogadaiRepository } from './pg-redis-cryptogadai.repository';
import { PricefeedRepository } from './pricefeed.repository';

@Module({
  providers: [
    {
      provide: CryptogadaiRepository,
      async useFactory(appConfig: AppConfigService): Promise<CryptogadaiRepository> {
        if (appConfig.databaseUrl === ':inmemory:') {
          const repo = new InMemoryCryptogadaiRepository();
          await repo.connect();
          return repo;
        }

        const pool = new Pool({
          connectionString: appConfig.databaseUrl,
          // Connection pool configuration to prevent hanging
          max: 20, // Maximum number of clients in the pool
          idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
          connectionTimeoutMillis: 5000, // Timeout after 5 seconds when connecting
          allowExitOnIdle: true, // Allow process to exit when all clients are idle
          // Add query timeout to prevent hanging queries
          query_timeout: 10000, // 10 seconds timeout for queries
          // Connection keep-alive settings
          keepAlive: true,
          keepAliveInitialDelayMillis: 0,
        });
        const redis = new Redis(appConfig.redisConfig);
        const repo = new PgRedisCryptogadaiRepository(pool, redis);
        await repo.connect();
        return repo;
      },
      inject: [AppConfigService],
    },
    {
      provide: PricefeedRepository,
      useExisting: CryptogadaiRepository,
    },
  ],
  exports: [CryptogadaiRepository, PricefeedRepository],
})
export class RepositoryModule {}
