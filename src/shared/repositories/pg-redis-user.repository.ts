import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { UserRepository } from './user.repository';

export class PgValkeyUserRepository extends UserRepository {
  #pool: Pool;
  #redis: Redis;

  constructor(pool: Pool, redis: Redis) {
    super();
    this.#pool = pool;
    this.#redis = redis;
  }

  async connect(): Promise<void> {
    const dir = 'src/shared/repositories/postgres';
    const schemaPaths = [
      '0002-user',
      '0004-notification',
      '0005-admin',
      '0005-institution',
      '0005-kyc',
    ].map(file => join(process.cwd(), dir, `${file}.sql`));

    // Wait for database to be ready
    let retries = 30;
    while (retries > 0) {
      try {
        await this.#pool.query('SELECT 1');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    for (const schemaPath of schemaPaths) {
      const schemaSqlQueries = await readFile(schemaPath, { encoding: 'utf-8' });
      await this.#pool.query(schemaSqlQueries);
    }
  }

  async close(): Promise<void> {
    await Promise.all([this.#pool.end(), this.#redis.quit()]);
  }

  // === Postgres Methods Begin ===

  async sql(query: TemplateStringsArray, ...params: unknown[]): Promise<unknown> {
    let queryText = '';
    for (let i = 0; i < query.length; i++) {
      queryText += query[i];
      if (i < params.length) {
        queryText += `$${i + 1}`;
      }
    }

    const result = await this.#pool.query(queryText, params);
    return result.rows;
  }

  async rawQuery(queryText: string, params: unknown[]): Promise<unknown> {
    const result = await this.#pool.query(queryText, params);
    return result.rows;
  }

  // === Postgres Methods End ===

  // === Redis Methods Begin ===

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.#redis.setex(key, ttl, serializedValue);
    } else {
      await this.#redis.set(key, serializedValue);
    }
  }

  async setex(key: string, seconds: number, value: unknown): Promise<void> {
    const serializedValue = JSON.stringify(value);
    await this.#redis.setex(key, seconds, serializedValue);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.#redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.#redis.ttl(key);
  }

  async persist(key: string): Promise<void> {
    await this.#redis.persist(key);
  }

  async del(key: string): Promise<void> {
    await this.#redis.del(key);
  }

  async get(key: string): Promise<unknown> {
    const value = await this.#redis.get(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // === Redis Methods End ===
}
