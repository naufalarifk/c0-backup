import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { VaultService } from './cryptography/cryptography.service';
import { DatabaseModule } from './database/database.module';
import { TelemetryInterceptor } from './interceptors';
import { RepositoryModule } from './repositories/repository.module';
import { AppConfigService } from './services/app-config.service';
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { FileValidatorService } from './services/file-validator.service';
import { MailerService } from './services/mailer.service';
import { MinioService } from './services/minio.service';
import { RedisService } from './services/redis.service';
import { TelemetryService } from './services/telemetry.service';
import { TwilioService } from './services/twilio.service';

const providers: Provider[] = [
  AppConfigService,
  CacheService,
  EmailService,
  FileValidatorService,
  MailerService,
  MinioService,
  RedisService,
  TelemetryInterceptor,
  TelemetryService,
  TwilioService,
  VaultService,
];

@Global()
@Module({
  providers,
  imports: [CqrsModule, DatabaseModule, RepositoryModule],
  exports: [...providers, CqrsModule, DatabaseModule, RepositoryModule],
})
export class SharedModule {}
