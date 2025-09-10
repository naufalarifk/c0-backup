import type {
  AnyNotificationPayload,
  NotificationData,
  NotificationType,
} from './notification.types';

import { DiscoveryService } from '@nestjs/core';

export const Composer = DiscoveryService.createDecorator<NotificationType>();

export abstract class NotificationComposer<T extends NotificationData = NotificationData> {
  abstract composePayloads(data: T): Promise<AnyNotificationPayload[]>;
}
