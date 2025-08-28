import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import invariant from 'tiny-invariant';

export class RedisTestContainer {
  private static instance: RedisTestContainer;
  private container: StartedRedisContainer | null = null;

  private constructor() {}

  static getInstance(): RedisTestContainer {
    if (!RedisTestContainer.instance) {
      RedisTestContainer.instance = new RedisTestContainer();
    }
    return RedisTestContainer.instance;
  }

  async start(): Promise<StartedRedisContainer> {
    if (this.container) {
      return this.container;
    }

    const redisContainer = new RedisContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withPassword('');
    // .withLogConsumer(stream => {
    //   stream.on('data', line => console.log(`[REDIS] ${line}`));
    //   stream.on('err', line => console.error(`[REDIS ERR] ${line}`));
    // });

    this.container = await redisContainer.start();

    // console.log(`Redis testcontainer started on port: ${this.container.getMappedPort(6379)}`);

    return this.container;
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
      this.container = null;
      console.log('Redis testcontainer stopped');
    }
  }

  getConnectionString(): string {
    invariant(this.container, 'Redis container not started');

    return `redis://localhost:${this.container.getMappedPort(6379)}`;
  }

  getHost(): string {
    return this.container?.getHost() || 'localhost';
  }

  getPort(): number {
    invariant(this.container, 'Redis container not started');

    return this.container.getMappedPort(6379);
  }

  getPassword(): string {
    invariant(this.container, 'Redis container not started');

    return this.container.getPassword();
  }
}
