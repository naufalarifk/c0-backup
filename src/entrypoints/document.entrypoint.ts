import { NestFactory } from '@nestjs/core';

import { TelemetryLogger } from '../shared/telemetry.logger';
import { DocumentEntrypointModule } from './document.module';

export async function documentEntrypoint() {
  const app = await NestFactory.createApplicationContext(DocumentEntrypointModule);
  const logger = new TelemetryLogger('DocumentWorker');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.log('Received SIGINT, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  logger.log('Document worker started successfully');
}
