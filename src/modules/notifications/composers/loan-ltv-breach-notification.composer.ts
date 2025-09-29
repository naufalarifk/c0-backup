import type {
  AnyNotificationPayload,
  APNSNotificationPayload,
  EmailNotificationPayload,
  FCMNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoanLtvBreachNotificationData = NotificationData & {
  type: 'LoanLtvBreach';
  userId: string;
  email?: string;
  phoneNumber?: string;
  fcmToken?: string;
  apnsToken?: string;
  loanId: string;
  currentLtv: string;
  thresholdLtv: string;
  collateralValue?: string;
  loanAmount?: string;
};

function assertLoanLtvBreachNotificationData(
  data: unknown,
): asserts data is LoanLtvBreachNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  assertPropString(data, 'loanId', 'Loan ID is required');
  assertPropString(data, 'currentLtv', 'Current LTV is required');
  assertPropString(data, 'thresholdLtv', 'Threshold LTV is required');
}

@Injectable()
@Composer('LoanLtvBreach')
export class LoanLtvBreachNotificationComposer extends NotificationComposer<LoanLtvBreachNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanLtvBreachNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];

    // Send email notification if email is present
    if (data.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: data.email,
        subject: 'Alert: LTV Threshold Breach - CryptoGadai',
        htmlBody: this.renderEmailHtmlBody(data),
        textBody: this.renderEmailTextBody(data),
      } as EmailNotificationPayload);
    }

    // Send SMS notification if phoneNumber is present
    if (data.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: `ALERT: Your loan ${data.loanId} LTV is ${data.currentLtv}, exceeding the ${data.thresholdLtv} threshold. Please add collateral to avoid liquidation.`,
      } as SMSNotificationPayload);
    }

    // Send FCM notification if fcmToken is present
    if (data.fcmToken) {
      payloads.push({
        channel: NotificationChannelEnum.FCM,
        to: data.fcmToken,
        title: 'LTV Alert - Action Required',
        body: `Your loan LTV is ${data.currentLtv}, exceeding ${data.thresholdLtv} threshold`,
        data: {
          loanId: data.loanId,
          currentLtv: data.currentLtv,
          thresholdLtv: data.thresholdLtv,
          type: 'LoanLtvBreach',
        },
      } as FCMNotificationPayload);
    }

    // Send APNS notification if apnsToken is present
    if (data.apnsToken) {
      payloads.push({
        channel: NotificationChannelEnum.APN,
        to: data.apnsToken,
        title: 'LTV Alert - Action Required',
        body: `Your loan LTV is ${data.currentLtv}, exceeding ${data.thresholdLtv} threshold`,
        badge: 1,
        sound: 'default',
      } as APNSNotificationPayload);
    }

    return payloads;
  }

  private renderEmailHtmlBody(data: LoanLtvBreachNotificationData): string {
    return `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #fd7e14;">LTV Threshold Breach Alert</h2>
            <p style="color: #721c24; background-color: #fff3cd; padding: 15px; border: 1px solid #ffeaa7; border-radius: 5px;">
              <strong>Your loan-to-value (LTV) ratio has exceeded the safety threshold.</strong>
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #fd7e14; margin-top: 0;">LTV Details</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Loan ID:</strong> ${data.loanId}</li>
                <li><strong>Current LTV:</strong> <span style="color: #dc3545; font-weight: bold;">${data.currentLtv}</span></li>
                <li><strong>Threshold LTV:</strong> ${data.thresholdLtv}</li>
                ${data.collateralValue ? `<li><strong>Collateral Value:</strong> $${data.collateralValue}</li>` : ''}
                ${data.loanAmount ? `<li><strong>Loan Amount:</strong> $${data.loanAmount}</li>` : ''}
              </ul>
            </div>

            <p><strong>Action Required:</strong> To prevent liquidation, you should add more collateral or partially repay your loan to bring the LTV below ${data.thresholdLtv}.</p>
            
            <p style="margin-top: 30px;">
              <a href="/loans/${data.loanId}" style="background-color: #fd7e14; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                Manage Loan
              </a>
            </p>
            
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              This is an automated alert to help protect your loan. Please take action promptly to avoid liquidation.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private renderEmailTextBody(data: LoanLtvBreachNotificationData): string {
    return `
LTV Threshold Breach Alert

Your loan-to-value (LTV) ratio has exceeded the safety threshold.

LTV Details:
- Loan ID: ${data.loanId}
- Current LTV: ${data.currentLtv}
- Threshold LTV: ${data.thresholdLtv}
${data.collateralValue ? `- Collateral Value: $${data.collateralValue}` : ''}
${data.loanAmount ? `- Loan Amount: $${data.loanAmount}` : ''}

Action Required: To prevent liquidation, you should add more collateral or partially repay your loan to bring the LTV below ${data.thresholdLtv}.

Manage your loan: /loans/${data.loanId}

This is an automated alert to help protect your loan. Please take action promptly to avoid liquidation.
    `.trim();
  }
}
