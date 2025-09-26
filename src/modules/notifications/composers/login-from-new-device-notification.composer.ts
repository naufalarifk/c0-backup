import type {
  AnyNotificationPayload,
  EmailNotificationPayload,
  FCMNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoginFromNewDeviceNotificationData = NotificationData & {
  type: 'LoginFromNewDevice';
  userId: string;
  email?: string;
  phoneNumber?: string;
  deviceToken?: string;
  fcmToken?: string;
  apnsToken?: string;
  deviceInfo?: string;
  location?: string;
  ipAddress?: string;
  timestamp?: string;
};

function assertLoginFromNewDeviceNotificationData(
  data: unknown,
): asserts data is LoginFromNewDeviceNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId');
}

@Injectable()
@Composer('LoginFromNewDevice')
export class LoginFromNewDeviceNotificationComposer extends NotificationComposer<LoginFromNewDeviceNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoginFromNewDeviceNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];
    const deviceInfo = data.deviceInfo || 'Unknown Device';
    const location = data.location || 'Unknown Location';
    const timestamp = data.timestamp || new Date().toISOString();

    // Email notification
    if (data.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: data.email,
        subject: 'Security Alert - New Device Login',
        htmlBody: this.renderEmailHtmlBody(data.email, deviceInfo, location, timestamp),
        textBody: this.renderEmailTextBody(data.email, deviceInfo, location, timestamp),
      } as EmailNotificationPayload);
    }

    // SMS notification
    if (data.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: `Security Alert: New login from ${deviceInfo} in ${location}. If this wasn't you, secure your account immediately. - CryptoGadai`,
      } as SMSNotificationPayload);
    }

    // FCM notification
    if (data.deviceToken || data.fcmToken) {
      payloads.push({
        channel: NotificationChannelEnum.FCM,
        to: data.deviceToken || data.fcmToken!,
        title: 'Security Alert - New Device Login',
        body: `New login detected from ${deviceInfo}`,
        data: {
          type: 'LoginFromNewDevice',
          userId: data.userId,
          location: location,
          deviceInfo: deviceInfo,
          timestamp: timestamp,
        },
      } as FCMNotificationPayload);
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
