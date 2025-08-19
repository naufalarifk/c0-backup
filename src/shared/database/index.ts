import 'dotenv/config';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import invariant from 'tiny-invariant';

import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
const databaseLogger = process.env.DATABASE_LOGGER;
invariant(databaseUrl, 'Internal DATABASE_URL environment variable must be defined');
invariant(databaseLogger, 'Internal DATABASE_LOGGER environment variable must be defined');

const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, {
  schema,
  logger: databaseLogger === 'true',
  casing: 'snake_case',
});

export type DrizzleDB = NodePgDatabase<typeof schema>;
