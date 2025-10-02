import type {
  AnyNotificationPayload,
  ExpoNotificationPayload,
  NotificationData,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type InvoiceCreatedNotificationData = NotificationData & {
  userId: string;
  deviceToken: string;
  invoiceId: string;
  amount: string;
  clickAction?: string;
};

function assertInvoiceCreatedNotificationData(
  data: unknown,
): asserts data is InvoiceCreatedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  assertPropString(data, 'deviceToken', 'Device token is required');
  assertPropString(data, 'invoiceId', 'Invoice ID is required');
  assertPropString(data, 'amount', 'Amount is required');
  assertPropNullableString(data, 'clickAction');
}

@Injectable()
@Composer('InvoiceCreated')
export class InvoiceCreatedNotificationComposer extends NotificationComposer<InvoiceCreatedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertInvoiceCreatedNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];

    // Expo notification
    payloads.push({
      channel: NotificationChannelEnum.Expo,
      to: data.deviceToken,
      title: 'New Invoice Created',
      body: `Invoice ${data.invoiceId} for ${data.amount} has been created`,
      data: {
        type: 'InvoiceCreated',
        invoiceId: data.invoiceId,
        amount: data.amount,
        clickAction: data.clickAction || `/invoices/${data.invoiceId}`,
      },
    } as ExpoNotificationPayload);

    return payloads;
  }
}
