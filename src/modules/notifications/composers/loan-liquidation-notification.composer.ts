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

export type LoanLiquidationNotificationData = NotificationData & {
  type: 'LoanLiquidation';
  userId: string;
  loanId: string;
  liquidationAmount: string;
  originalAmount?: string;
  collateralType?: string;
} & Partial<UserNotificationData>;

function assertLoanLiquidationNotificationData(
  data: unknown,
): asserts data is LoanLiquidationNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  assertPropString(data, 'loanId', 'Loan ID is required');
  assertPropString(data, 'liquidationAmount', 'Liquidation amount is required');
}

@Injectable()
@Composer('LoanLiquidation')
export class LoanLiquidationNotificationComposer extends NotificationComposer<LoanLiquidationNotificationData> {
  constructor(repository: CryptogadaiRepository) {
    super(repository);
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanLiquidationNotificationData(data);

    // ✨ Smart enrichment: Auto-fetch and merge user contact data
    const enrichedData = await this.enrichWithUserData(data);

    const payloads: AnyNotificationPayload[] = [];

    // Send email notification if email is present
    if (enrichedData.email) {
      payloads.push({
        channel: NotificationChannelEnum.Email,
        to: enrichedData.email,
        subject: 'Urgent: Loan Liquidation Notice - CryptoGadai',
        htmlBody: this.renderEmailHtmlBody(enrichedData),
        textBody: this.renderEmailTextBody(enrichedData),
      } as EmailNotificationPayload);
    }

    // Send SMS notification if phoneNumber is present
    if (enrichedData.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: enrichedData.phoneNumber,
        message: `URGENT: Your loan ${enrichedData.loanId} has been liquidated for $${enrichedData.liquidationAmount}. Please check your account immediately.`,
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
        title: 'Loan Liquidation Alert',
        body: `Your loan has been liquidated for $${enrichedData.liquidationAmount}`,
        priority: 'high',
        data: {
          type: 'LoanLiquidation',
          loanId: enrichedData.loanId,
          liquidationAmount: enrichedData.liquidationAmount,
        },
      } as ExpoNotificationPayload);
    }

    return payloads;
  }

  private renderEmailHtmlBody(data: LoanLiquidationNotificationData): string {
    return `
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">URGENT: Loan Liquidation Notice</h2>
            <p style="color: #721c24; background-color: #f8d7da; padding: 15px; border: 1px solid #f5c6cb; border-radius: 5px;">
              <strong>Your loan has been liquidated due to insufficient collateral value.</strong>
            </p>
            
            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #dc3545; margin-top: 0;">Liquidation Details</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Loan ID:</strong> ${data.loanId}</li>
                <li><strong>Liquidation Amount:</strong> $${data.liquidationAmount}</li>
                ${data.originalAmount ? `<li><strong>Original Amount:</strong> $${data.originalAmount}</li>` : ''}
                ${data.collateralType ? `<li><strong>Collateral Type:</strong> ${data.collateralType}</li>` : ''}
              </ul>
            </div>

            <p>This liquidation was triggered to protect both you and the lender from further losses due to declining collateral value.</p>
            
            <p style="margin-top: 30px;">
              <a href="/loans/${data.loanId}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                View Loan Details
              </a>
            </p>
            
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              If you have questions about this liquidation, please contact our support team immediately.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  private renderEmailTextBody(data: LoanLiquidationNotificationData): string {
    return `
URGENT: Loan Liquidation Notice

Your loan has been liquidated due to insufficient collateral value.

Liquidation Details:
- Loan ID: ${data.loanId}
- Liquidation Amount: $${data.liquidationAmount}
${data.originalAmount ? `- Original Amount: $${data.originalAmount}` : ''}
${data.collateralType ? `- Collateral Type: ${data.collateralType}` : ''}

This liquidation was triggered to protect both you and the lender from further losses due to declining collateral value.

View your loan details: /loans/${data.loanId}

If you have questions about this liquidation, please contact our support team immediately.
    `.trim();
  }
}
