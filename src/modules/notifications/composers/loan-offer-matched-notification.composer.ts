import type {
  AnyNotificationPayload,
  APNSNotificationPayload,
  EmailNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropString, hasProp } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoanOfferMatchedNotificationData = NotificationData & {
  type: 'LoanOfferMatched';
  userId: string;
  email?: string;
  phoneNumber?: string;
  deviceToken?: string;
  loanOfferId: string;
  amount: string;
  interestRate: string;
  term?: string;
  matchScore?: string;
};

function assertLoanOfferMatchedNotificationData(
  data: unknown,
): asserts data is LoanOfferMatchedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  if (hasProp(data, 'deviceToken')) {
    assertPropString(data, 'deviceToken', 'Device token is required');
  }
  assertPropString(data, 'loanOfferId', 'Loan offer ID is required');
  assertPropString(data, 'amount', 'Amount is required');
  assertPropString(data, 'interestRate', 'Interest rate is required');
}

@Injectable()
@Composer('LoanOfferMatched')
export class LoanOfferMatchedNotificationComposer extends NotificationComposer<LoanOfferMatchedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanOfferMatchedNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];

    // Send email notification if email is present
    if (data.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: data.email,
        subject: 'New Loan Offer Available - CryptoGadai',
        htmlBody: this.renderEmailHtmlBody(data),
        textBody: this.renderEmailTextBody(data),
      } as EmailNotificationPayload);
    }

    // Send SMS notification if phoneNumber is present
    if (data.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: `New loan offer: $${data.amount} at ${data.interestRate}${data.term ? ` for ${data.term}` : ''}. Review: /loans/${data.loanOfferId}`,
      } as SMSNotificationPayload);
    }

    // Send APNS notification if deviceToken is present
    if (data.deviceToken) {
      payloads.push({
        channel: NotificationChannelEnum.APN,
        to: data.deviceToken,
        title: 'Loan Offer Matched',
        body: `New loan offer: ${data.amount} at ${data.interestRate}${data.term ? ` for ${data.term}` : ''}`,
        badge: 1,
      } as APNSNotificationPayload);
    }

    return payloads;
  }

  private renderEmailHtmlBody(data: LoanOfferMatchedNotificationData): string {
    return `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Loan Offer Available!</h2>
            <p>Great news! We found a loan offer that matches your requirements.</p>
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #007bff; margin-top: 0;">Loan Offer Details</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Amount:</strong> $${data.amount}</li>
                <li><strong>Interest Rate:</strong> ${data.interestRate}</li>
                ${data.term ? `<li><strong>Term:</strong> ${data.term}</li>` : ''}
                ${data.matchScore ? `<li><strong>Match Score:</strong> ${data.matchScore}</li>` : ''}
              </ul>
            </div>
            <p style="margin-top: 30px;">
              <a href="/loans/${data.loanOfferId}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                Review Offer
              </a>
            </p>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              This offer is available for a limited time. Log in to your account to review the complete terms and conditions.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private renderEmailTextBody(data: LoanOfferMatchedNotificationData): string {
    return `
New Loan Offer Available!

Great news! We found a loan offer that matches your requirements.

Loan Offer Details:
- Amount: $${data.amount}
- Interest Rate: ${data.interestRate}
${data.term ? `- Term: ${data.term}` : ''}
${data.matchScore ? `- Match Score: ${data.matchScore}` : ''}

Review this offer by logging into your account: /loans/${data.loanOfferId}

This offer is available for a limited time. Log in to your account to review the complete terms and conditions.
    `.trim();
  }
}
