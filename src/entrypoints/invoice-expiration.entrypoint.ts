import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { TelemetryLogger } from '../shared/telemetry.logger';
import { InvoiceExpirationEntrypointModule } from './invoice-expiration.module';

export async function invoiceExpirationEntrypoint() {
  const logger = new Logger('InvoiceExpirationWorker');

  try {
    logger.log('Starting Invoice Expiration Worker...');

    const app = await NestFactory.create(InvoiceExpirationEntrypointModule, {
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
    logger.log('Invoice Expiration Worker started successfully');

    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start Invoice Expiration Worker:', error);
    process.exit(1);
  }
}
