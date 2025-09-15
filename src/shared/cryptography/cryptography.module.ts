import { Module } from '@nestjs/common';

import { AppConfigService } from '../services/app-config.service';
import { CryptographyService } from './cryptography.service';
import { LocalCryptographyService } from './local-cryptography.service';
import { VaultCryptographyService } from './vault-cryptography.service';

@Module({
  providers: [
    {
      provide: CryptographyService,
      inject: [AppConfigService],
      async useFactory(appConfig: AppConfigService) {
        if (appConfig.cryptographyConfig.engine === 'vault') {
          return new VaultCryptographyService(appConfig);
        } else if (appConfig.cryptographyConfig.engine === 'local') {
          return new LocalCryptographyService(appConfig);
        } else {
          throw new Error(
            `Unsupported cryptography engine: ${appConfig.cryptographyConfig.engine}`,
          );
        }
      },
    },
  ],
})
export class CryptographyModule {}
