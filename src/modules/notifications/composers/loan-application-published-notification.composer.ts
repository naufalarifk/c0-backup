import type { AnyNotificationPayload, NotificationData } from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type LoanApplicationPublishedNotificationData = NotificationData & {
  userId: string;
  loanApplicationId?: string;
  amount?: string;
  collateralAmount?: string;
  maxInterestRate?: string;
  term?: string;
  name?: string;
};

function assertLoanApplicationPublishedNotificationData(
  data: unknown,
): asserts data is LoanApplicationPublishedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  if (typeof data === 'object' && data !== null) {
    if ('loanApplicationId' in data) assertPropNullableString(data, 'loanApplicationId');
    if ('amount' in data) assertPropNullableString(data, 'amount');
    if ('collateralAmount' in data) assertPropNullableString(data, 'collateralAmount');
    if ('maxInterestRate' in data) assertPropNullableString(data, 'maxInterestRate');
    if ('term' in data) assertPropNullableString(data, 'term');
    if ('name' in data) assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('LoanApplicationPublished')
export class LoanApplicationPublishedNotificationComposer extends NotificationComposer<LoanApplicationPublishedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertLoanApplicationPublishedNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];
    const title = 'Loan Application Published';
    const content = `Your loan application has been published${data.amount ? ` for $${data.amount}` : ''}${data.maxInterestRate ? ` with max rate ${data.maxInterestRate}` : ''}${data.term ? ` for ${data.term} months` : ''}.`;

    // Database notification (always save to database)
    payloads.push({
      channel: NotificationChannelEnum.Database,
      userId: data.userId,
      type: 'LoanApplicationPublished',
      title,
      content,
    });

    // Realtime notification (always publish for connected clients)
    payloads.push({
      channel: NotificationChannelEnum.Realtime,
      userId: data.userId,
      type: 'LoanApplicationPublished',
      title,
      content,
      metadata: {
        loanApplicationId: data.loanApplicationId,
        amount: data.amount,
        collateralAmount: data.collateralAmount,
        maxInterestRate: data.maxInterestRate,
        term: data.term,
      },
    });

    return payloads;
  }
}
