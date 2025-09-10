import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { NotificationWorkerModule } from './notification-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(NotificationWorkerModule);
  const logger = new Logger('NotificationWorker');

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

bootstrap().catch(error => {
  console.error('Failed to start notification worker:', error);
  process.exit(1);
});
