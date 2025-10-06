import type { AnyNotificationPayload } from './notification.types';

export interface NotificationSendResult {
  notificationId?: string;
}

export abstract class NotificationProvider {
  abstract isSendablePayload(payload: AnyNotificationPayload): boolean;
  abstract send(notification: AnyNotificationPayload): Promise<NotificationSendResult | void>;
}
