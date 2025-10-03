import type { NotificationType } from '../../shared/repositories/user.types';

export const NotificationChannelEnum = {
  Email: 'Email' as const,
  SMS: 'SMS' as const,
  FCM: 'FCM' as const,
  APN: 'APN' as const,
  Expo: 'Expo' as const,
  Database: 'Database' as const,
  Realtime: 'Realtime' as const,
} as const;

export function assertIsNotificationChannel(value: unknown): asserts value is NotificationChannel {
  if (
    typeof value !== 'string' ||
    !Object.values(NotificationChannelEnum).includes(value as NotificationChannel)
  ) {
    throw new Error(`Invalid notification channel: ${value}`);
  }
}

export type NotificationChannel =
  (typeof NotificationChannelEnum)[keyof typeof NotificationChannelEnum];

export interface NotificationPayload {
  channel: NotificationChannel;
}

export interface PushNotificationPayload extends NotificationPayload {
  channel:
    | typeof NotificationChannelEnum.FCM
    | typeof NotificationChannelEnum.APN
    | typeof NotificationChannelEnum.Expo;
  to: string;
  title: string;
  body: string;
}

export interface FCMNotificationPayload extends PushNotificationPayload {
  channel: typeof NotificationChannelEnum.FCM;
  data?: Record<string, string>;
  icon?: string;
  clickAction?: string;
  sound?: string;
  badge?: string;
}

export interface APNSNotificationPayload extends PushNotificationPayload {
  channel: typeof NotificationChannelEnum.APN;
  sound?: string;
  badge?: number;
  category?: string;
}

export interface ExpoNotificationPayload extends PushNotificationPayload {
  channel: typeof NotificationChannelEnum.Expo;
  data?: Record<string, string | number | boolean>;
  sound?: 'default' | null;
  badge?: number;
  ttl?: number;
  expiration?: number;
  priority?: 'default' | 'normal' | 'high';
  subtitle?: string;
  categoryId?: string;
  channelId?: string;
}

export interface EmailNotificationPayload extends NotificationPayload {
  channel: typeof NotificationChannelEnum.Email;
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface SMSNotificationPayload extends NotificationPayload {
  channel: typeof NotificationChannelEnum.SMS;
  to: string;
  message: string;
}

export interface DatabaseNotificationPayload extends NotificationPayload {
  channel: typeof NotificationChannelEnum.Database;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
}

export interface RealtimeNotificationPayload extends NotificationPayload {
  channel: typeof NotificationChannelEnum.Realtime;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  notificationId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationData {
  type: NotificationType;
  [key: string]: unknown;
}

export type AnyNotificationPayload =
  | EmailNotificationPayload
  | SMSNotificationPayload
  | FCMNotificationPayload
  | APNSNotificationPayload
  | ExpoNotificationPayload
  | DatabaseNotificationPayload
  | RealtimeNotificationPayload;
