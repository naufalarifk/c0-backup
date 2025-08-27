import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { Pool } from 'pg';

import { AppConfigService } from '../services/app-config.service';
import { PgValkeyUserRepository } from './pg-redis-user.repository';
import { UserRepository } from './user.repository';

@Module({
  providers: [
    {
      provide: UserRepository,
      async useFactory(configService: AppConfigService): Promise<UserRepository> {
        const pool = new Pool({ connectionString: configService.databaseUrl });
        const redis = new Redis(configService.redisConfig);
        const userRepository = new PgValkeyUserRepository(pool, redis);
        await userRepository.connect();
        return userRepository;
      },
      inject: [AppConfigService],
    },
  ],
  exports: [UserRepository],
})
export class RepositoryModule {}
