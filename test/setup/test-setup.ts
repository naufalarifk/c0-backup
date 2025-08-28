import Redis from 'ioredis';
import { Pool } from 'pg';

import { PgValkeyUserRepository } from '../../src/shared/repositories/pg-redis-user.repository';
import { PostgresTestContainer } from '../testcontainers/postgres.testcontainer';
import { RedisTestContainer } from '../testcontainers/redis.testcontainer';

export class TestSetup {
  private static postgresContainer: PostgresTestContainer;
  private static redisContainer: RedisTestContainer;

  static async setupTestContainers(): Promise<{
    postgres: { host: string; port: number; database: string; username: string; password: string };
    redis: { host: string; port: number };
  }> {
    // console.log('Starting test containers...');

    // Initialize containers
    TestSetup.postgresContainer = PostgresTestContainer.getInstance();
    TestSetup.redisContainer = RedisTestContainer.getInstance();

    // Start containers in parallel
    await Promise.all([TestSetup.postgresContainer.start(), TestSetup.redisContainer.start()]);

    // Apply database schema after PostgreSQL is ready
    TestSetup.applyDatabaseSchema();

    // console.log('Test containers started successfully');

    return {
      postgres: {
        host: TestSetup.postgresContainer.getHost(),
        port: TestSetup.postgresContainer.getPort(),
        database: TestSetup.postgresContainer.getDatabase(),
        username: TestSetup.postgresContainer.getUsername(),
        password: TestSetup.postgresContainer.getPassword(),
      },
      redis: {
        host: TestSetup.redisContainer.getHost(),
        port: TestSetup.redisContainer.getPort(),
      },
    };
  }

  static async teardownTestContainers(): Promise<void> {
    console.log('Stopping test containers...');

    await Promise.all([TestSetup.postgresContainer?.stop(), TestSetup.redisContainer?.stop()]);

    console.log('Test containers stopped successfully');
  }

  static getPostgresConnectionString(): string {
    return TestSetup.postgresContainer.getConnectionString();
  }

  static getRedisConnectionString(): string {
    return TestSetup.redisContainer.getConnectionString();
  }

  static getRedisConfig() {
    return {
      host: TestSetup.redisContainer.getHost(),
      port: TestSetup.redisContainer.getPort(),
      password: TestSetup.redisContainer.getPassword(),
    };
  }

  private static applyDatabaseSchema() {
    const client = new Pool({
      host: TestSetup.postgresContainer.getHost(),
      port: TestSetup.postgresContainer.getPort(),
      database: TestSetup.postgresContainer.getDatabase(),
      user: TestSetup.postgresContainer.getUsername(),
      password: TestSetup.postgresContainer.getPassword(),
    });

    const redis = new Redis(this.getRedisConfig());

    new PgValkeyUserRepository(client, redis);
  }
}
