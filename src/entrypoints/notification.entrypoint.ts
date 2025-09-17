import { NestFactory } from '@nestjs/core';

import { TelemetryLogger } from '../shared/telemetry.logger';
import { NotificationEntrypointModule } from './notification.module';

export async function notificationEntrypoint() {
  const app = await NestFactory.createApplicationContext(NotificationEntrypointModule);
  const logger = new TelemetryLogger('NotificationWorker');

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

  logger.log('Notification worker started successfully');
}
