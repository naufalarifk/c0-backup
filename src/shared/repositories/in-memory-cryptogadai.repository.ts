/** biome-ignore-all lint/suspicious/useAwait: Too strict, this is for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: Find other way if possible */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

import { CryptogadaiRepository } from './cryptogadai.repository';

/**
 * PGlite-based + in-memory variable as redis for Cryptogadai.
 */
export class InMemoryCryptogadaiRepository extends CryptogadaiRepository {
  #pgLite = new PGlite();

  async connect(): Promise<void> {
    // Configure the database to interpret timestamps consistently as UTC
    await this.#pgLite.exec(`SET TIME ZONE 'UTC';`);
  }

  async migrate(): Promise<void> {
    /**
     * use __dirname to get relative path of current file
     */
    const schemaPaths = [
      join(__dirname, './postgres/0002-user.sql'),
      join(__dirname, './postgres/0003-user-preferences.sql'),
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
      join(__dirname, './postgres/0012-loan-documents.sql'),
      join(__dirname, './postgres/0012-withdrawal.sql'),
      join(__dirname, './postgres/0013-loan-agreement-signatures.sql'),
      join(__dirname, './postgres/0014-push-tokens.sql'),
      join(__dirname, './postgres/0018-historical-account-balances.sql'),
    ];

    // this.#logger(`Found schema files: ${schemaPaths.map(file => file.name).join('\n')}`);

    for (const schemaPath of schemaPaths) {
      const schemaSqlQueries = await readFile(schemaPath, { encoding: 'utf-8' });
      await this.#pgLite.exec(schemaSqlQueries);
    }
  }

  async close(): Promise<void> {
    if (this.#pgLite && !this.#pgLite.closed) {
      await this.#pgLite.close();
    }
    // Clear any scheduled expiration timers to allow clean shutdown
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
    this.#expirations.clear();
    this.#store.clear();
  }

