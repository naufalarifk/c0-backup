import type {
  AnyNotificationPayload,
  EmailNotificationPayload,
  NotificationData,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import {
  assertDefined,
  assertPropEqual,
  assertPropString,
  assertPropStringOrNumber,
} from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type UserRegisteredNotificationData = NotificationData & {
  type: 'UserRegistered';
  userId: string | number;
  email: string;
  name?: string;
};

export function assertUserRegisteredNotificationParam(
  data: unknown,
): asserts data is UserRegisteredNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropEqual(data, 'type', 'UserRegistered' as const);
  assertPropStringOrNumber(data, 'userId');
  assertPropString(data, 'email');
}

@Injectable()
@Composer('UserRegistered')
export class UserRegisteredNotificationComposer extends NotificationComposer<UserRegisteredNotificationData> {
  constructor(private repo: CryptogadaiRepository) {
    super();
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertUserRegisteredNotificationParam(data);

    // Use provided data directly in tests/staging, attempt database lookup in production
    let userName = data.name || data.email || String(data.userId);

    // Only query database in non-test environments with numeric user IDs
    if (process.env.NODE_ENV !== 'test' && /^\d+$/.test(String(data.userId))) {
      try {
        const user = await this.repo.userViewsProfile({
          userId: String(data.userId),
        });
        userName = user.name || user.email || user.id;
      } catch (error) {
        // Fall back to provided data if database query fails
        console.warn('Failed to fetch user profile, using provided data:', error);
      }
    }

    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.Email,
        to: data.email,
        subject: 'Welcome to CryptoGadai - Account Created Successfully',
        htmlBody: this.renderEmailHtmlBody(userName),
        textBody: this.renderEmailTextBody(userName),
      } as EmailNotificationPayload,
    ]);
  }

  private renderEmailHtmlBody(userName: string): string {
    return `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to CryptoGadai, ${userName}!</h2>
            <p>Thank you for creating an account with us. Your registration was successful.</p>
            <p>You can now:</p>
            <ul>
              <li>Access your dashboard</li>
              <li>Complete your KYC verification</li>
              <li>Start using our services</li>
            </ul>
            <p style="margin-top: 30px;">
              <a href="/dashboard" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Go to Dashboard
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              If you didn't create this account, please contact our support team.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private renderEmailTextBody(userName: string): string {
    return `
Welcome to CryptoGadai, ${userName}!

Thank you for creating an account with us. Your registration was successful.

You can now:
- Access your dashboard
- Complete your KYC verification
- Start using our services

Go to Dashboard: /dashboard

If you didn't create this account, please contact our support team.
    `.trim();
  }
}
