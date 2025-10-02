import type {
  AnyNotificationPayload,
  EmailNotificationPayload,
  ExpoNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropString } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { NotificationChannelEnum } from '../notification.types';
import {
  Composer,
  NotificationComposer,
  type UserNotificationData,
} from '../notification-composer.abstract';

export type SuspiciousLoginAttemptNotificationData = NotificationData & {
  type: 'SuspiciousLoginAttempt';
  userId: string;
  location?: string;
  ipAddress?: string;
  timestamp?: string;
} & Partial<UserNotificationData>;

function assertSuspiciousLoginAttemptNotificationData(
  data: unknown,
): asserts data is SuspiciousLoginAttemptNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId');
}

@Injectable()
@Composer('SuspiciousLoginAttempt')
export class SuspiciousLoginAttemptNotificationComposer extends NotificationComposer<SuspiciousLoginAttemptNotificationData> {
  constructor(repository: CryptogadaiRepository) {
    super(repository);
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertSuspiciousLoginAttemptNotificationData(data);

    // ✨ Smart enrichment: Auto-fetch and merge user contact data
    const enrichedData = await this.enrichWithUserData(data);

    const payloads: AnyNotificationPayload[] = [];
    const location = enrichedData.location || 'Unknown Location';
    const timestamp = enrichedData.timestamp || new Date().toISOString();

    // Email notification
    if (enrichedData.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: enrichedData.email,
        subject: 'Security Alert - Suspicious Login Attempt',
        htmlBody: this.renderEmailHtmlBody(enrichedData.email, location, timestamp),
        textBody: this.renderEmailTextBody(enrichedData.email, location, timestamp),
      } as EmailNotificationPayload);
    }

    // SMS notification
    if (enrichedData.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: enrichedData.phoneNumber,
        message: `Security Alert: Suspicious login attempt from ${location}. If this wasn't you, secure your account immediately. - CryptoGadai`,
      } as SMSNotificationPayload);
    }

    // Expo notification - multi-device support
    const tokens =
      enrichedData.expoPushTokens ||
      (enrichedData.expoPushToken ? [enrichedData.expoPushToken] : []);
    for (const token of tokens) {
      payloads.push({
        channel: NotificationChannelEnum.Expo,
        to: token,
        title: 'Security Alert - Suspicious Activity',
        body: `Suspicious login attempt detected from ${location}`,
        priority: 'high',
        data: {
          type: 'SuspiciousLoginAttempt',
          userId: enrichedData.userId,
          location: location,
          timestamp: timestamp,
        },
      } as ExpoNotificationPayload);
    }

    return payloads;
  }

  private renderEmailHtmlBody(email: string, location: string, timestamp: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert - Suspicious Login Attempt</title>
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc; color: #334155; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .alert-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .detail-row { display: flex; margin: 10px 0; }
        .detail-label { font-weight: bold; width: 120px; }
        .detail-value { flex: 1; }
        .action-box { background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>⚠️ Security Alert</h1>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2 style="margin: 0 0 10px 0; color: #dc2626;">Suspicious Login Attempt Detected</h2>
                <p>We detected suspicious login activity on your CryptoGadai account that was blocked for your security.</p>
            </div>
            <h3>Attempt Details:</h3>
            <div class="detail-row">
                <div class="detail-label">Location:</div>
                <div class="detail-value">${location}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Time:</div>
                <div class="detail-value">${new Date(timestamp).toLocaleString()}</div>
            </div>
            <div class="action-box">
                <h3 style="margin: 0 0 10px 0; color: #0284c7;">What should you do?</h3>
                <ul>
                    <li>If this was you, you can ignore this message</li>
                    <li>If you don't recognize this activity, change your password immediately</li>
                    <li>Consider enabling two-factor authentication for added security</li>
                    <li>Contact our support team if you need assistance</li>
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} CryptoGadai. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private renderEmailTextBody(email: string, location: string, timestamp: string): string {
    return `
Security Alert - Suspicious Login Attempt

We detected suspicious login activity on your CryptoGadai account that was blocked for your security.

Attempt Details:
Location: ${location}
Time: ${new Date(timestamp).toLocaleString()}

What should you do?
- If this was you, you can ignore this message
- If you don't recognize this activity, change your password immediately
- Consider enabling two-factor authentication for added security
- Contact our support team if you need assistance

© ${new Date().getFullYear()} CryptoGadai. All rights reserved.
    `.trim();
  }
}