  /**
   * Convert PostgreSQL timestamp columns to proper Date objects
   * Handles timezone conversion consistently - treats all timestamps as UTC
   */
  private convertTimestampsToDate(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertTimestampsToDate(item));
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
      const converted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Convert timestamp columns to Date objects
        // Common timestamp column patterns in our schema
        if (value instanceof Date) {
          // PGlite applies system timezone when converting TIMESTAMP to Date
          // We need to correct this since our timestamps should be UTC
          // If system timezone is UTC+7 (-420 minutes), PGlite subtracts 7 hours from stored UTC time
          // So we need to add back the timezone offset to get the original UTC time
          const systemOffsetMs = new Date().getTimezoneOffset() * 60 * 1000;
          converted[key] = new Date(value.getTime() - systemOffsetMs);
        } else if (
          key.endsWith('_date') ||
          key.endsWith('_at') ||
          key.endsWith('Date') ||
          key.endsWith('At')
        ) {
          if (typeof value === 'string') {
            try {
              // String timestamp - treat as UTC
              if (!value.includes('Z') && !value.includes('+') && !value.includes('-', 19)) {
                // Add Z to indicate UTC if no timezone info is present
                converted[key] = new Date(value + 'Z');
              } else {
                converted[key] = new Date(value);
              }
            } catch (_error) {
              // If parsing fails, keep original value
              converted[key] = value;
            }
          } else {
            converted[key] = value;
          }
        } else {
          converted[key] = this.convertTimestampsToDate(value);
        }
      }
      return converted;
    }

    return obj;
  }

  async sql(query: TemplateStringsArray, ...params: unknown[]): Promise<Array<unknown>> {
    if (this.#pgLite === undefined) {
      throw new Error('PGlite instance is not initialized.');
    }

    // Build parameterized query with PostgreSQL-style placeholders ($1, $2, etc.)
    let queryString = query[0];
    for (let index = 1; index < query.length; index++) {
      queryString += `$${index}` + query[index];
    }

    // this.#logger.debug('Executing SQL:', queryString, 'with params:', params);

    try {
      const result = await this.#pgLite.query(queryString, params);

      // Convert timestamp columns to Date objects before returning
      const convertedRows = this.convertTimestampsToDate(result.rows);

      return Array.isArray(convertedRows) ? convertedRows : convertedRows ? [convertedRows] : [];
    } catch (error) {
      // Treat invalid input syntax for integer (SQL state 22P02) as empty result
      // This makes WHERE clauses with malicious string values behave as literal no-match
      if (error && error.code === '22P02') {
        return [];
      }
      // Re-throw other errors so tests expecting exceptions receive them immediately
      throw error;
    }
  }

  async rawQuery(queryText: string, params: unknown[]): Promise<unknown> {
    if (this.#pgLite === undefined) {
      throw new Error('PGlite instance is not initialized.');
    }

    try {
      const result = await this.#pgLite.query(queryText, params);
      const converted = this.convertTimestampsToDate(result.rows);
      return converted;
    } catch (error) {
      if (error && error.code === '22P02') return [];
      throw error;
    }
  }

  // Simple transaction support using PGlite BEGIN/COMMIT/ROLLBACK.
  // We keep a flag to indicate an open transaction.
  #inTransaction = false;

  async beginTransaction(): Promise<InMemoryCryptogadaiRepository> {
    if (this.#pgLite === undefined) throw new Error('PGlite instance is not initialized.');
    if (this.#inTransaction) throw new Error('Transaction already in progress.');
    await this.#pgLite.exec('BEGIN');
    this.#inTransaction = true;
    return this;
  }

  async commitTransaction(): Promise<void> {
    if (this.#pgLite === undefined) throw new Error('PGlite instance is not initialized.');
    if (!this.#inTransaction) throw new Error('No transaction in progress.');
    await this.#pgLite.exec('COMMIT');
    this.#inTransaction = false;
  }

  async rollbackTransaction(): Promise<void> {
    if (this.#pgLite === undefined) throw new Error('PGlite instance is not initialized.');
    if (!this.#inTransaction) throw new Error('No transaction in progress.');
    await this.#pgLite.exec('ROLLBACK');
    this.#inTransaction = false;
  }

  // Simple in-memory key/value store with optional TTL support.
  #store: Map<string, unknown> = new Map();
  #expirations: Map<string, number> = new Map(); // epoch ms when key expires
  #timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private scheduleExpiration(key: string, seconds: number) {
    // clear any existing timer
    const existing = this.#timers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.#timers.delete(key);
    }

    const ms = Math.max(0, Math.floor(seconds * 1000));
    const expireAt = Date.now() + ms;
    this.#expirations.set(key, expireAt);

    const timer = setTimeout(() => {
      this.#store.delete(key);
      this.#expirations.delete(key);
      this.#timers.delete(key);
    }, ms);

    this.#timers.set(key, timer);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    this.#store.set(key, value);
    if (ttl !== undefined && ttl !== null) {
      this.scheduleExpiration(key, ttl);
    } else {
      // if no ttl provided, remove any existing expiration (persist)
      const timer = this.#timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.#timers.delete(key);
      }
      this.#expirations.delete(key);
    }
  }

  async setex(key: string, seconds: number, value: unknown): Promise<void> {
    await this.set(key, value, seconds);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.#store.has(key)) return;
    this.scheduleExpiration(key, seconds);
  }

  // Returns Redis-like semantics:
  // -2 if key does not exist
  // -1 if key exists but has no associated expire
  // ttl in seconds (integer) if key has an expire
  async ttl(key: string): Promise<number> {
    if (!this.#store.has(key)) return -2;
    const exp = this.#expirations.get(key);
    if (exp === undefined) return -1;
    const remainingMs = exp - Date.now();
    if (remainingMs <= 0) {
      // expired; ensure cleanup
      await this.del(key);
      return -2;
    }
    return Math.ceil(remainingMs / 1000);
  }

  async persist(key: string): Promise<void> {
    if (!this.#store.has(key)) return;
    const timer = this.#timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.#timers.delete(key);
    }
    this.#expirations.delete(key);
  }

  async del(key: string): Promise<void> {
    this.#store.delete(key);
    const timer = this.#timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.#timers.delete(key);
    }
    this.#expirations.delete(key);
  }

  async get(key: string): Promise<unknown> {
    // If key has expired but timer didn't fire for some reason, do a quick check
    const exp = this.#expirations.get(key);
    if (exp !== undefined && exp <= Date.now()) {
      await this.del(key);
      return undefined;
    }
    return this.#store.get(key);
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      const exp = this.#expirations.get(key);
      if (exp !== undefined && exp <= Date.now()) {
        await this.del(key);
        continue;
      }
      if (this.#store.has(key)) {
        count++;
      }
    }
    return count;
  }
}
