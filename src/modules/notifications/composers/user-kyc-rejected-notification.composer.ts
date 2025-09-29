import type {
  AnyNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type SMSUserKycRejectedNotificationData = NotificationData & {
  phoneNumber: string;
  reason?: string;
  name?: string;
};

function assertSMSUserKycRejectedNotificationData(
  data: unknown,
): asserts data is SMSUserKycRejectedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'phoneNumber', 'Phone number is required');
  if (typeof data === 'object' && data !== null && 'reason' in data) {
    assertPropNullableString(data, 'reason');
  }
  if (typeof data === 'object' && data !== null && 'name' in data) {
    assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('UserKycRejected')
export class UserKycRejectedNotificationComposer extends NotificationComposer<SMSUserKycRejectedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertSMSUserKycRejectedNotificationData(data);
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload,
    ]);
  }

  private renderSMSMessage(data: SMSUserKycRejectedNotificationData): string {
    const reasonText = data.reason ? ` Reason: ${data.reason}` : '';
    return `Hi ${data.name || 'there'}! Your KYC verification was rejected.${reasonText} Please contact support or resubmit your documents.`;
  }
}
