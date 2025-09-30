import 'reflect-metadata';

import { networkInterfaces } from 'node:os';
import { argv, env } from 'node:process';

import { BullModule } from '@nestjs/bullmq';
import {
  type DynamicModule,
  type INestApplicationContext,
  Module,
  type Provider,
  type Type,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';

import { type BootstrapResult, COMMAND_DEFINITIONS, type CommandKey } from './entrypoints/commands';
import { AppConfigService } from './shared/services/app-config.service';
import { SharedModule } from './shared/shared.module';
import { TelemetryLogger } from './shared/telemetry.logger';

const [, , ...rawCommands] = argv;

if ('BETTER_AUTH_URL' in env && env.BETTER_AUTH_URL === 'local') {
  env.BETTER_AUTH_URL = getDefaultAuthUrl();
}

const commandSet = new Set<CommandKey>();

for (const command of rawCommands) {
  const normalized = command?.trim();
  if (!normalized) {
    continue;
  }

  if (!isCommandKey(normalized)) {
    const logger = new TelemetryLogger('Bootstrap');
    logger.error(`Unknown command: ${normalized}`);
    process.exit(1);
  }

  commandSet.add(normalized);
}

const commands = Array.from(commandSet);

if (commands.length === 0) {
  const logger = new TelemetryLogger('Bootstrap');
  logger.warn('No commands specified. Nothing to run.');
  process.exit(0);
}

// if (commands.includes('migration') && commands.length > 1) {
//   const logger = new TelemetryLogger('Bootstrap');
//   logger.error('Migration command must be run standalone.');
//   process.exit(1);
// }

const definitions = commands.map(command => ({
  key: command,
  definition: COMMAND_DEFINITIONS[command],
}));

const requiresHttp = definitions.some(({ definition }) => definition.requiresHttp);
const needsBull = definitions.some(({ definition }) => definition.usesBull);

type ModuleImport = Type | DynamicModule | Promise<DynamicModule>;

const imports: ModuleImport[] = [];
const importSet = new Set<ModuleImport>();

function addImport(moduleRef: ModuleImport) {
  if (!importSet.has(moduleRef)) {
    imports.push(moduleRef);
    importSet.add(moduleRef);
  }
}

addImport(
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '.env.docker'],
  }),
);
addImport(SharedModule);

if (needsBull) {
  addImport(
    BullModule.forRootAsync({
      useFactory: (configService: AppConfigService) => ({
        connection: {
          ...configService.redisConfig,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [AppConfigService],
    }),
  );
}

for (const { definition } of definitions) {
  for (const moduleRef of definition.imports ?? []) {
    addImport(moduleRef);
  }
}

const providers: Provider[] = [];
const providerSet = new Set<Provider>();

function addProvider(provider: Provider) {
  if (!providerSet.has(provider)) {
    providers.push(provider);
    providerSet.add(provider);
  }
}

for (const { definition } of definitions) {
  for (const provider of definition.providers ?? []) {
    addProvider(provider);
  }
}

@Module({})
class RuntimeEntrypointModule {}

const runtimeModule: DynamicModule = {
  module: RuntimeEntrypointModule,
  imports,
  providers,
};

const bootstrapLogger = new TelemetryLogger('Bootstrap');

async function bootstrap() {
  let app: INestApplicationContext;

  if (requiresHttp) {
    app = await NestFactory.create<NestExpressApplication>(runtimeModule, new ExpressAdapter(), {
      bodyParser: false,
      logger: bootstrapLogger,
    });
  } else {
    app = await NestFactory.createApplicationContext(runtimeModule, {
      logger: bootstrapLogger,
    });
  }

  const cleanupHandlers: Array<() => Promise<void> | void> = [];
  let exitCode: number | undefined;

  for (const { definition } of definitions) {
    if (!definition.bootstrap) {
      continue;
    }

    const result = await definition.bootstrap({ app });

    if (result) {
      registerCleanup(cleanupHandlers, result);
      if (typeof result.exitAfterBootstrap === 'number') {
        exitCode = result.exitAfterBootstrap;
      }
    }
  }

  if (typeof exitCode === 'number') {
    await runCleanup(cleanupHandlers);
    await app.close();
    process.exit(exitCode);
  }

  registerSignalHandlers(app, cleanupHandlers);
}

bootstrap().catch(error => {
  bootstrapLogger.error('Failed to bootstrap application', error);
  process.exit(1);
});

function registerCleanup(
  cleanupHandlers: Array<() => Promise<void> | void>,
  result: BootstrapResult,
) {
  if (result.cleanup) {
    cleanupHandlers.push(result.cleanup);
  }
}

function registerSignalHandlers(
  app: INestApplicationContext,
  cleanupHandlers: Array<() => Promise<void> | void>,
) {
  let isShuttingDown = false;

  const handleSignal = async (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    bootstrapLogger.log(`Received ${signal}, shutting down gracefully...`);

    try {
      await runCleanup(cleanupHandlers);
      await app.close();
      bootstrapLogger.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      bootstrapLogger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
}

async function runCleanup(cleanupHandlers: Array<() => Promise<void> | void>) {
  for (const cleanup of [...cleanupHandlers].reverse()) {
    try {
      await cleanup();
    } catch (error) {
      bootstrapLogger.error('Cleanup handler failed', error);
    }
  }
}

function isCommandKey(value: string): value is CommandKey {
  return value in COMMAND_DEFINITIONS;
}

function getDefaultAuthUrl(): string {
  const defaultIP = getLocalNetworkIP();
  const defaultPort = 'PORT' in env ? env.PORT : '3000';
  if (typeof defaultIP === 'string') {
    return `http://${defaultIP}:${defaultPort}`;
  }
  return 'http://localhost:3000';
}

function getLocalNetworkIP(): string | null {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface?.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}
