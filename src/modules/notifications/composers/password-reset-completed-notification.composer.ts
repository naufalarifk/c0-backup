import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type SMSPasswordResetCompletedNotificationData = NotificationData & {
  phoneNumber: string;
  name?: string;
};

function assertSMSPasswordResetCompletedNotificationData(
  data: unknown,
): asserts data is SMSPasswordResetCompletedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  if (typeof data === 'object' && data !== null && 'name' in data) {
    assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('PasswordResetCompleted')
export class PasswordResetCompletedNotificationComposer extends NotificationComposer<SMSPasswordResetCompletedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertSMSPasswordResetCompletedNotificationData(data);
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload,
    ]);
  }

  private renderSMSMessage(data: SMSPasswordResetCompletedNotificationData): string {
    return `Hi ${data.name || 'there'}! Your CryptoGadai password has been reset successfully. If you didn't make this change, contact support immediately.`;
  }
}
