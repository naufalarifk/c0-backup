import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { DatabaseModule } from './modules/database.module';
import { ConfigService } from './services/config.service';

const providers: Provider[] = [ConfigService];

@Global()
@Module({
  providers,
  imports: [CqrsModule, DatabaseModule],
  exports: [...providers, CqrsModule, DatabaseModule],
})
export class SharedModule {}
