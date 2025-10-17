// @ts-check

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GenericContainer } from 'testcontainers';
import { LogWaitStrategy } from 'testcontainers/build/wait-strategies/log-wait-strategy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const postgresPort = 10000 + Math.floor(Math.random() * 10001);
const redisPort = 10000 + Math.floor(Math.random() * 10001);
const minioPort = 10000 + Math.floor(Math.random() * 10001);
const minioAdminPort = 10000 + Math.floor(Math.random() * 10001);

await Promise.all([
  new GenericContainer('postgres:18.0-alpine3.22')
    .withAutoRemove(true)
    .withEnvironment({
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'postgres',
      POSTGRES_DB: 'postgres',
    })
    .withExposedPorts({ container: 5432, host: postgresPort })
    .withWaitStrategy(new LogWaitStrategy('database system is ready to accept connections', 2))
    // .withLogConsumer(function (stream) { stream.pipe(process.stdout); })
    .start(),
  new GenericContainer('valkey/valkey:9.0-alpine3.22')
    .withAutoRemove(true)
    .withExposedPorts({ container: 6379, host: redisPort })
    .withWaitStrategy(new LogWaitStrategy('Ready to accept connections', 1))
    // .withLogConsumer(function (stream) { stream.pipe(process.stdout); })
    .start(),
  new GenericContainer('minio/minio:RELEASE.2025-09-07T16-13-09Z')
    .withAutoRemove(true)
    .withCommand(['server', '/data', '--console-address', ':9001'])
    .withEnvironment({
      MINIO_ROOT_USER: 'rootuser',
      MINIO_ROOT_PASSWORD: 'rootuser',
    })
    .withExposedPorts(
      { container: 9000, host: minioPort },
      { container: 9001, host: minioAdminPort },
    )
    .withWaitStrategy(new LogWaitStrategy('Docs: https://docs.min.io', 1))
    // .withLogConsumer(function (stream) { stream.pipe(process.stdout); })
    .start(),
]);

const cgBackend = spawn('node', [join(__dirname, '../dist/main.js'), 'api', 'migration', 'indexer', 'document'], {
  cwd: join(__dirname, '..'),
  env: {
    NODE_ENV: 'production',
    DATABASE_URL: `postgres://postgres:postgres@localhost:${postgresPort}/postgres`,
    REDIS_HOST: 'localhost',
    REDIS_PORT: `${redisPort}`,
    MINIO_ENDPOINT: `localhost:${minioPort}`,
    MINIO_ROOT_USER: 'rootuser',
    MINIO_ROOT_PASSWORD: 'rootuser',
    ENABLED_INDEXERS: 'cg:testnet',
  },
});

console.info('Starting cg-backend for tests...');

cgBackend.stdout.pipe(process.stdout);
cgBackend.stderr.pipe(process.stderr);

process.on('beforeExit', function () {
  cgBackend.kill('SIGTERM');
});
