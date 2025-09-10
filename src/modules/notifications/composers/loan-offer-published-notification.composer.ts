import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type SMSLoanOfferPublishedNotificationData = NotificationData & {
  phoneNumber: string;
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
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  if (typeof data === 'object' && data !== null) {
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
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload,
    ]);
  }

  private renderSMSMessage(data: SMSLoanOfferPublishedNotificationData): string {
    const amountText = data.amount ? `${data.amount} ` : '';
    const rateText = data.interestRate ? ` at ${data.interestRate}` : '';
    const termText = data.term ? ` for ${data.term}` : '';

    return `Hi ${data.name || 'there'}! New loan offer: ${amountText}available${rateText}${termText}. Check CryptoGadai app for details.`;
  }
}
