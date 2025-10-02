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

export type LoginFromNewDeviceNotificationData = NotificationData & {
  type: 'LoginFromNewDevice';
  userId: string;
  deviceInfo?: string;
  location?: string;
  ipAddress?: string;
  timestamp?: string;
} & Partial<UserNotificationData>;

function assertLoginFromNewDeviceNotificationData(
  data: unknown,
): asserts data is LoginFromNewDeviceNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId');
}

@Injectable()
@Composer('LoginFromNewDevice')
export class LoginFromNewDeviceNotificationComposer extends NotificationComposer<LoginFromNewDeviceNotificationData> {
  constructor(repository: CryptogadaiRepository) {
    super(repository);
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoginFromNewDeviceNotificationData(data);

    // ✨ Smart enrichment: Auto-fetch and merge user contact data
    const enrichedData = await this.enrichWithUserData(data);

    const payloads: AnyNotificationPayload[] = [];
    const deviceInfo = enrichedData.deviceInfo || 'Unknown Device';
    const location = enrichedData.location || 'Unknown Location';
    const timestamp = enrichedData.timestamp || new Date().toISOString();

    // Email notification
    if (enrichedData.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: enrichedData.email,
        subject: 'Security Alert - New Device Login',
        htmlBody: this.renderEmailHtmlBody(enrichedData.email, deviceInfo, location, timestamp),
        textBody: this.renderEmailTextBody(enrichedData.email, deviceInfo, location, timestamp),
      } as EmailNotificationPayload);
    }

    // SMS notification
    if (enrichedData.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: enrichedData.phoneNumber,
        message: `Security Alert: New login from ${deviceInfo} in ${location}. If this wasn't you, secure your account immediately. - CryptoGadai`,
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
        title: 'Security Alert - New Device Login',
        body: `New login detected from ${deviceInfo}`,
        priority: 'high',
        data: {
          type: 'LoginFromNewDevice',
          userId: enrichedData.userId,
          location: location,
          deviceInfo: deviceInfo,
          timestamp: timestamp,
        },
      } as ExpoNotificationPayload);
    }

    return payloads;
  }

  private renderEmailHtmlBody(
    email: string,
    deviceInfo: string,
    location: string,
    timestamp: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert - New Device Login</title>
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
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🚨 Security Alert</h1>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2 style="margin: 0 0 10px 0; color: #dc2626;">New Device Login Detected</h2>
                <p>We detected a login to your CryptoGadai account from a new device.</p>
            </div>
            <h3>Login Details:</h3>
            <div class="detail-row">
                <div class="detail-label">Device:</div>
                <div class="detail-value">${deviceInfo}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Location:</div>
                <div class="detail-value">${location}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Time:</div>
                <div class="detail-value">${new Date(timestamp).toLocaleString()}</div>
            </div>
            <p>If this was you, you can ignore this message. If you don't recognize this activity, please secure your account immediately.</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} CryptoGadai. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private renderEmailTextBody(
    email: string,
    deviceInfo: string,
    location: string,
    timestamp: string,
  ): string {
    return `
Security Alert - New Device Login

We detected a login to your CryptoGadai account from a new device.

Login Details:
Device: ${deviceInfo}
Location: ${location}
Time: ${new Date(timestamp).toLocaleString()}

If this was you, you can ignore this message. If you don't recognize this activity, please secure your account immediately.

© ${new Date().getFullYear()} CryptoGadai. All rights reserved.
    `.trim();
  }
}
