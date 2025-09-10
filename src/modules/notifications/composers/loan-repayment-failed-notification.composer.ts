import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type SMSLoanRepaymentFailedNotificationData = NotificationData & {
  phoneNumber: string;
  loanId?: string;
  amount?: string;
  failureReason?: string;
  nextAttempt?: string;
  name?: string;
};

function assertSMSLoanRepaymentFailedNotificationData(
  data: unknown,
): asserts data is SMSLoanRepaymentFailedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  if (typeof data === 'object' && data !== null) {
    if ('loanId' in data) assertPropNullableString(data, 'loanId');
    if ('amount' in data) assertPropNullableString(data, 'amount');
    if ('failureReason' in data) assertPropNullableString(data, 'failureReason');
    if ('nextAttempt' in data) assertPropNullableString(data, 'nextAttempt');
    if ('name' in data) assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('LoanRepaymentFailed')
export class LoanRepaymentFailedNotificationComposer extends NotificationComposer<SMSLoanRepaymentFailedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertSMSLoanRepaymentFailedNotificationData(data);
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload,
    ]);
  }

  private renderSMSMessage(data: SMSLoanRepaymentFailedNotificationData): string {
    const amountText = data.amount ? ` of ${data.amount}` : '';
    const reasonText = data.failureReason ? ` (${data.failureReason})` : '';
    const nextAttemptText = data.nextAttempt ? ` Next attempt: ${data.nextAttempt}.` : '';

    return `Hi ${data.name || 'there'}! Loan repayment${amountText} failed${reasonText}.${nextAttemptText} Please check your CryptoGadai account or contact support.`;
  }
}
