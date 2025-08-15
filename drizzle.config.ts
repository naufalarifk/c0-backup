import { defineConfig } from 'drizzle-kit';
import invariant from 'tiny-invariant';

const databaseUrl = process.env.DATABASE_URL;
invariant(databaseUrl, 'DATABASE_URL environment variable must be defined');

export default defineConfig({
  out: './src/database/migrations',
  schema: './src/database/schema',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: { url: databaseUrl },
  strict: true,
});
