import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PushTokensController } from './controllers/push-tokens.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushSenderService } from './services/push-sender.service';
import { PushTokenCleanupService } from './services/push-token-cleanup.service';
import { PushTokensService } from './services/push-tokens.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NotificationsController, PushTokensController],
  providers: [NotificationsService, PushTokensService, PushSenderService, PushTokenCleanupService],
  exports: [PushSenderService],
})
export class NotificationsModule {}
