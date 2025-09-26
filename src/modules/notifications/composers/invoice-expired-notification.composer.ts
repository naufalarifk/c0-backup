import type {
  AnyNotificationPayload,
  EmailNotificationPayload,
  NotificationData,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type InvoiceExpiredNotificationData = NotificationData & {
  type: 'InvoiceExpired';
  userId: string;
  invoiceId: string;
  invoiceType: string;
  currencySymbol: string;
  invoicedAmount: string;
  dueDate?: string;
  walletAddress: string;
  userEmail: string;
  userFirstName?: string;
};

function assertInvoiceExpiredNotificationData(
  data: unknown,
): asserts data is InvoiceExpiredNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  assertPropString(data, 'invoiceId', 'Invoice ID is required');
  assertPropString(data, 'invoiceType', 'Invoice type is required');
  assertPropString(data, 'currencySymbol', 'Currency symbol is required');
  assertPropString(data, 'invoicedAmount', 'Invoiced amount is required');
  assertPropString(data, 'walletAddress', 'Wallet address is required');
  assertPropString(data, 'userEmail', 'User email is required');
}

@Injectable()
@Composer('InvoiceExpired')
export class InvoiceExpiredNotificationComposer extends NotificationComposer<InvoiceExpiredNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertInvoiceExpiredNotificationData(data);

    const subject = 'Invoice Expired - Action Required';
    const dueDateText = data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'N/A';

    const emailPayload: EmailNotificationPayload = {
      channel: NotificationChannelEnum.Email,
      to: data.userEmail,
      subject,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Invoice Expired</h2>
          
          <p>Dear ${data.userFirstName || 'User'},</p>
          
          <p>Your invoice has expired and requires immediate attention:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #dc3545;">Invoice Details</h3>
            <p><strong>Invoice ID:</strong> ${data.invoiceId}</p>
            <p><strong>Type:</strong> ${data.invoiceType}</p>
            <p><strong>Amount:</strong> ${data.invoicedAmount} ${data.currencySymbol}</p>
            <p><strong>Due Date:</strong> ${dueDateText}</p>
            <p><strong>Wallet Address:</strong> ${data.walletAddress}</p>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">⚠️ Important Notice</h4>
            <p style="color: #856404; margin-bottom: 0;">
              This invoice has passed its due date and is now expired. Please contact our support team 
              if you need assistance or have any questions about this invoice.
            </p>
          </div>
          
          <div style="margin: 30px 0;">
            <p>If you believe this is an error, please contact our support team immediately.</p>
          </div>
          
          <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px; color: #6c757d; font-size: 12px;">
            <p>This is an automated notification from ${process.env.APP_NAME || 'CryptoGadai'}.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      `,
      textBody: `
        Invoice Expired - Action Required
        
        Dear ${data.userFirstName || 'User'},
        
        Your invoice has expired and requires immediate attention:
        
        Invoice Details:
        - Invoice ID: ${data.invoiceId}
        - Type: ${data.invoiceType}
        - Amount: ${data.invoicedAmount} ${data.currencySymbol}
        - Due Date: ${dueDateText}
        - Wallet Address: ${data.walletAddress}
        
        IMPORTANT NOTICE:
        This invoice has passed its due date and is now expired. Please contact our support team 
        if you need assistance or have any questions about this invoice.
        
        If you believe this is an error, please contact our support team immediately.
        
        ---
        This is an automated notification from ${process.env.APP_NAME || 'CryptoGadai'}.
        Please do not reply to this email.
      `,
    };

    return [emailPayload];
  }
}
