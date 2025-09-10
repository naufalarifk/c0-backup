import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { Client } from 'pg';

import MailContainer from './mail-container';

export class TestContainerSetup {
  private static redisContainer: StartedRedisContainer;
  private static postgresContainer: StartedPostgreSqlContainer;
  private static mailContainer: MailContainer;

  static redisClient: Redis;
  static pgClient: Client;

  static async startContainers(): Promise<void> {
    console.log('🚀 Starting test containers...');

    // Start all containers in parallel
    const [redisContainer, postgresContainer] = await Promise.all([
      new RedisContainer('redis:7-alpine').withExposedPorts(6379).start(),
      new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('test_db')
        .withUsername('test_user')
        .withPassword('test_password')
        .withExposedPorts(5432)
        .start(),
    ]);

    this.redisContainer = redisContainer;
    this.postgresContainer = postgresContainer;

    // Start Mailpit container
    this.mailContainer = new MailContainer();
    await this.mailContainer.start();

    // Create Redis client with better timeout settings
    this.redisClient = new Redis({
      host: this.redisContainer.getHost(),
      port: this.redisContainer.getMappedPort(6379),
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    // Create PostgreSQL client
    this.pgClient = new Client({
      host: this.postgresContainer.getHost(),
      port: this.postgresContainer.getMappedPort(5432),
      database: this.postgresContainer.getDatabase(),
      user: this.postgresContainer.getUsername(),
      password: this.postgresContainer.getPassword(),
    });

    await this.pgClient.connect();

    console.log('✅ Test containers started successfully');
  }

  static async stopContainers(): Promise<void> {
    console.log('🛑 Stopping test containers...');

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    if (this.pgClient) {
      await this.pgClient.end();
    }

    if (this.mailContainer) {
      await this.mailContainer.stop();
    }

    if (this.redisContainer) {
      await this.redisContainer.stop();
    }

    if (this.postgresContainer) {
      await this.postgresContainer.stop();
    }

    console.log('✅ Test containers stopped successfully');
  }

  static getRedisConnectionString(): string {
    if (!this.redisContainer) {
      throw new Error('Redis container not started. Call startContainers() first.');
    }
    return `redis://${this.redisContainer.getHost()}:${this.redisContainer.getMappedPort(6379)}`;
  }

  static async ensureContainersStarted(): Promise<void> {
    if (!this.postgresContainer || !this.redisContainer || !this.mailContainer) {
      await this.startContainers();
    }
  }

  static getPostgresConnectionString(): string {
    if (!this.postgresContainer) {
      throw new Error('PostgreSQL container not started. Call startContainers() first.');
    }
    return `postgresql://${this.postgresContainer.getUsername()}:${this.postgresContainer.getPassword()}@${this.postgresContainer.getHost()}:${this.postgresContainer.getMappedPort(5432)}/${this.postgresContainer.getDatabase()}`;
  }

  static getRedisConfig() {
    if (!this.redisContainer) {
      throw new Error('Redis container not started. Call startContainers() first.');
    }
    return {
      host: this.redisContainer.getHost(),
      port: this.redisContainer.getMappedPort(6379),
      password: this.redisContainer.getPassword(),
      connectTimeout: 5000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    };
  }

  static getMailContainer(): MailContainer {
    if (!this.mailContainer) {
      throw new Error('Mail container not started. Call startContainers() first.');
    }
    return this.mailContainer;
  }

  static getMailConfig() {
    if (!this.mailContainer) {
      throw new Error('Mail container not started. Call startContainers() first.');
    }
    return {
      host: this.mailContainer.getHost(),
      smtpPort: this.mailContainer.getSmtpPort(),
      httpPort: this.mailContainer.getHttpPort(),
    };
  }
}
