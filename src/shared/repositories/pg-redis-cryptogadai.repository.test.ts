import type { RedisService } from '../services/redis.service';

import Redis from 'ioredis';
import { Pool } from 'pg';
import { GenericContainer } from 'testcontainers';
import { LogWaitStrategy } from 'testcontainers/build/wait-strategies/log-wait-strategy';

import { RedisService } from '../services/redis.service';
import { runBaseRepositoryTestSuite } from './base.repository-test-suite';
import { PgRedisCryptogadaiRepository } from './pg-redis-cryptogadai.repository';

runBaseRepositoryTestSuite(
  async function createRepo() {
    const postgresPort = 5000 + Math.floor(Math.random() * 10000);
    const redisPort = 15000 + Math.floor(Math.random() * 10000);
    const [postgres, redis] = await Promise.all([
      new GenericContainer('postgres:17-alpine')
        .withAutoRemove(true)
        .withEnvironment({
          POSTGRES_HOST_AUTH_METHOD: 'trust',
        })
        .withExposedPorts({
          container: 5432,
          host: postgresPort,
        })
        .withWaitStrategy(new LogWaitStrategy('database system is ready to accept connections', 2))
        // .withLogConsumer(function (stream) { stream.pipe(process.stdout); })
        .start(),
      new GenericContainer('valkey/valkey:8-alpine')
        .withAutoRemove(true)
        .withExposedPorts({
          container: 6379,
          host: redisPort,
        })
        .withWaitStrategy(new LogWaitStrategy('Ready to accept connections tcp', 1))
        // .withLogConsumer(function (stream) { stream.pipe(process.stdout); })
        .start(),
    ]);
    const pgPool = new Pool({
      host: 'localhost',
      port: postgresPort,
      user: 'postgres',
      database: 'postgres',
    });
    const redisClient = new Redis({
      host: 'localhost',
      port: redisPort,
    });
    const repo = new PgRedisCryptogadaiRepository(pgPool, redisClient as unknown as RedisService);
    await repo.connect();
    await repo.migrate();
    const originalClose = PgRedisCryptogadaiRepository.prototype.close;
    PgRedisCryptogadaiRepository.prototype.close = async function () {
      await Promise.all([originalClose.apply(this), postgres.stop(), redis.stop()]);
    };
    return repo;
  },
  async function teardownRepo(repo) {
    await repo.close();
  },
);
