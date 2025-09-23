import { NestFactory } from '@nestjs/core';

import { TelemetryLogger } from '../shared/telemetry.logger';
import { PriceFeedEntrypointModule } from './pricefeed.module';

export async function pricefeedEntrypoint() {
  const app = await NestFactory.createApplicationContext(PriceFeedEntrypointModule);
  const logger = new TelemetryLogger('PriceFeedWorker');

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

  logger.log('PriceFeed worker started successfully');
}
