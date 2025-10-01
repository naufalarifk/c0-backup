import type {
  AnyNotificationPayload,
  APNSNotificationPayload,
  EmailNotificationPayload,
  ExpoNotificationPayload,
  FCMNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropString, hasPropDefined } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { NotificationChannelEnum } from '../notification.types';
import {
  Composer,
  NotificationComposer,
  type UserNotificationData,
} from '../notification-composer.abstract';

export type LoanRepaymentDueNotificationData = NotificationData & {
  type: 'LoanRepaymentDue';
  userId: string;
  loanId: string;
  amount?: string;
  currency?: string;
  dueDate: string;
} & Partial<UserNotificationData>;

function assertLoanRepaymentDueNotificationData(
  data: unknown,
): asserts data is LoanRepaymentDueNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId');
  assertPropString(data, 'loanId');
  assertPropString(data, 'dueDate');
  if (hasPropDefined(data, 'amount')) {
    assertPropString(data, 'amount');
  }
}

@Injectable()
@Composer('LoanRepaymentDue')
export class LoanRepaymentDueNotificationComposer extends NotificationComposer<LoanRepaymentDueNotificationData> {
  constructor(repository: CryptogadaiRepository) {
    super(repository);
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanRepaymentDueNotificationData(data);

    // ✨ ONE LINE: Auto-fetch and merge user contact data - now even cleaner!
    const enrichedData = await this.enrichWithUserData(data);

    const payloads: AnyNotificationPayload[] = [];
    const formattedAmount = enrichedData.amount
      ? enrichedData.currency
        ? `${enrichedData.amount} ${enrichedData.currency}`
        : enrichedData.amount
      : 'your payment';
    const formattedDate = new Date(enrichedData.dueDate).toLocaleDateString();

    // Email notification
    if (enrichedData.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: enrichedData.email,
        subject: 'Loan Payment Due - Action Required',
        htmlBody: this.renderEmailHtmlBody(formattedAmount, formattedDate),
        textBody: this.renderEmailTextBody(formattedAmount, formattedDate),
      } as EmailNotificationPayload);
    }

    // SMS notification
    if (enrichedData.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: enrichedData.phoneNumber,
        message: `Payment reminder: Your loan repayment of ${formattedAmount} is due on ${formattedDate}. Pay now to avoid late fees. - CryptoGadai`,
      } as SMSNotificationPayload);
    }

    // FCM notification
    if (enrichedData.deviceToken || enrichedData.fcmToken) {
      payloads.push({
        channel: NotificationChannelEnum.FCM,
        to: enrichedData.deviceToken || enrichedData.fcmToken!,
        title: 'Payment Due',
        body: `Your loan repayment of ${formattedAmount} is due on ${formattedDate}`,
        data: {
          type: 'LoanRepaymentDue',
          loanId: enrichedData.loanId,
          amount: enrichedData.amount,
          dueDate: enrichedData.dueDate,
        },
      } as FCMNotificationPayload);
    }

    // APNS notification
    if (enrichedData.apnsToken) {
      payloads.push({
        channel: NotificationChannelEnum.APN,
        to: enrichedData.apnsToken,
        title: 'Payment Due',
        body: `Your loan repayment of ${formattedAmount} is due on ${formattedDate}`,
        badge: 1,
      } as APNSNotificationPayload);
    }

    // Expo notification - multi-device support
    const tokens =
      enrichedData.expoPushTokens ||
      (enrichedData.expoPushToken ? [enrichedData.expoPushToken] : []);
    for (const token of tokens) {
      payloads.push({
        channel: NotificationChannelEnum.Expo,
        to: token,
        title: 'Payment Due',
        body: `Your loan repayment of ${formattedAmount} is due on ${formattedDate}`,
        priority: 'high',
        data: {
          type: 'LoanRepaymentDue',
          loanId: enrichedData.loanId,
          amount: enrichedData.amount,
          dueDate: enrichedData.dueDate,
        },
      } as ExpoNotificationPayload);
    }

    return payloads;
  }

  private renderEmailHtmlBody(formattedAmount: string, formattedDate: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loan Repayment Due</title>
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc; color: #334155; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .amount-box { background-color: #e0f2fe; border-left: 4px solid #0284c7; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center; }
        .amount { font-size: 32px; font-weight: bold; color: #0369a1; margin: 10px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 15px 0; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .detail-label { font-weight: bold; color: #64748b; }
        .detail-value { color: #1e293b; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>💰 Payment Due</h1>
        </div>
        <div class="content">
            <h2>Loan Repayment Due</h2>
            <p>Your loan repayment is due. Please ensure you have sufficient funds available.</p>

            <div class="amount-box">
                <div style="font-size: 16px; color: #64748b;">Amount Due</div>
                <div class="amount">${formattedAmount}</div>
            </div>

            <div class="detail-row">
                <div class="detail-label">Due Date:</div>
                <div class="detail-value">${formattedDate}</div>
            </div>

            <p>Please make your payment before the due date to avoid any late fees. If you have any questions or need assistance, please contact our support team.</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} CryptoGadai. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  private renderEmailTextBody(formattedAmount: string, formattedDate: string): string {
    return `
Loan Repayment Due

Your loan repayment is due. Please ensure you have sufficient funds available.

Amount Due: ${formattedAmount}
Due Date: ${formattedDate}

Please make your payment before the due date to avoid any late fees. If you have any questions or need assistance, please contact our support team.

© ${new Date().getFullYear()} CryptoGadai. All rights reserved.
    `.trim();
  }
}
