#!/usr/bin/env node
// @ts-check

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, existsSync, createWriteStream, mkdirSync, openSync } from 'node:fs';
import { GenericContainer } from 'testcontainers';
import { LogWaitStrategy } from 'testcontainers/build/wait-strategies/log-wait-strategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Disable TestContainers reaper to keep containers running after process exits
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const pidFile = join(__dirname, '..', '.local', 'test-server.json');

if (existsSync(pidFile)) {
  throw new Error('Test server already running. Use test-server-stop.mjs to stop it first.');
}

const postgresPort = 10000 + Math.floor(Math.random() * 10001);
const redisPort = 10000 + Math.floor(Math.random() * 10001);
const minioPort = 10000 + Math.floor(Math.random() * 10001);
const minioAdminPort = 10000 + Math.floor(Math.random() * 10001);

const [
  postgresContainer,
  redisContainer,
  minioContainer,
] = await Promise.all([
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

mkdirSync(join(__dirname, '..', '.local'), { recursive: true });
const stdoutFd = openSync(join(__dirname, '..', '.local', 'test-server.stdout.log'), 'w');
const stderrFd = openSync(join(__dirname, '..', '.local', 'test-server.stderr.log'), 'w');

const backend = spawn('node', [join(__dirname, '../dist/main.js'), 'api', 'migration', 'indexer', 'document'], {
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
  detached: true,
  stdio: ['ignore', stdoutFd, stderrFd],
});

backend.unref();

writeFileSync(pidFile, JSON.stringify({
  pid: backend.pid,
  containers: [
    { id: postgresContainer.getId(), port: postgresPort, type: 'postgres' },
    { id: redisContainer.getId(), port: redisPort, type: 'redis' },
    { id: minioContainer.getId(), port: minioPort, type: 'minio' }
  ]
}));

console.info('Test server started with PID:', backend.pid);