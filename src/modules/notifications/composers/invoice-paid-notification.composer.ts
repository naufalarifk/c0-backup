import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type SMSInvoicePaidNotificationData = NotificationData & {
  phoneNumber: string;
  invoiceId: string;
  amount?: string;
  name?: string;
};

function assertSMSInvoicePaidNotificationData(
  data: unknown,
): asserts data is SMSInvoicePaidNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  assertPropString(data, 'invoiceId', 'Invoice ID is required');
  if (typeof data === 'object' && data !== null && 'amount' in data) {
    assertPropNullableString(data, 'amount');
  }
  if (typeof data === 'object' && data !== null && 'name' in data) {
    assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('InvoicePaid')
export class InvoicePaidNotificationComposer extends NotificationComposer<SMSInvoicePaidNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertSMSInvoicePaidNotificationData(data);
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload,
    ]);
  }

  private renderSMSMessage(data: SMSInvoicePaidNotificationData): string {
    const amountText = data.amount ? ` of ${data.amount}` : '';
    return `Hi ${data.name || 'there'}! Your invoice has been paid${amountText} (Ref: #${data.invoiceId}) on CryptoGadai.`;
  }
}
