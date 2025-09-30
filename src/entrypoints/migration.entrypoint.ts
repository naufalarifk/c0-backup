import { NestFactory } from '@nestjs/core';

import { MigrationModule } from '../entrypoints/migration.module';
import { CryptogadaiRepository } from '../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../shared/telemetry.logger';

export async function migrationEntrypoint() {
  const logger = new TelemetryLogger();
  const app = await NestFactory.createApplicationContext(MigrationModule);
  const repo = app.get(CryptogadaiRepository);
  await repo.migrate();
  await app.close();
  logger.log('Migration completed');
  process.exit(0);
}
