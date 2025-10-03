import type { AnyNotificationPayload, RealtimeNotificationPayload } from '../notification.types';

import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Realtime)
export class RealtimeNotificationProvider extends NotificationProvider {
  private readonly logger = new Logger(RealtimeNotificationProvider.name);
  private readonly realtimeChannel: string;

  constructor(
    private readonly redisService: RedisService,
    appConfigService: AppConfigService,
  ) {
    super();
    this.realtimeChannel = appConfigService.realtimeConfig.redisChannel;
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is RealtimeNotificationPayload {
    return payload.channel === NotificationChannelEnum.Realtime;
  }

  async send(payload: RealtimeNotificationPayload): Promise<void> {
    try {
      const realtimeEvent = {
        userId: payload.userId,
        type: 'notification.created',
        timestamp: new Date().toISOString(),
        data: {
          notificationId: payload.notificationId || 'pending',
          type: payload.type,
          title: payload.title,
          content: payload.content,
          createdAt: new Date().toISOString(),
          metadata: payload.metadata,
        },
      };

      await this.redisService.publish(this.realtimeChannel, realtimeEvent);

      this.logger.log(
        `Published realtime notification event for user ${payload.userId}: ${payload.type}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish realtime notification for user ${payload.userId}:`,
        error,
      );
      throw error;
    }
  }
}
