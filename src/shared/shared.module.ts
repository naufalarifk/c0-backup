import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { DatabaseModule } from './database/database.module';
import { RepositoryModule } from './repositories/repository.module';
import { AppConfigService } from './services/app-config.service';
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { MailerService } from './services/mailer.service';
import { MinioService } from './services/minio.service';
import { RedisService } from './services/redis.service';
import { TelemetryService } from './services/telemetry.service';
import { TwilioService } from './services/twilio.service';
import { WalletModule } from './wallets/wallet.module';

const providers: Provider[] = [
  AppConfigService,
  CacheService,
  EmailService,
  MailerService,
  MinioService,
  RedisService,
  TelemetryService,
  TwilioService,
];

@Global()
@Module({
  providers,
  imports: [CqrsModule, DatabaseModule, RepositoryModule, WalletModule],
  exports: [...providers, CqrsModule, DatabaseModule, RepositoryModule],
})
export class SharedModule {}
