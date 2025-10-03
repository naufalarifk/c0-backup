import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';

import { CryptographyModule } from './cryptography/cryptography.module';
import { TelemetryInterceptor } from './interceptors';
import { InvoiceService } from './invoice/invoice.service';
import { InvoiceIdGenerator } from './invoice/invoice-id.generator';
import { RepositoryModule } from './repositories/repository.module';
import { AppConfigService } from './services/app-config.service';
import { CacheService } from './services/cache.service';
import { CgTestnetBlockchainEventService } from './services/cg-testnet-blockchain-event.service';
import { EmailService } from './services/email.service';
import { FileValidatorService } from './services/file-validator.service';
import { MailerService } from './services/mailer.service';
import { MinioService } from './services/minio.service';
import { MinioMockController } from './services/minio-mock.controller';
import { MinioMockService } from './services/minio-mock.service';
import { PlatformConfigService } from './services/platform-config.service';
import { RedisService } from './services/redis.service';
import { TelemetryService } from './services/telemetry.service';
import { TwilioService } from './services/twilio.service';
import { WalletModule } from './wallets/wallet.module';

const providers: Provider[] = [
  AppConfigService,
  CacheService,
  PlatformConfigService,
  EmailService,
  FileValidatorService,
  MailerService,
  RedisService,
  TelemetryInterceptor,
  TelemetryService,
  CgTestnetBlockchainEventService,
  TwilioService,
  InvoiceIdGenerator,
  InvoiceService,
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
  imports: [CryptographyModule, RepositoryModule, WalletModule],
  controllers: [MinioMockController],
  exports: [...providers, CryptographyModule, RepositoryModule, WalletModule],
})
export class SharedModule {}
