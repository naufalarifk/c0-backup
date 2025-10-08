import type { AnyNotificationPayload, APNSNotificationPayload } from '../notification.types';

import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.APN)
export class APNSNotificationProvider extends NotificationProvider {
  private readonly logger = new TelemetryLogger(APNSNotificationProvider.name);

  isSendablePayload(payload: AnyNotificationPayload): payload is APNSNotificationPayload {
    return payload.channel.includes(NotificationChannelEnum.APN);
  }

  async send(notification: APNSNotificationPayload): Promise<void> {
    try {
      this.logger.log(
        `Sending APNS notification to ${notification.to} with title "${notification.title}"`,
      );

      // TODO: Implement Apple Push Notification Service integration
      // Example implementation would use node-apn or firebase-admin SDK:
      // const apnProvider = new apn.Provider(apnOptions);
      // const note = new apn.Notification();
      // note.alert = {
      //   title: notification.title,
      //   body: notification.body,
      // };
      // note.sound = notification.sound || 'default';
      // note.badge = notification.badge;
      // note.category = notification.category;
      // await apnProvider.send(note, notification.to);

      this.logger.warn(
        'APNS provider not implemented - notification would be sent to:',
        notification.to,
      );
    } catch (error) {
      this.logger.error(`Failed to send APNS notification to ${notification.to}:`, error);
      throw error;
    }
  }
}
