import type { AnyNotificationPayload, NotificationData } from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoanOfferInvoiceFullyPaidNotificationData = NotificationData & {
  userId: string;
  invoiceId?: string;
  invoicedAmount?: string;
  paidAmount?: string;
};

function assertLoanOfferInvoiceFullyPaidNotificationData(
  data: unknown,
): asserts data is LoanOfferInvoiceFullyPaidNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  if (typeof data === 'object' && data !== null) {
    if ('invoiceId' in data) assertPropNullableString(data, 'invoiceId');
    if ('invoicedAmount' in data) assertPropNullableString(data, 'invoicedAmount');
    if ('paidAmount' in data) assertPropNullableString(data, 'paidAmount');
  }
}

@Injectable()
@Composer('LoanOfferInvoiceFullyPaid')
export class LoanOfferInvoiceFullyPaidNotificationComposer extends NotificationComposer<LoanOfferInvoiceFullyPaidNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanOfferInvoiceFullyPaidNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];
    const title = 'Loan Offer Invoice Fully Paid';
    const content = `Your loan offer invoice has been fully paid${data.paidAmount ? ` (${data.paidAmount})` : ''}.`;

    // Realtime notification (always publish for connected clients)
    payloads.push({
      channel: NotificationChannelEnum.Realtime,
      userId: data.userId,
      type: 'LoanOfferInvoiceFullyPaid',
      title,
      content,
      metadata: {
        invoiceId: data.invoiceId,
        invoicedAmount: data.invoicedAmount,
        paidAmount: data.paidAmount,
      },
    });

    // Push notification (only publish if user is offline)
    // payloads.push({
    //   channel: NotificationChannelEnum.Expo,
    //   type: 'LoanOfferInvoiceFullyPaid',
    //   title,
    //   content,
    //   metadata: {
    //     invoiceId: data.invoiceId,
    //     invoicedAmount: data.invoicedAmount,
    //     paidAmount: data.paidAmount,
    //   },
    // });

    return payloads;
  }
}
