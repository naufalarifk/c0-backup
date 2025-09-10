import type { AnyNotificationPayload } from './notification.types';

export abstract class NotificationProvider {
  abstract isSendablePayload(payload: AnyNotificationPayload): boolean;
  abstract send(notification: AnyNotificationPayload): Promise<void>;
}
