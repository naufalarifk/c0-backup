import type { DynamicModule, INestApplicationContext, Provider, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { DocumentModule } from '../modules/documents/document.module';
import { IndexerModule } from '../modules/indexer/indexer.module';
import { InvoiceExpirationModule } from '../modules/invoice-expiration/invoice-expiration.module';
import { InvoicePaymentModule } from '../modules/invoice-payments/invoice-payment.module';
import { InvoicePaymentProcessor } from '../modules/invoice-payments/invoice-payment.processor';
import { LoanMatcherModule } from '../modules/loan-matcher/loan-matcher.module';
import { LoanMatcherProcessor } from '../modules/loan-matcher/loan-matcher.processor';
import { NotificationModule } from '../modules/notifications/notification.module';
import { NotificationProcessor } from '../modules/notifications/notification.processor';
import { PricefeedModule } from '../modules/pricefeed/pricefeed.module';
import { PricefeedScheduler } from '../modules/pricefeed/pricefeed.scheduler';
import { SettlementModule } from '../modules/settlement/settlement.module';
import { SettlementScheduler } from '../modules/settlement/settlement.scheduler';
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
  | 'invoice-payment'
  | 'loan-matcher'
  | 'migration'
  | 'notification'
  | 'pricefeed'
  | 'settlement'
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
  settlement: {
    imports: [SettlementModule],
    providers: [SettlementScheduler],
    async bootstrap() {
      const logger = new TelemetryLogger('SettlementWorker');
      logger.log('Settlement worker started successfully');
      logger.log('Scheduled to run daily at midnight (00:00 UTC)');
      return {
        cleanup: () => {
          logger.log('Settlement worker shutting down');
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
  'invoice-payment': {
    imports: [InvoicePaymentModule],
    providers: [InvoicePaymentProcessor],
    usesBull: true,
    async bootstrap() {
      const logger = new TelemetryLogger('InvoicePaymentWorker');
      logger.log('Invoice payment worker started successfully');
      return {
        cleanup: () => {
          logger.log('Invoice payment worker shutting down');
        },
      };
    },
  },
  'loan-matcher': {
    imports: [LoanMatcherModule],
    providers: [LoanMatcherProcessor],
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
    async bootstrap() {
      const logger = new TelemetryLogger('IndexerWorker');
      logger.log('Indexer worker started successfully');

      return {
        cleanup: () => {
          logger.log('Indexer worker shutting down');
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
};
