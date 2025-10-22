import type {
  AnyNotificationPayload,
  ExpoNotificationPayload,
  NotificationData,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isNullable,
  isString,
} from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type TestNotificationData = NotificationData & {
  type: 'TestNotification';
  expoPushToken: string;
  title?: string;
  body?: string;
  data?: Record<string, string | number | boolean>;
};

function assertTestNotificationData(data: unknown): asserts data is TestNotificationData {
  assertDefined(data, 'Notification data is required');
  assertProp(v => v === ('TestNotification' as const), data, 'type');
  assertPropString(data, 'expoPushToken', 'Expo push token is required');
  assertProp(check(isNullable, isString), data, 'title');
  assertProp(check(isNullable, isString), data, 'body');
}

@Injectable()
@Composer('TestNotification')
export class TestNotificationComposer extends NotificationComposer<TestNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertTestNotificationData(data);

    const payloads: AnyNotificationPayload[] = [];

    // Expo notification
    payloads.push({
      channel: NotificationChannelEnum.Expo,
      to: data.expoPushToken,
      title: data.title || 'Test Notification',
      body: data.body || 'This is a test notification from CryptoGadai backend',
      data: data.data || {
        type: 'TestNotification',
        timestamp: Date.now(),
      },
      sound: 'default',
      priority: 'high',
    } as ExpoNotificationPayload);

    return payloads;
  }
}
