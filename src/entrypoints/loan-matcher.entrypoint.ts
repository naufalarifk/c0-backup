import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { TelemetryLogger } from '../shared/telemetry.logger';
import { LoanMatcherEntrypointModule } from './loan-matcher.module';

export async function loanMatcherEntrypoint() {
  const logger = new Logger('LoanMatcherWorker');

  try {
    logger.log('Starting Loan Matcher Worker...');

    const app = await NestFactory.create(LoanMatcherEntrypointModule, {
      logger: new TelemetryLogger(),
    });

    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
      logger.log('Received SIGINT signal, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.log('Received SIGTERM signal, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    await app.init();
    logger.log('Loan Matcher Worker started successfully');

    // Keep the process alive
    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  } catch (error) {
    logger.error('Failed to start Loan Matcher Worker:', error);
    process.exit(1);
  }
}
