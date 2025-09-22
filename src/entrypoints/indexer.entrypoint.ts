import { NestFactory } from '@nestjs/core';

import { IndexerProcessor } from '../modules/indexer/indexer.processor';
import { TelemetryLogger } from '../shared/telemetry.logger';
import { IndexerEntrypointModule } from './indexer.module';

export async function indexerEntrypoint() {
  const app = await NestFactory.createApplicationContext(IndexerEntrypointModule);
  const logger = new TelemetryLogger('IndexerWorker');
  const processor = app.get(IndexerProcessor);

  // Start the indexer processor
  await processor.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.log('Received SIGINT, shutting down gracefully...');
    await processor.stop();
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, shutting down gracefully...');
    await processor.stop();
    await app.close();
    process.exit(0);
  });

  logger.log('Indexer worker started successfully');
}
