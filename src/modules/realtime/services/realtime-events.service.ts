import type { NotificationType } from '../../../shared/repositories/user.types';

import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { type RealtimeBroadcastEvent, RealtimeEventTypeEnum } from '../realtime.types';
import { RealtimeConnectionsService } from './realtime-connections.service';

export interface NotificationCreatedEventData {
  notificationId: string;
  type: NotificationType;
  title: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RealtimeEventsService {
  private readonly logger = new TelemetryLogger(RealtimeEventsService.name);

  constructor(private readonly connectionsService: RealtimeConnectionsService) {}

  /**
   * Broadcast a notification.created event to connected WebSocket clients
   */
  broadcastNotificationCreated(userId: string, data: NotificationCreatedEventData): void {
    try {
      const event: RealtimeBroadcastEvent<typeof RealtimeEventTypeEnum.NotificationCreated> = {
        userId,
        type: RealtimeEventTypeEnum.NotificationCreated,
        data,
        timestamp: new Date().toISOString(),
      };

      const recipientCount = this.connectionsService.broadcast(event);

      this.logger.log(
        `Broadcast notification.created to ${recipientCount} client(s) for user ${userId}: ${data.type}`,
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast notification.created for user ${userId}:`, error);
      // Don't throw - notification delivery via WebSocket is best-effort
    }
  }
}
