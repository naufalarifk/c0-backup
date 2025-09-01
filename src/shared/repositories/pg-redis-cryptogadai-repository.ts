import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Redis } from 'ioredis';
import { Pool, PoolClient } from 'pg';

import { DbRepository } from './base-repository';
import { CryptogadaiRepository } from './cryptogadai.repository';

export class PgRedisDbRepository extends DbRepository {
  constructor(private poolClient: PoolClient) {
    super();
  }
  async sql(query: TemplateStringsArray, ...params: unknown[]): Promise<Array<unknown>> {
    let queryText = '';
    for (let index = 0; index < query.length; index++) {
      queryText += query[index];
      if (index < params.length) {
        queryText += `$${index + 1}`;
      }
    }
    return await this.rawQuery(queryText, params);
  }

  async rawQuery(queryText: string, params: unknown[]): Promise<Array<unknown>> {
    // console.debug('SQL', queryText, params);
    const result = await this.poolClient.query(queryText, params);
    return result.rows;
  }

  async commitTransaction(): Promise<void> {
    await this.poolClient.query('COMMIT;');
  }

  async rollbackTransaction(): Promise<void> {
    await this.poolClient.query('ROLLBACK;');
  }
}

export class PgRedisCryptogadaiRepository extends CryptogadaiRepository {
  #pool: Pool;
  #redis: Redis;

  constructor(pool: Pool, redis: Redis) {
    super();
    this.#pool = pool;
    this.#redis = redis;
  }

  async connect(): Promise<void> {
    /**
     * use __dirname to get relative path of current file
     */
    const schemaPaths = [
      join(__dirname, './postgres/0002-user.sql'),
      join(__dirname, './postgres/0004-notification.sql'),
      join(__dirname, './postgres/0005-admin.sql'),
      join(__dirname, './postgres/0005-institution.sql'),
      join(__dirname, './postgres/0005-kyc.sql'),
      join(__dirname, './postgres/0006-platform.sql'),
      join(__dirname, './postgres/0007-blockchain.sql'),
      join(__dirname, './postgres/0008-finance.sql'),
      join(__dirname, './postgres/0009-price-feed.sql'),
      join(__dirname, './postgres/0010-invoice.sql'),
      join(__dirname, './postgres/0011-loan.sql'),
      join(__dirname, './postgres/0012-withdrawal.sql'),
    ];

    const client = await this.#pool.connect();

    for (const schemaPath of schemaPaths) {
      const schemaSqlQueries = await readFile(schemaPath, { encoding: 'utf-8' });
      await client.query(schemaSqlQueries);
    }
  }

  async close(): Promise<void> {
    await Promise.all([this.#pool.end(), this.#redis.quit()]);
  }

  // === Postgres Methods Begin ===

  async sql(query: TemplateStringsArray, ...params: unknown[]): Promise<Array<unknown>> {
    let queryText = '';
    for (let index = 0; index < query.length; index++) {
      queryText += query[index];
      if (index < params.length) {
        queryText += `$${index + 1}`;
      }
    }
    return await this.rawQuery(queryText, params);
  }

  async rawQuery(queryText: string, params: unknown[]): Promise<Array<unknown>> {
    const result = await this.#pool.query(
      queryText,
      params.map(function (param) {
        if (typeof param === 'boolean') {
          return param ? 1 : 0;
        } else {
          return param;
        }
      }),
    );
    return result.rows;
  }

  async beginTransaction(): Promise<PgRedisDbRepository> {
    const pgClient = await this.#pool.connect();
    await pgClient.query('BEGIN;');
    return new PgRedisDbRepository(pgClient);
  }

  commitTransaction(): Promise<void> {
    throw new Error(
      'Method not implemented. Use the PgRedisDbRepository instance returned by beginTransaction() instead.',
    );
  }

  rollbackTransaction(): Promise<void> {
    throw new Error(
      'Method not implemented. Use the PgRedisDbRepository instance returned by beginTransaction() instead.',
    );
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
