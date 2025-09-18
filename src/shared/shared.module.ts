import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { CryptographyModule } from './cryptography/cryptography.module';
import { TelemetryInterceptor } from './interceptors';
import { RepositoryModule } from './repositories/repository.module';
import { AppConfigService } from './services/app-config.service';
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { FileValidatorService } from './services/file-validator.service';
import { MailerService } from './services/mailer.service';
import { MinioService } from './services/minio.service';
import { MinioMockController } from './services/minio-mock.controller';
import { MinioMockService } from './services/minio-mock.service';
import { RedisService } from './services/redis.service';
import { TelemetryService } from './services/telemetry.service';
import { TwilioService } from './services/twilio.service';
import { WalletsModule } from './wallets/wallets.module';

const providers: Provider[] = [
  AppConfigService,
  CacheService,
  EmailService,
  FileValidatorService,
  MailerService,
  RedisService,
  TelemetryInterceptor,
  TelemetryService,
  TwilioService,
  {
    provide: MinioService,
    inject: [AppConfigService],
    useFactory(appConfigService: AppConfigService) {
      if (appConfigService.minioConfig.endpoint === 'local') {
        return new MinioMockService(appConfigService);
      }

      return new MinioService(appConfigService);
    },
  },
];

@Global()
@Module({
  providers,
  imports: [CqrsModule, CryptographyModule, RepositoryModule, WalletsModule],
  controllers: [MinioMockController],
  exports: [...providers, CqrsModule, CryptographyModule, RepositoryModule],
})
export class SharedModule {}
