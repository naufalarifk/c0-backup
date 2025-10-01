import type { AnyNotificationPayload, ExpoNotificationPayload } from '../notification.types';

import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';
import { PushSenderService } from '../services/push-sender.service';

/**
 * Expo Notification Provider - Adapter for notification system
 * Delegates actual sending to PushSenderService for maintainability
 */
@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Expo)
export class ExpoNotificationProvider extends NotificationProvider {
  private readonly logger = new TelemetryLogger(ExpoNotificationProvider.name);

  constructor(private readonly pushSender: PushSenderService) {
    super();
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is ExpoNotificationPayload {
    return payload.channel === NotificationChannelEnum.Expo;
  }

  /**
   * Send single push notification via PushSenderService
   * Thin wrapper that adapts notification payload to PushSenderService format
   */
  async send(notification: ExpoNotificationPayload): Promise<void> {
    try {
      this.logger.log(
        `Sending Expo notification to ${notification.to} with title "${notification.title}"`,
      );

      // Delegate to PushSenderService with proper error handling
      const result = await this.pushSender.sendToTokens(
        [notification.to],
        notification.title,
        notification.body,
        notification.data,
      );

      if (result.failed > 0) {
        this.logger.error(
          `Failed to send notification to ${notification.to}. Sent: ${result.sent}, Failed: ${result.failed}`,
        );
        throw new Error(`Push notification delivery failed for token: ${notification.to}`);
      }

      this.logger.log(`Notification sent successfully to ${notification.to}`);
    } catch (error) {
      this.logger.error(`Failed to send Expo notification to ${notification.to}:`, error);
      throw error;
    }
  }
}
