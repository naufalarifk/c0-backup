import 'dotenv/config';

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import invariant from 'tiny-invariant';

import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;
const enableOrmLogs = process.env.ENABLE_ORM_LOGS;
invariant(databaseUrl, 'Internal DATABASE_URL environment variable must be defined');
invariant(enableOrmLogs, 'Internal ENABLE_ORM_LOGS environment variable must be defined');

const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema, logger: enableOrmLogs === 'true', casing: 'snake_case' });

export type DrizzleDB = NodePgDatabase<typeof schema>;
