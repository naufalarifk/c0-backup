import type { AnyNotificationPayload, NotificationData } from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoanApplicationCollateralInvoiceFullyPaidNotificationData = NotificationData & {
  userId: string;
  invoiceId?: string;
  invoicedAmount?: string;
  paidAmount?: string;
};

function assertLoanApplicationCollateralInvoiceFullyPaidNotificationData(
  data: unknown,
): asserts data is LoanApplicationCollateralInvoiceFullyPaidNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  if (typeof data === 'object' && data !== null) {
    if ('invoiceId' in data) assertPropNullableString(data, 'invoiceId');
    if ('invoicedAmount' in data) assertPropNullableString(data, 'invoicedAmount');
    if ('paidAmount' in data) assertPropNullableString(data, 'paidAmount');
  }
}

@Injectable()
@Composer('LoanApplicationCollateralInvoiceFullyPaid')
export class LoanApplicationCollateralInvoiceFullyPaidNotificationComposer extends NotificationComposer<LoanApplicationCollateralInvoiceFullyPaidNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanApplicationCollateralInvoiceFullyPaidNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];
    const title = 'Loan Application Collateral Invoice Fully Paid';
    const content = `Your loan application collateral invoice has been fully paid${data.paidAmount ? ` (${data.paidAmount})` : ''}.`;

    // Realtime notification (always publish for connected clients)
    payloads.push({
      channel: NotificationChannelEnum.Realtime,
      userId: data.userId,
      type: 'LoanApplicationCollateralInvoiceFullyPaid',
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
