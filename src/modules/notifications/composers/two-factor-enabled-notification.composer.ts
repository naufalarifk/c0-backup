import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropDefined, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type TwoFactorEnabledNotificationData = NotificationData & {
  userId: string;
  phoneNumber: string;
  verificationCode: string;
};

function assertTwoFactorEnabledNotificationData(
  data: unknown,
): asserts data is TwoFactorEnabledNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId', 'User ID is required');
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  assertPropString(data, 'verificationCode', 'Verification code is required');
}

@Injectable()
@Composer('TwoFactorEnabled')
export class TwoFactorEnabledNotificationComposer extends NotificationComposer<TwoFactorEnabledNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertTwoFactorEnabledNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];

    // SMS notification with verification code
    payloads.push({
      channel: NotificationChannelEnum.SMS,
      to: data.phoneNumber,
      message: `Your CryptoGadai verification code is: ${data.verificationCode}. Do not share this code with anyone.`,
    } as SMSNotificationPayload);

    return payloads;
  }
}
