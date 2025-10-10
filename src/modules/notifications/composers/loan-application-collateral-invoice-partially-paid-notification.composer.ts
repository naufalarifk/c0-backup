import type { AnyNotificationPayload, NotificationData } from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoanApplicationCollateralInvoicePartiallyPaidNotificationData = NotificationData & {
  userId: string;
  invoiceId?: string;
  invoicedAmount?: string;
  paidAmount?: string;
};

function assertLoanApplicationCollateralInvoicePartiallyPaidNotificationData(
  data: unknown,
): asserts data is LoanApplicationCollateralInvoicePartiallyPaidNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  if (typeof data === 'object' && data !== null) {
    if ('invoiceId' in data) assertPropNullableString(data, 'invoiceId');
    if ('invoicedAmount' in data) assertPropNullableString(data, 'invoicedAmount');
    if ('paidAmount' in data) assertPropNullableString(data, 'paidAmount');
  }
}

@Injectable()
@Composer('LoanApplicationCollateralInvoicePartiallyPaid')
export class LoanApplicationCollateralInvoicePartiallyPaidNotificationComposer extends NotificationComposer<LoanApplicationCollateralInvoicePartiallyPaidNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanApplicationCollateralInvoicePartiallyPaidNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];
    const title = 'Loan Application Collateral Invoice Partially Paid';
    const content = `Your loan application collateral invoice has been partially paid${data.paidAmount ? ` (${data.paidAmount} paid` : ''}${data.invoicedAmount ? ` of ${data.invoicedAmount})` : ''}.`;

    // Realtime notification (always publish for connected clients)
    payloads.push({
      channel: NotificationChannelEnum.Realtime,
      userId: data.userId,
      type: 'LoanApplicationCollateralInvoicePartiallyPaid',
      title,
      content,
      metadata: {
        invoiceId: data.invoiceId,
        invoicedAmount: data.invoicedAmount,
        paidAmount: data.paidAmount,
      },
    });

    return payloads;
  }
}
