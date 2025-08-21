import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { DatabaseModule } from './modules/database.module';
import { ConfigService } from './services/config.service';
import { VaultModule } from './vault/vault.module';

const providers: Provider[] = [ConfigService];

@Global()
@Module({
  providers,
  imports: [CqrsModule, DatabaseModule, VaultModule],
  exports: [...providers, CqrsModule, DatabaseModule, VaultModule],
})
export class SharedModule {}
