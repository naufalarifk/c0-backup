import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { DatabaseModule } from './database/database.module';
import { RepositoryModule } from './repositories/repository.module';
import { AppConfigService } from './services/app-config.service';
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { RedisService } from './services/redis.service';
import { TwilioService } from './services/twilio.service';

const providers: Provider[] = [
  AppConfigService,
  EmailService,
  TwilioService,
  RedisService,
  CacheService,
];

@Global()
@Module({
  providers,
  imports: [CqrsModule, DatabaseModule, RepositoryModule],
  exports: [...providers, CqrsModule, DatabaseModule, RepositoryModule],
})
export class SharedModule {}
