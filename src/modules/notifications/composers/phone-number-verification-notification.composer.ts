import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type PhoneNumberVerificationNotificationData = NotificationData & {
  phoneNumber: string;
  code: string;
};

function assertPhoneNumberVerificationNotificationData(
  data: unknown,
): asserts data is PhoneNumberVerificationNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  assertPropString(data, 'code', 'Verification code is required');
}

@Injectable()
@Composer('PhoneNumberVerification')
export class PhoneNumberVerificationNotificationComposer extends NotificationComposer<PhoneNumberVerificationNotificationData> {
  composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertPhoneNumberVerificationNotificationData(data);

    const smsPayload: SMSNotificationPayload = {
      channel: NotificationChannelEnum.SMS,
      to: data.phoneNumber,
      message: this.renderSMSMessage(data),
    };

    return Promise.resolve([smsPayload]);
  }

  private renderSMSMessage(data: PhoneNumberVerificationNotificationData): string {
    return `Your verification code is: ${data.code}. This code will expire in 10 minutes. Do not share this code with anyone.`;
  }
}
