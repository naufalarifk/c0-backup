import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type SMSWithdrawalRequestedNotificationData = NotificationData & {
  phoneNumber: string;
  amount?: string;
  withdrawalId?: string;
  bankAccount?: string;
  name?: string;
};

function assertSMSWithdrawalRequestedNotificationData(
  data: unknown,
): asserts data is SMSWithdrawalRequestedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  if (typeof data === 'object' && data !== null && 'amount' in data) {
    assertPropNullableString(data, 'amount');
  }
  if (typeof data === 'object' && data !== null && 'withdrawalId' in data) {
    assertPropNullableString(data, 'withdrawalId');
  }
  if (typeof data === 'object' && data !== null && 'bankAccount' in data) {
    assertPropNullableString(data, 'bankAccount');
  }
  if (typeof data === 'object' && data !== null && 'name' in data) {
    assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('WithdrawalRequested')
export class WithdrawalRequestedNotificationComposer extends NotificationComposer<SMSWithdrawalRequestedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertSMSWithdrawalRequestedNotificationData(data);
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload,
    ]);
  }

  private renderSMSMessage(data: SMSWithdrawalRequestedNotificationData): string {
    const amountText = data.amount ? ` of ${data.amount}` : '';
    const accountText = data.bankAccount ? ` to ${data.bankAccount}` : '';
    return `Hi ${data.name || 'there'}! Withdrawal request${amountText}${accountText} has been submitted successfully on CryptoGadai. We'll process it shortly.`;
  }
}
