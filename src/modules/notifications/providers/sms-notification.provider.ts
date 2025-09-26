import type { AnyNotificationPayload, SMSNotificationPayload } from '../notification.types';

import { Injectable, Logger } from '@nestjs/common';

import { TwilioService } from '../../../shared/services/twilio.service';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.SMS)
export class SMSNotificationProvider extends NotificationProvider {
  private readonly logger = new Logger(SMSNotificationProvider.name);

  constructor(readonly _twilioService: TwilioService) {
    super();
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is SMSNotificationPayload {
    return payload.channel.includes(NotificationChannelEnum.SMS);
  }

  async send(notification: SMSNotificationPayload): Promise<void> {
    try {
      this.logger.log(`Sending SMS notification to ${notification.to}`);

      // Todo: Enable Twilio service when ready
      // await this.twilioService.sendSMS({
      //   to: notification.to,
      //   body: notification.message,
      // });

      this.logger.log(`SMS notification sent successfully to ${notification.to}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS notification to ${notification.to}:`, error);
      throw error;
    }
  }
}
