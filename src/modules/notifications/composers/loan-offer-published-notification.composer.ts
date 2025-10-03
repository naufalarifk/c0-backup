import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type SMSLoanOfferPublishedNotificationData = NotificationData & {
  userId: string;
  phoneNumber?: string;
  loanOfferId?: string;
  amount?: string;
  interestRate?: string;
  term?: string;
  description?: string;
  name?: string;
};

function assertSMSLoanOfferPublishedNotificationData(
  data: unknown,
): asserts data is SMSLoanOfferPublishedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  if (typeof data === 'object' && data !== null) {
    if ('phoneNumber' in data) assertPropNullableString(data, 'phoneNumber');
    if ('loanOfferId' in data) assertPropNullableString(data, 'loanOfferId');
    if ('amount' in data) assertPropNullableString(data, 'amount');
    if ('interestRate' in data) assertPropNullableString(data, 'interestRate');
    if ('term' in data) assertPropNullableString(data, 'term');
    if ('description' in data) assertPropNullableString(data, 'description');
    if ('name' in data) assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('LoanOfferPublished')
export class LoanOfferPublishedNotificationComposer extends NotificationComposer<SMSLoanOfferPublishedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertSMSLoanOfferPublishedNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];
    const title = 'Loan Offer Published';
    const content = `Your loan offer has been published${data.amount ? ` for $${data.amount}` : ''}${data.interestRate ? ` at ${data.interestRate}` : ''}${data.term ? ` for ${data.term}` : ''}.`;

    // Database notification (always save to database)
    payloads.push({
      channel: NotificationChannelEnum.Database,
      userId: data.userId,
      type: 'LoanOfferPublished',
      title,
      content,
    });

    // Realtime notification (always publish for connected clients)
    payloads.push({
      channel: NotificationChannelEnum.Realtime,
      userId: data.userId,
      type: 'LoanOfferPublished',
      title,
      content,
      metadata: {
        loanOfferId: data.loanOfferId,
        amount: data.amount,
        interestRate: data.interestRate,
        term: data.term,
      },
    });

    // SMS notification if phone number is available
    if (data.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload);
    }

    return payloads;
  }

  private renderSMSMessage(data: SMSLoanOfferPublishedNotificationData): string {
    const amountText = data.amount ? `${data.amount} ` : '';
    const rateText = data.interestRate ? ` at ${data.interestRate}` : '';
    const termText = data.term ? ` for ${data.term}` : '';

    return `Hi ${data.name || 'there'}! New loan offer: ${amountText}available${rateText}${termText}. Check CryptoGadai app for details.`;
  }
}
