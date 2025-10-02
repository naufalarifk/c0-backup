import type {
  AnyNotificationPayload,
  ExpoNotificationPayload,
  NotificationData,
  SMSNotificationPayload,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { NotificationChannelEnum } from '../notification.types';
import {
  Composer,
  NotificationComposer,
  type UserNotificationData,
} from '../notification-composer.abstract';

export type UserKycVerifiedNotificationData = NotificationData & {
  userId: string;
  verificationLevel?: string;
  name?: string;
} & Partial<UserNotificationData>;

function assertUserKycVerifiedNotificationData(
  data: unknown,
): asserts data is UserKycVerifiedNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'userId');
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
  constructor(repository: CryptogadaiRepository) {
    super(repository);
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertUserKycVerifiedNotificationData(data);

    // ✨ Smart enrichment: Auto-fetch and merge user contact data
    const enrichedData = await this.enrichWithUserData(data);

    const payloads: AnyNotificationPayload[] = [];

    if (enrichedData.phoneNumber) {
      payloads.push({
        channel: NotificationChannelEnum.SMS,
        to: enrichedData.phoneNumber,
        message: this.renderSMSMessage(enrichedData),
      } as SMSNotificationPayload);
    }

    // Expo notification - multi-device support
    const tokens =
      enrichedData.expoPushTokens ||
      (enrichedData.expoPushToken ? [enrichedData.expoPushToken] : []);
    for (const token of tokens) {
      payloads.push({
        channel: NotificationChannelEnum.Expo,
        to: token,
        title: 'KYC Verification Successful',
        body: this.renderPushMessage(enrichedData),
        data: {
          type: 'UserKycVerified',
          verificationLevel: enrichedData.verificationLevel,
        },
      } as ExpoNotificationPayload);
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
