import { Module } from '@nestjs/common';

import Redis from 'ioredis';
import { Pool } from 'pg';

import { AppConfigService } from '../services/app-config.service';
import { CryptogadaiRepository } from './cryptogadai.repository';
import { PgRedisCryptogadaiRepository } from './pg-redis-cryptogadai-repository';

@Module({
  providers: [
    {
      provide: CryptogadaiRepository,
      async useFactory(configService: AppConfigService): Promise<CryptogadaiRepository> {
        const pool = new Pool({ connectionString: configService.databaseUrl });
        const redis = new Redis(configService.redisConfig);
        const repo = new PgRedisCryptogadaiRepository(pool, redis);
        await repo.connect();
        return repo;
      },
      inject: [AppConfigService],
    },
  ],
  exports: [CryptogadaiRepository],
})
export class RepositoryModule {}
