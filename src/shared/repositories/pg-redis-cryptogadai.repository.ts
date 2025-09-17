import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Redis } from 'ioredis';
import { Pool, PoolClient } from 'pg';

import { TelemetryLogger } from '../../telemetry.logger';
import { DbRepository } from './base.repository';
import { CryptogadaiRepository } from './cryptogadai.repository';

export class PgRedisDbRepository extends DbRepository {
  private logger = new TelemetryLogger(PgRedisDbRepository.name);

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
    try {
      const normalizedParams = params.map(param => {
        if (param === undefined) return null;
        return param;
      });
      this.logger.debug('SqlQuery', { queryText, params: normalizedParams });
      const result = await this.poolClient.query(queryText, normalizedParams);
      const rows = Array.isArray(result?.rows) ? result.rows : [result.rows];
      this.logger.debug('SqlResult', { rows });
      return rows;
    } catch (error) {
      this.logger.error('SqlError', { error });
      throw error;
    }
  }

  async commitTransaction(): Promise<void> {
    try {
      await this.poolClient.query('COMMIT;');
    } finally {
      // CRITICAL: Release client back to pool after committing
      this.poolClient.release();
    }
  }

  async rollbackTransaction(): Promise<void> {
    try {
      await this.poolClient.query('ROLLBACK;');
    } finally {
      // CRITICAL: Release client back to pool after rollback
      this.poolClient.release();
    }
  }
}

export class PgRedisCryptogadaiRepository extends CryptogadaiRepository {
  #pool: Pool;
  #redis: Redis;
  #logger = new TelemetryLogger(PgRedisCryptogadaiRepository.name);

  constructor(pool: Pool, redis: Redis) {
    super();
    this.#pool = pool;
    this.#redis = redis;

    // Add pool error handling and monitoring
    this.#pool.on('error', (err, client) => {
      this.#logger.error('Unexpected error on idle client', err);
    });

    this.#pool.on('connect', _client => {
      this.#logger.debug('New client connected to database');
    });

    this.#pool.on('acquire', _client => {
      this.#logger.debug(
        `Client acquired from pool. Total: ${this.#pool.totalCount}, Idle: ${this.#pool.idleCount}, Waiting: ${this.#pool.waitingCount}`,
      );
    });

    this.#pool.on('release', (err, client) => {
      this.#logger.debug(
        `Client released to pool. Total: ${this.#pool.totalCount}, Idle: ${this.#pool.idleCount}, Waiting: ${this.#pool.waitingCount}`,
      );
    });
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

    try {
      for (const schemaPath of schemaPaths) {
        try {
          const schemaSqlQueries = await readFile(schemaPath, { encoding: 'utf-8' });
          await client.query(schemaSqlQueries);
        } catch (error) {
          this.#logger.error('Error applying schema', { schemaPath, error });
          throw error;
        }
      }
    } finally {
      // CRITICAL: Always release the client back to the pool
      client.release();
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
    try {
      const normalizedParams = params.map(function (param) {
        if (param === undefined) return null;
        return param;
      });
      this.#logger.debug('SQL QUERY', queryText, normalizedParams);

      // Add query timeout to prevent hanging
      const queryPromise = this.#pool.query(queryText, normalizedParams);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000);
      });

      const result = await Promise.race([queryPromise, timeoutPromise]);
      const rows = Array.isArray(result?.rows) ? result.rows : [result.rows];
      this.#logger.debug('SQL RESULT', rows);
      return rows;
    } catch (error) {
      this.#logger.error('SQL ERROR', error);
      throw error;
    }
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
