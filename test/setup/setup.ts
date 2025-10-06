import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { env } from 'node:process';

import { WritableString } from './stream';

export async function setup() {
  const redisPort = String(20000 + Math.floor(Math.random() * 5000));
  const mailpitSmtpPort = String(25000 + Math.floor(Math.random() * 5000));
  const mailpitApiPort = String(30000 + Math.floor(Math.random() * 5000));
  const mailpitApiAddr = `localhost:${mailpitApiPort}`;
  const cgBackendPath = join(__dirname, '../..');

  const [redis, mailpit] = await Promise.all([
    new Promise<{
      teardown: () => Promise<void>;
    }>(function (resolve, reject) {
      let resolvable = true;
      const redis = spawn('redis-server', [
        '--port',
        redisPort,
        '--save',
        '',
        '--appendonly',
        'no',
      ]);
      redis.stdout?.on('data', function (data) {
        const dataStr = String(data);
        // console.debug('Redis output:', resolvable, dataStr);
        if (dataStr.includes('Ready to accept connections')) {
          if (resolvable) {
            resolvable = false;
            resolve({
              async teardown() {
                return new Promise<void>(function (resolve) {
                  redis.removeAllListeners();
                  redis.stdout?.removeAllListeners();
                  redis.stderr?.removeAllListeners();
                  redis.on('exit', function () {
                    // Small delay to ensure cleanup
                    setTimeout(resolve, 10);
                  });
                  // Use SIGKILL immediately for faster teardown in tests
                  redis.kill('SIGKILL');
                });
              },
            });
          }
        }
      });
      redis.stderr?.on('data', function (data) {
        // console.error('Redis error:', data.toString());
      });
      redis.on('error', function (error) {
        if (resolvable) {
          resolvable = false;
          reject(new Error(`Failed to start Redis: ${error.message}`));
        }
      });
      redis.on('exit', function (code) {
        if (resolvable) {
          resolvable = false;
          reject(new Error(`Redis process exited with code ${code}`));
        }
      });
    }),
    new Promise<{
      teardown: () => Promise<void>;
    }>(function (resolve, reject) {
      let resolvable = true;
      const mailpit = spawn('mailpit', [
        '--listen',
        `[::]:${mailpitApiPort}`,
        '--smtp',
        `[::]:${mailpitSmtpPort}`,
      ]);
      mailpit.stdout?.on('data', function (data) {
        const dataStr = String(data);
        // console.debug('Mailpit output:', resolvable, dataStr);
        if (dataStr.includes('accessible via http')) {
          if (resolvable) {
            resolvable = false;
            resolve({
              async teardown() {
                return new Promise<void>(function (resolve) {
                  mailpit.removeAllListeners();
                  mailpit.stdout?.removeAllListeners();
                  mailpit.stderr?.removeAllListeners();
                  mailpit.on('exit', function () {
                    // Small delay to ensure cleanup
                    setTimeout(resolve, 10);
                  });
                  // Use SIGKILL immediately for faster teardown in tests
                  mailpit.kill('SIGKILL');
                });
              },
            });
          }
        }
      });
      mailpit.stderr?.on('data', function (data) {
        // console.error('Mailpit error:', data.toString());
      });
      mailpit.on('error', function (error) {
        if (resolvable) {
          resolvable = false;
          reject(new Error(`Failed to start Mailpit: ${error.message}`));
        }
      });
      mailpit.on('exit', function (code) {
        if (resolvable) {
          resolvable = false;
          reject(new Error(`Mailpit process exited with code ${code}`));
        }
      });
    }),
  ]);

  console.info('Redis and Mailpit containers started');

  const backendPort = String(20000 + Math.floor(Math.random() * 10000));
  const backendAddr = `localhost:${backendPort}`;

  await new Promise<void>(function (resolve, reject) {
    const build = spawn('pnpm', ['build'], {
      cwd: cgBackendPath,
      stdio: 'inherit',
    });
    build.on('error', function (error) {
      reject(new Error(`Failed to build CG Backend: ${error.message}`));
    });
    build.on('exit', function (code) {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`CG Backend build exited with code ${code}`));
      }
    });
  });

  const [backend] = await Promise.all([
    new Promise<{
      teardown: () => Promise<void>;
    }>(async function (resolve, reject) {
      let resolvable = true;
      const cgBackend = spawn(
        'node',
        [
          'dist/main.js',
          'api',
          'indexer',
          'invoice-payment',
          'loan-matcher',
          'migration',
          'notification',
          'pricefeed',
        ],
        {
          cwd: cgBackendPath,
          env: {
            ...process.env,
            NODE_ENV: 'development',
            ALLOWED_ORIGINS: `http://localhost,http://localhost:3000,crypto-gadai://`,
            APP_EXPO_URL: `exp://localhost/--`,
            APP_SCHEME: 'crypto-gadai://',
            BETTER_AUTH_COOKIE_PREFIX: 'cg',
            BETTER_AUTH_EXPIRATION_TIME: '3600',
            BETTER_AUTH_MAXIMUM_SESSIONS: '3',
            BETTER_AUTH_SECRET: 'P1skQoJiT7jnNDHuw06kkbTougc3jvTt',
            BETTER_AUTH_TELEMETRY_DEBUG: '0',
            BETTER_AUTH_TELEMETRY: '0',
            BETTER_AUTH_TELEMETRY_DISABLED: '1',
            BETTER_AUTH_URL: `http://localhost:${backendPort}/api/auth`,
            CRYPTOGRAPHY_ENGINE: 'local',
            WALLET_TEST_MODE: 'true',
            PLATFORM_MASTER_MNEMONIC:
              'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
            DATABASE_URL: ':inmemory:',
            DATABASE_LOGGER: 'false',
            GOOGLE_CLIENT_ID:
              '442461506062-rgpbj94u778lpcfv5hg5rue6fpveddt6.apps.googleusercontent.com',
            GOOGLE_CLIENT_SECRET: 'GOCSPX - KKQN9TreMghyANcTCd9Vq4u3cILe',
            MAIL_HOST: 'localhost',
            MAIL_SMTP_PORT: mailpitSmtpPort,
            MINIO_ENDPOINT: 'local',
            PORT: backendPort,
            REDIS_HOST: `localhost`,
            REDIS_PORT: redisPort,
            THROTTLER_LIMIT: '10000',
            THROTTLER_TTL: '1m',
            PRICEFEED_SCHEDULER_ENABLED: 'true',
            DOCUMENT_OUTPUT_DIR: '/tmp/claude/documents',
          },
        },
      );
      let isNestJSStarted = false;
      let isDatabaseMigrated = false;
      const writableString = new WritableString();
      cgBackend.stdout?.pipe(writableString);
      cgBackend.stderr?.pipe(writableString);
      cgBackend.stdout?.on('data', function (data) {
        if (env.CG_BACKEND_LOGS === '1' || env.CG_BACKEND_LOGS === 'true') {
          console.debug(data?.toString());
        }
        if (data?.toString().includes('application successfully started')) {
          isNestJSStarted = true;
        }
        if (data?.toString().includes('Migration completed.')) {
          isDatabaseMigrated = true;
        }
        if (isNestJSStarted && isDatabaseMigrated) {
          if (resolvable) {
            resolvable = false;
            resolve({
              async teardown() {
                return new Promise<void>(function (resolve) {
                  cgBackend.removeAllListeners();
                  cgBackend.stdout?.removeAllListeners();
                  cgBackend.stderr?.removeAllListeners();
                  cgBackend.stdout?.unpipe(writableString);
                  cgBackend.stderr?.unpipe(writableString);
                  writableString.end();
                  cgBackend.on('exit', function () {
                    // Small delay to ensure cleanup
                    setTimeout(resolve, 10);
                  });
                  // Use SIGKILL immediately for faster teardown in tests
                  cgBackend.kill('SIGKILL');
                });
              },
            });
          }
        }
      });
      cgBackend.stderr?.on('data', function (data) {
        if (env.CG_BACKEND_LOGS === '1' || env.CG_BACKEND_LOGS === 'true') {
          console.error(data?.toString());
        }
      });
      cgBackend.on('error', function (error) {
        if (resolvable) {
          resolvable = false;
          reject(new Error(`Failed to start CG Backend: ${error.message}`));
        }
      });
      cgBackend.on('exit', function (code) {
        if (resolvable) {
          resolvable = false;
          reject(
            new Error(
              `CG Backend process exited with code ${code}. Output:\n${writableString.toString()}`,
            ),
          );
        }
      });
    }),
  ]);

  console.info('CryptoGadai Backend server started at', backendAddr);

  return {
    mailpitUrl: `http://${mailpitApiAddr}`,
    backendUrl: `http://${backendAddr}`,
    async teardown() {
      // Teardown in proper order: backend first, then dependencies
      try {
        await backend.teardown();
      } catch (error) {
        console.error('Error tearing down backend:', error);
      }
      try {
        await Promise.all([redis.teardown(), mailpit.teardown()]);
      } catch (error) {
        console.error('Error tearing down dependencies:', error);
      }
    },
  };
}
