import type { Provider } from '@nestjs/common';

import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { DatabaseModule } from './database/database.module';
import { ConfigService } from './services/config.service';
import { EmailService } from './services/email.service';
import { TwilioService } from './services/twilio.service';

const providers: Provider[] = [ConfigService, EmailService, TwilioService];

@Global()
@Module({
  providers,
  imports: [CqrsModule, DatabaseModule],
  exports: [...providers, CqrsModule, DatabaseModule],
})
export class SharedModule {}
