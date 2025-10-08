import type { AnyNotificationPayload, RealtimeNotificationPayload } from '../notification.types';

import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { RealtimeEventsService } from '../../realtime/services/realtime-events.service';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Realtime)
export class WebSocketNotificationProvider extends NotificationProvider {
  private readonly logger = new TelemetryLogger(WebSocketNotificationProvider.name);

  constructor(private readonly realtimeEventsService: RealtimeEventsService) {
    super();
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is RealtimeNotificationPayload {
    return payload.channel === NotificationChannelEnum.Realtime;
  }

  async send(payload: RealtimeNotificationPayload): Promise<void> {
    try {
      this.realtimeEventsService.broadcastNotificationCreated(payload.userId, {
        notificationId: payload.notificationId || 'pending',
        type: payload.type,
        title: payload.title,
        content: payload.content,
        createdAt: new Date().toISOString(),
        metadata: payload.metadata,
      });

      this.logger.log(
        `WebSocket notification provider called for user ${payload.userId}: ${payload.type}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send WebSocket notification for user ${payload.userId}:`, error);
      throw error;
    }
  }
}
