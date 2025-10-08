import type { AnyNotificationPayload, FCMNotificationPayload } from '../notification.types';

import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.FCM)
export class FCMNotificationProvider extends NotificationProvider {
  private readonly logger = new TelemetryLogger(FCMNotificationProvider.name);

  isSendablePayload(payload: AnyNotificationPayload): payload is FCMNotificationPayload {
    return payload.channel.includes(NotificationChannelEnum.FCM);
  }

  async send(notification: FCMNotificationPayload): Promise<void> {
    try {
      this.logger.log(
        `Sending FCM notification to ${notification.to} with title "${notification.title}"`,
      );

      // TODO: Implement Firebase Cloud Messaging integration
      // Example implementation would use firebase-admin SDK:
      // await admin.messaging().send({
      //   token: notification.to,
      //   notification: {
      //     title: notification.title,
      //     body: notification.body,
      //     imageUrl: notification.icon,
      //   },
      //   data: notification.data,
      //   android: {
      //     notification: {
      //       clickAction: notification.clickAction,
      //       sound: notification.sound,
      //       tag: notification.badge,
      //     },
      //   },
      // });

      this.logger.warn(
        'FCM provider not implemented - notification would be sent to:',
        notification.to,
      );
    } catch (error) {
      this.logger.error(`Failed to send FCM notification to ${notification.to}:`, error);
      throw error;
    }
  }
}
