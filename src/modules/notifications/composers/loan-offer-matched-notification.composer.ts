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

export type LoanOfferMatchedNotificationData = NotificationData & {
  type: 'LoanOfferMatched';
  userId: string;
  loanOfferId: string;
  amount: string;
  interestRate: string;
  term?: string;
  matchScore?: string;
} & Partial<UserNotificationData>;

function assertLoanOfferMatchedNotificationData(
  data: unknown,
): asserts data is LoanOfferMatchedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  assertPropString(data, 'loanOfferId', 'Loan offer ID is required');
  assertPropString(data, 'amount', 'Amount is required');
  assertPropString(data, 'interestRate', 'Interest rate is required');
}

@Injectable()
@Composer('LoanOfferMatched')
export class LoanOfferMatchedNotificationComposer extends NotificationComposer<LoanOfferMatchedNotificationData> {
  constructor(repository: CryptogadaiRepository) {
    super(repository);
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanOfferMatchedNotificationData(data);

    // ✨ Smart enrichment: Auto-fetch and merge user contact data
    const enrichedData = await this.enrichWithUserData(data);

    const payloads: AnyNotificationPayload[] = [];
    const title = 'Loan Offer Matched';
    const content = `Your loan offer has been matched with a borrower. Amount: $${enrichedData.amount}, Rate: ${enrichedData.interestRate}${enrichedData.term ? `, Term: ${enrichedData.term}` : ''}.`;

    // Database notification (always save to database)
    payloads.push({
      channel: NotificationChannelEnum.Database,
      userId: enrichedData.userId,
      type: 'LoanOfferMatched',
      title,
      content,
    });

    // Realtime notification (always publish for connected clients)
    payloads.push({
      channel: NotificationChannelEnum.Realtime,
      userId: enrichedData.userId,
      type: 'LoanOfferMatched',
      title,
      content,
      metadata: {
        loanOfferId: enrichedData.loanOfferId,
        amount: enrichedData.amount,
        interestRate: enrichedData.interestRate,
        term: enrichedData.term,
        matchScore: enrichedData.matchScore,
      },
    });

    // Send email notification if email is present
    if (enrichedData.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: enrichedData.email,
        subject: 'New Loan Offer Available - CryptoGadai',
        htmlBody: this.renderEmailHtmlBody(enrichedData),
        textBody: this.renderEmailTextBody(enrichedData),
      } as EmailNotificationPayload);
    }

    // Send SMS notification if phoneNumber is present
    if (enrichedData.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: enrichedData.phoneNumber,
        message: `New loan offer: $${enrichedData.amount} at ${enrichedData.interestRate}${enrichedData.term ? ` for ${enrichedData.term}` : ''}. Review: /loans/${enrichedData.loanOfferId}`,
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
        title: 'Loan Offer Matched',
        body: `New loan offer: ${enrichedData.amount} at ${enrichedData.interestRate}${enrichedData.term ? ` for ${enrichedData.term}` : ''}`,
        data: {
          type: 'LoanOfferMatched',
          loanOfferId: enrichedData.loanOfferId,
          amount: enrichedData.amount,
          interestRate: enrichedData.interestRate,
        },
      } as ExpoNotificationPayload);
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
