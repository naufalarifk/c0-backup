import type {
  AnyNotificationPayload,
  APNSNotificationPayload,
  FCMNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type UserKycVerifiedNotificationData = NotificationData & {
  phoneNumber?: string;
  fcmToken?: string;
  apnsToken?: string;
  verificationLevel?: string;
  name?: string;
  badgeCount?: number;
};

function assertUserKycVerifiedNotificationData(
  data: unknown,
): asserts data is UserKycVerifiedNotificationData {
  assertDefined(data, 'Notification data is required');
  if (typeof data === 'object' && data !== null && 'phoneNumber' in data) {
    assertPropNullableString(data, 'phoneNumber');
  }
  if (typeof data === 'object' && data !== null && 'fcmToken' in data) {
    assertPropNullableString(data, 'fcmToken');
  }
  if (typeof data === 'object' && data !== null && 'apnsToken' in data) {
    assertPropNullableString(data, 'apnsToken');
  }
  if (typeof data === 'object' && data !== null && 'verificationLevel' in data) {
    assertPropNullableString(data, 'verificationLevel');
  }
  if (typeof data === 'object' && data !== null && 'name' in data) {
    assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('UserKycVerified')
export class UserKycVerifiedNotificationComposer extends NotificationComposer<UserKycVerifiedNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertUserKycVerifiedNotificationData(data);
    const payloads: AnyNotificationPayload[] = [];

    if (data.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: data.phoneNumber,
        message: this.renderSMSMessage(data),
      } as SMSNotificationPayload);
    }

    if (data.fcmToken) {
      payloads.push({
        channel: NotificationChannelEnum.FCM,
        to: data.fcmToken,
        title: 'KYC Verification Successful',
        body: this.renderPushMessage(data),
      } as FCMNotificationPayload);
    }

    if (data.apnsToken) {
      payloads.push({
        channel: NotificationChannelEnum.APN,
        to: data.apnsToken,
        title: 'KYC Verified Successfully',
        body: this.renderPushMessage(data),
        badge: data.badgeCount || 1,
        sound: 'default',
      } as APNSNotificationPayload);
    }

    return await Promise.resolve(payloads);
  }

  private renderSMSMessage(data: UserKycVerifiedNotificationData): string {
    const levelText = data.verificationLevel ? ` (${data.verificationLevel})` : '';
    return `Hi ${data.name || 'there'}! Your KYC verification has been approved${levelText}. You now have full access to CryptoGadai features.`;
  }

  private renderPushMessage(data: UserKycVerifiedNotificationData): string {
    const levelText = data.verificationLevel ? ` (${data.verificationLevel})` : '';
    return `Congratulations ${data.name || 'there'}! Your identity verification${levelText} has been completed successfully.`;
  }
}
