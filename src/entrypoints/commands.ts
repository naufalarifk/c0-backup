import type { DynamicModule, INestApplicationContext, Provider, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { DocumentModule } from '../modules/documents/document.module';
import { IndexerModule } from '../modules/indexer/indexer.module';
import { IndexerProcessor } from '../modules/indexer/indexer.processor';
import { InvoiceExpirationModule } from '../modules/invoice-expiration/invoice-expiration.module';
import { LoanMatcherModule } from '../modules/loan-matcher/loan-matcher.module';
import { NotificationModule } from '../modules/notifications/notification.module';
import { NotificationProcessor } from '../modules/notifications/notification.processor';
import { PricefeedModule } from '../modules/pricefeed/pricefeed.module';
import { PricefeedScheduler } from '../modules/pricefeed/pricefeed.scheduler';
import { WalletBalanceCollectorModule } from '../modules/wallet-balance-collector/wallet-balance-collector.module';
import { CryptogadaiRepository } from '../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../shared/telemetry.logger';
import { bootstrapUserApi } from './user-api.bootstrap';
import { AppModule } from './user-api.module';

export type CommandKey =
  | 'api'
  | 'document'
  | 'indexer'
  | 'invoice-expiration'
  | 'loan-matcher'
  | 'migration'
  | 'notification'
  | 'pricefeed'
  | 'wallet-balance-collector';

export interface BootstrapContext {
  app: INestApplicationContext;
}

export interface BootstrapResult {
  cleanup?: () => Promise<void> | void;
  exitAfterBootstrap?: number;
}

export interface CommandDefinition {
  imports?: Array<Type | DynamicModule>;
  providers?: Provider[];
  usesBull?: boolean;
  requiresHttp?: boolean;
  bootstrap?: (context: BootstrapContext) => Promise<BootstrapResult | void>;
}

export const COMMAND_DEFINITIONS: Record<CommandKey, CommandDefinition> = {
  api: {
    imports: [AppModule],
    usesBull: true,
    requiresHttp: true,
    async bootstrap({ app }) {
      const httpApp = app as NestExpressApplication;
      await bootstrapUserApi(httpApp);
    },
  },
  notification: {
    imports: [NotificationModule],
    providers: [NotificationProcessor],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('NotificationWorker');
      logger.log('Notification worker started successfully');
      return {
        cleanup: () => {
          logger.log('Notification worker shutting down');
        },
      };
    },
  },
  pricefeed: {
    imports: [PricefeedModule],
    providers: [PricefeedScheduler],
    async bootstrap() {
      const logger = new TelemetryLogger('PriceFeedWorker');
      logger.log('Price feed worker started successfully');
      return {
        cleanup: () => {
          logger.log('Price feed worker shutting down');
        },
      };
    },
  },
  'invoice-expiration': {
    imports: [InvoiceExpirationModule],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('InvoiceExpirationWorker');
      logger.log('Invoice expiration worker started successfully');
      return {
        cleanup: () => {
          logger.log('Invoice expiration worker shutting down');
        },
      };
    },
  },
  'loan-matcher': {
    imports: [LoanMatcherModule],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('LoanMatcherWorker');
      logger.log('Starting Loan Matcher Worker...');

      const handleUncaughtException = (error: Error) => {
        logger.error('Uncaught Exception:', error);
      };

      const handleUnhandledRejection = (reason: unknown, promise: Promise<unknown>) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      };

      process.on('uncaughtException', handleUncaughtException);
      process.on('unhandledRejection', handleUnhandledRejection);

      logger.log('Loan Matcher Worker started successfully');

      return {
        cleanup: () => {
          process.off('uncaughtException', handleUncaughtException);
          process.off('unhandledRejection', handleUnhandledRejection);
          logger.log('Loan Matcher Worker shutting down');
        },
      };
    },
  },
  indexer: {
    imports: [IndexerModule],
    async bootstrap({ app }) {
      const logger = new TelemetryLogger('IndexerWorker');
      const processor = app.get(IndexerProcessor);
      await processor.start();
      logger.log('Indexer worker started successfully');

      return {
        cleanup: async () => {
          logger.log('Stopping Indexer worker');
          await processor.stop();
          logger.log('Indexer worker stopped');
        },
      };
    },
  },
  document: {
    imports: [DocumentModule],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('DocumentWorker');
      logger.log('Document worker started successfully');
      return {
        cleanup: () => {
          logger.log('Document worker shutting down');
        },
      };
    },
  },
  migration: {
    async bootstrap({ app }) {
      const logger = new TelemetryLogger('MigrationRunner');
      logger.log('Starting migration...');
      const repository = app.get(CryptogadaiRepository);
      await repository.migrate();
      logger.log('Migration completed.');
      return {
        cleanup: () => {
          /** ignore */
        },
      };
    },
  },
  'wallet-balance-collector': {
    imports: [WalletBalanceCollectorModule],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('WalletBalanceCollectorWorker');
      logger.log('Wallet balance collector worker started successfully');
      return {
        cleanup: () => {
          logger.log('Wallet balance collector worker shutting down');
        },
      };
    },
  },
};
