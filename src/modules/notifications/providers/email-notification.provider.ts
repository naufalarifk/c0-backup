import type { AnyNotificationPayload, EmailNotificationPayload } from '../notification.types';

import { Injectable, Logger } from '@nestjs/common';

import { EmailService } from '../../../shared/services/email.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Email)
export class EmailNotificationProvider extends NotificationProvider {
  private readonly logger = new TelemetryLogger(EmailNotificationProvider.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is EmailNotificationPayload {
    return payload.channel.includes(NotificationChannelEnum.Email);
  }

  async send(notification: EmailNotificationPayload): Promise<void> {
    try {
      this.logger.log(
        `Sending email notification to ${notification.to} with subject "${notification.subject}"`,
      );

      await this.emailService.sendEmail({
        to: notification.to,
        cc: notification.cc,
        bcc: notification.bcc,
        replyTo: notification.replyTo,
        subject: notification.subject,
        html: notification.htmlBody,
        text: notification.textBody,
      });

      this.logger.log(`Email notification sent successfully to ${notification.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email notification to ${notification.to}:`, error);
      throw error;
    }
  }
}
