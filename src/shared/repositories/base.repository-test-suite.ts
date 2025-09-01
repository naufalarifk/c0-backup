import { rejects } from 'node:assert';
import { equal, ok, throws } from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, suite } from 'node:test';

import { BaseRepository } from './base.repository';

export async function runBaseRepositoryTestSuite(
  createRepo: () => Promise<BaseRepository>,
  teardownRepo: (repo: BaseRepository) => Promise<void>,
): Promise<void> {
  await suite('BaseRepository', function () {
    let repo: BaseRepository;

    beforeEach(async function () {
      repo = await createRepo();
    });

    afterEach(async function () {
      await teardownRepo(repo);
    });

    describe('SQL Operations', function () {
      describe('Basic Query Execution', function () {
        it('should execute a simple query and return it as rows', async function () {
          const rows = await repo.sql`SELECT 1 + 1 AS result LIMIT 1`;
          ok(Array.isArray(rows));
        });

        it('should execute queries with no results', async function () {
          const rows = await repo.sql`SELECT 1 AS result WHERE 1 = 0`;
          ok(Array.isArray(rows));
          equal(rows.length, 0);
        });
      });

      describe('Parameter Type Handling', function () {
        beforeEach(async function () {
          await repo.sql`
            CREATE TEMPORARY TABLE test_params (
              id SERIAL PRIMARY KEY,
              str_val TEXT,
              num_val NUMERIC,
              int_val INTEGER,
              bool_val BOOLEAN,
              date_val TIMESTAMP,
              nullable_val TEXT
            )
          `;
        });

        it('should handle string parameters', async function () {
          const testString = 'Hello World';
          await repo.sql`
            INSERT INTO test_params (str_val) VALUES (${testString})
          `;

          const rows = (await repo.sql`
            SELECT str_val FROM test_params WHERE str_val = ${testString}
          `) as Array<{ str_val: string }>;

          equal(rows.length, 1);
          equal(rows[0].str_val, testString);
        });

        it('should handle number parameter as input and string as output', async function () {
          const testNumber = 42.5;
          await repo.sql`
            INSERT INTO test_params (num_val) VALUES (${testNumber})
          `;

          const rows = (await repo.sql`
            SELECT num_val FROM test_params WHERE num_val = ${testNumber}
          `) as Array<{ num_val: number }>;

          equal(rows.length, 1);
          equal(rows[0].num_val, `${testNumber}`);
        });

        it('should handle integer parameters', async function () {
          const testInt = 123;
          await repo.sql`
            INSERT INTO test_params (int_val) VALUES (${testInt})
          `;

          const rows = (await repo.sql`
            SELECT int_val FROM test_params WHERE int_val = ${testInt}
          `) as Array<{ int_val: number }>;

          equal(rows.length, 1);
          equal(rows[0].int_val, testInt);
        });

        it('should handle boolean parameters', async function () {
          const testBool = true;
          await repo.sql`
            INSERT INTO test_params (bool_val) VALUES (${testBool})
          `;

          const rows = (await repo.sql`
            SELECT bool_val FROM test_params WHERE bool_val = ${testBool}
          `) as Array<{ bool_val: boolean }>;

          equal(rows.length, 1);
          equal(rows[0].bool_val, testBool);
        });

        it('should handle Date parameters correctly and return exact Date regardless of timezone', async function () {
          const testDate = new Date('2024-01-15T10:30:45.123Z');

          await repo.sql`
            INSERT INTO test_params (date_val) VALUES (${testDate})
          `;

          const rows = (await repo.sql`
            SELECT date_val FROM test_params WHERE date_val = ${testDate}
          `) as Array<{ date_val: Date }>;

          ok(Array.isArray(rows));
          ok(rows.length === 1);
          ok(rows[0].date_val instanceof Date);

          const retrievedDate = rows[0].date_val;
          ok(
            retrievedDate.getTime() === testDate.getTime(),
            `Expected ${testDate.toISOString()}, got ${retrievedDate.toISOString()}`,
          );
        });

        it('should handle null parameters', async function () {
          const testNull = null;
          await repo.sql`
            INSERT INTO test_params (nullable_val) VALUES (${testNull})
          `;

          const rows = (await repo.sql`
            SELECT nullable_val FROM test_params WHERE nullable_val IS NULL
          `) as Array<{ nullable_val: string | null }>;

          equal(rows.length, 1);
          equal(rows[0].nullable_val, null);
        });

        it('should handle undefined parameters as null', async function () {
          const testUndefined = undefined;
          await repo.sql`
            INSERT INTO test_params (nullable_val) VALUES (${testUndefined})
          `;

          const rows = (await repo.sql`
            SELECT nullable_val FROM test_params WHERE nullable_val IS NULL
          `) as Array<{ nullable_val: string | null }>;

          equal(rows.length, 1);
          equal(rows[0].nullable_val, null);
        });

        it('should handle multiple parameters in single query', async function () {
          const str = 'test';
          const num = 42;
          const bool = true;
          const date = new Date('2024-01-01T00:00:00Z');

          await repo.sql`
            INSERT INTO test_params (str_val, num_val, bool_val, date_val) 
            VALUES (${str}, ${num}, ${bool}, ${date})
          `;

          const rows = (await repo.sql`
            SELECT * FROM test_params 
            WHERE str_val = ${str} AND num_val = ${num} AND bool_val = ${bool}
          `) as Array<{
            str_val: string;
            num_val: number;
            bool_val: boolean;
            date_val: Date;
          }>;

          equal(rows.length, 1);
          equal(rows[0].str_val, str);
          equal(rows[0].num_val, `${num}`);
          equal(rows[0].bool_val, bool);
          equal(rows[0].date_val.getTime(), date.getTime());
        });
      });

      describe('SQL Injection Protection', function () {
        beforeEach(async function () {
          await repo.sql`
            CREATE TEMPORARY TABLE test_security (
              id SERIAL PRIMARY KEY,
              name TEXT,
              value INTEGER
            )
          `;

          await repo.sql`
            INSERT INTO test_security (name, value) VALUES ('safe', 100)
          `;
        });

        it('should protect against SQL injection in string parameters', async function () {
          const maliciousInput = "'; DROP TABLE test_security; --";

          await repo.sql`
            INSERT INTO test_security (name, value) VALUES (${maliciousInput}, 1)
          `;

          // Table should still exist and contain both records
          const rows = await repo.sql`SELECT COUNT(*) as count FROM test_security`;
          const count = (rows[0] as { count: string }).count;
          equal(parseInt(count), 2);
        });

        it('should protect against SQL injection in WHERE clauses', async function () {
          const maliciousInput = '1 OR 1=1';

          const rows = await repo.sql`
            SELECT * FROM test_security WHERE value = ${maliciousInput}
          `;

          // Should return no rows since maliciousInput is treated as literal value
          equal(rows.length, 0);
        });
      });
    });

    describe('Transaction Management', function () {
      it('should begin a new transaction', async function () {
        const transactionRepo = await repo.beginTransaction();
        ok(transactionRepo instanceof Object);
        await transactionRepo.rollbackTransaction();
      });

      it('should commit transaction changes', async function () {
        await repo.sql`
          CREATE TEMPORARY TABLE test_transaction (
            id SERIAL PRIMARY KEY,
            value TEXT
          )
        `;

        const transactionRepo = await repo.beginTransaction();

        await transactionRepo.sql`
          INSERT INTO test_transaction (value) VALUES ('committed')
        `;

        await transactionRepo.commitTransaction();

        const rows = await repo.sql`
          SELECT * FROM test_transaction WHERE value = 'committed'
        `;

        equal(rows.length, 1);
      });

      it('should rollback transaction changes', async function () {
        await repo.sql`
          CREATE TEMPORARY TABLE test_rollback (
            id SERIAL PRIMARY KEY,
            value TEXT
          )
        `;

        const transactionRepo = await repo.beginTransaction();

        await transactionRepo.sql`
          INSERT INTO test_rollback (value) VALUES ('should_rollback')
        `;

        await transactionRepo.rollbackTransaction();

        const rows = await repo.sql`
          SELECT * FROM test_rollback WHERE value = 'should_rollback'
        `;

        equal(rows.length, 0);
      });
    });

    describe('Redis Operations', function () {
      describe('Basic Key-Value Operations', function () {
        it('should set and get string values', async function () {
          const key = 'test:string';
          const value = 'hello world';

          await repo.set(key, value);
          const retrieved = await repo.get(key);

          equal(retrieved, value);
          await repo.del(key);
        });

        it('should set and get object values', async function () {
          const key = 'test:object';
          const value = { name: 'John', age: 30 };

          await repo.set(key, value);
          const retrieved = await repo.get(key);

          equal(JSON.stringify(retrieved), JSON.stringify(value));
          await repo.del(key);
        });

        it('should handle null/undefined values', async function () {
          const key = 'test:null';

          await repo.set(key, null);
          const retrieved = await repo.get(key);

          equal(retrieved, null);
          await repo.del(key);
        });

        it('should return undefined for non-existent keys', async function () {
          const retrieved = await repo.get('non:existent:key');
          equal(retrieved, undefined);
        });

        it('should delete keys', async function () {
          const key = 'test:delete';

          await repo.set(key, 'value');
          await repo.del(key);
          const retrieved = await repo.get(key);

          equal(retrieved, undefined);
        });
      });

      describe('TTL and Expiration', function () {
        it('should set key with TTL', async function () {
          const key = 'test:ttl';
          const value = 'expires';
          const ttlSeconds = 5;

          await repo.set(key, value, ttlSeconds);
          const ttl = await repo.ttl(key);

          ok(ttl > 0 && ttl <= ttlSeconds);
          await repo.del(key);
        });

        it('should set key with explicit expiration', async function () {
          const key = 'test:setex';
          const value = 'expires_soon';
          const ttlSeconds = 5;

          await repo.setex(key, ttlSeconds, value);
          const retrieved = await repo.get(key);
          const ttl = await repo.ttl(key);

          equal(retrieved, value);
          ok(ttl > 0 && ttl <= ttlSeconds);
          await repo.del(key);
        });

        it('should update TTL for existing key', async function () {
          const key = 'test:expire';
          const value = 'persistent';

          await repo.set(key, value);
          await repo.expire(key, 10);
          const ttl = await repo.ttl(key);

          ok(ttl > 0 && ttl <= 10);
          await repo.del(key);
        });

        it('should make key persistent', async function () {
          const key = 'test:persist';
          const value = 'now_persistent';

          await repo.setex(key, 5, value);
          await repo.persist(key);
          const ttl = await repo.ttl(key);

          equal(ttl, -1); // -1 indicates no expiration
          await repo.del(key);
        });

        it('should return -1 for keys without expiration', async function () {
          const key = 'test:no_expiration';

          await repo.set(key, 'persistent');
          const ttl = await repo.ttl(key);

          equal(ttl, -1);
          await repo.del(key);
        });

        it('should return -2 for non-existent keys', async function () {
          const ttl = await repo.ttl('non:existent:key');
          equal(ttl, -2);
        });
      });
    });

    describe('Error Handling', function () {
      it('should handle invalid SQL syntax gracefully', async function () {
        await rejects(async function () {
          await repo.sql`INVALID SQL SYNTAX HERE`;
        });
      });

      it('should handle database constraint violations', async function () {
        await repo.sql`
          CREATE TEMPORARY TABLE test_constraints (
            id INTEGER PRIMARY KEY,
            unique_value TEXT UNIQUE NOT NULL
          )
        `;

        await repo.sql`
          INSERT INTO test_constraints (id, unique_value) VALUES (1, 'unique')
        `;

        // This should throw due to unique constraint violation
        await rejects(async function () {
          await repo.sql`
            INSERT INTO test_constraints (id, unique_value) VALUES (2, 'unique')
          `;
        });
      });
    });
  });
}
