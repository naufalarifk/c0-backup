import type { AnyNotificationPayload, NotificationData } from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertProp, assertPropString, check, isNumber, isString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoanApplicationMatchedNotificationData = NotificationData & {
  type: 'LoanApplicationMatched';
  userId: string | number;
  userEmail?: string;
  loanApplicationId: string;
  loanOfferId: string;
  principalAmount: string;
  interestRate: string;
  termInMonths: string;
  matchedDate: string;
};

export function assertLoanApplicationMatchedNotificationParam(
  data: unknown,
): asserts data is LoanApplicationMatchedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertProp(
    (value: unknown): value is 'LoanApplicationMatched' => value === 'LoanApplicationMatched',
    data,
    'type',
  );
  assertProp(check(isString, isNumber), data, 'userId');
  assertPropString(data, 'loanApplicationId');
  assertPropString(data, 'loanOfferId');
  assertPropString(data, 'principalAmount');
  assertPropString(data, 'interestRate');
  assertPropString(data, 'termInMonths');
  assertPropString(data, 'matchedDate');
}

@Injectable()
@Composer('LoanApplicationMatched')
export class LoanApplicationMatchedNotificationComposer extends NotificationComposer<LoanApplicationMatchedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanApplicationMatchedNotificationParam(data);

    const payloads: AnyNotificationPayload[] = [];
    const userId = String(data.userId);
    const title = 'Loan Application Matched!';
    const content = `Your loan application has been matched with a lender. Principal: $${data.principalAmount}, Rate: ${data.interestRate}%, Term: ${data.termInMonths} months.`;

    // Database notification (always save to database)
    payloads.push({
      channel: NotificationChannelEnum.Database,
      userId,
      type: 'LoanApplicationMatched',
      title,
      content,
    });

    // Realtime notification (always publish for connected clients)
    payloads.push({
      channel: NotificationChannelEnum.Realtime,
      userId,
      type: 'LoanApplicationMatched',
      title,
      content,
      metadata: {
        loanApplicationId: data.loanApplicationId,
        loanOfferId: data.loanOfferId,
        principalAmount: data.principalAmount,
        interestRate: data.interestRate,
        termInMonths: data.termInMonths,
        matchedDate: data.matchedDate,
      },
    });

    // Email notification if email is available
    if (data.userEmail) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: data.userEmail,
        subject: 'Great News! Your Loan Application Has Been Matched',
        htmlBody: this.renderEmailHtmlBody(data),
        textBody: this.renderEmailTextBody(data),
      });
    }

    return payloads;
  }

  private renderEmailHtmlBody(data: LoanApplicationMatchedNotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50;">Loan Application Matched! 🎉</h1>
        
        <p>Congratulations! We found a perfect match for your loan application.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #27ae60; margin-top: 0;">Match Details:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Principal Amount:</strong> $${data.principalAmount}</li>
            <li><strong>Interest Rate:</strong> ${data.interestRate}% per year</li>
            <li><strong>Term:</strong> ${data.termInMonths} months</li>
            <li><strong>Matched Date:</strong> ${new Date(data.matchedDate).toLocaleDateString()}</li>
          </ul>
        </div>
        
        <p>Your loan application has been successfully matched with a lender. The next steps will be processed automatically, and you'll receive updates as your loan progresses through our system.</p>
        
        <div style="margin: 30px 0; padding: 15px; background-color: #e8f4f8; border-left: 4px solid #3498db; border-radius: 4px;">
          <p style="margin: 0;"><strong>Next Steps:</strong></p>
          <p style="margin: 5px 0 0 0;">• Loan origination will be processed automatically<br>
          • You'll receive confirmation once funds are ready<br>
          • Monitor your loan status in the app</p>
        </div>
        
        <p>Thank you for choosing CryptoGadai for your lending needs!</p>
        
        <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
        <p style="color: #7f8c8d; font-size: 12px;">
          This is an automated notification from CryptoGadai. Please do not reply to this email.
        </p>
      </div>
    `;
  }

  private renderEmailTextBody(data: LoanApplicationMatchedNotificationData): string {
    return `
Loan Application Matched!

Congratulations! We found a perfect match for your loan application.

Match Details:
- Principal Amount: $${data.principalAmount}
- Interest Rate: ${data.interestRate}% per year
- Term: ${data.termInMonths} months
- Matched Date: ${new Date(data.matchedDate).toLocaleDateString()}

Your loan application has been successfully matched with a lender. The next steps will be processed automatically, and you'll receive updates as your loan progresses through our system.

Next Steps:
• Loan origination will be processed automatically
• You'll receive confirmation once funds are ready
• Monitor your loan status in the app

Thank you for choosing CryptoGadai for your lending needs!

This is an automated notification from CryptoGadai.
    `.trim();
  }
}
