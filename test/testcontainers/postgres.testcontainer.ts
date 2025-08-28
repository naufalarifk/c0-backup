import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import invariant from 'tiny-invariant';

export class PostgresTestContainer {
  private static instance: PostgresTestContainer;
  private container: StartedPostgreSqlContainer | null = null;

  private constructor() {}

  static getInstance(): PostgresTestContainer {
    if (!PostgresTestContainer.instance) {
      PostgresTestContainer.instance = new PostgresTestContainer();
    }
    return PostgresTestContainer.instance;
  }

  async start(): Promise<StartedPostgreSqlContainer> {
    if (this.container) {
      return this.container;
    }

    const postgresContainer = new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .withExposedPorts(5432);
    // .withLogConsumer(stream => {
    //   stream.on('data', line => console.log(`[POSTGRES] ${line}`));
    //   stream.on('err', line => console.error(`[POSTGRES ERR] ${line}`));
    // });

    this.container = await postgresContainer.start();

    // console.log(`PostgreSQL testcontainer started on port: ${this.container.getMappedPort(5432)}`);

    return this.container;
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
      this.container = null;
      console.log('PostgreSQL testcontainer stopped');
    }
  }

  getConnectionString(): string {
    invariant(this.container, 'PostgreSQL container not started');

    return `postgresql://test_user:test_password@localhost:${this.container.getMappedPort(5432)}/test_db`;
  }

  getHost(): string {
    return this.container?.getHost() || 'localhost';
  }

  getPort(): number {
    invariant(this.container, 'PostgreSQL container not started');

    return this.container.getMappedPort(5432);
  }

  getDatabase(): string {
    return 'test_db';
  }

  getUsername(): string {
    return 'test_user';
  }

  getPassword(): string {
    return 'test_password';
  }
}
