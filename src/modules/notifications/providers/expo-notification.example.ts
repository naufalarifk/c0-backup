import type { ExpoNotificationPayload } from '../notification.types';

import { NotificationChannelEnum } from '../notification.types';

/**
 * Example usage of Expo Notification Provider
 *
 * The Expo notification provider enables push notifications to mobile apps
 * built with Expo/React Native that use Expo's push notification service.
 */

// Example 1: Basic push notification
const basicNotification: ExpoNotificationPayload = {
  channel: NotificationChannelEnum.Expo,
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', // User's Expo push token
  title: 'Welcome to CryptoGadai',
  body: 'Your account has been successfully created!',
};

// Example 2: Notification with data and sound
const notificationWithData: ExpoNotificationPayload = {
  channel: NotificationChannelEnum.Expo,
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'New Loan Offer',
  body: 'You have received a new loan offer of 10,000 USDT',
  data: {
    loanId: 'loan_123456',
    amount: 10000,
    currency: 'USDT',
    type: 'loan_offer',
    priority: true,
  },
  sound: 'default',
  badge: 1,
};

// Example 3: High priority notification with TTL
const urgentNotification: ExpoNotificationPayload = {
  channel: NotificationChannelEnum.Expo,
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'Urgent: Loan Liquidation Warning',
  body: 'Your loan LTV ratio has reached 80%. Add collateral to avoid liquidation.',
  priority: 'high',
  ttl: 3600, // 1 hour TTL
  data: {
    loanId: 'loan_789012',
    ltvRatio: 0.8,
    type: 'liquidation_warning',
    urgency: 'high',
  },
  sound: 'default',
  badge: 1,
};

// Example 4: Android-specific notification with channel
const androidNotification: ExpoNotificationPayload = {
  channel: NotificationChannelEnum.Expo,
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'Payment Received',
  body: 'You have received a payment of 500 USDT',
  subtitle: 'Loan Repayment',
  channelId: 'payments', // Android notification channel
  data: {
    paymentId: 'payment_345678',
    amount: '500',
    currency: 'USDT',
    type: 'payment_received',
  },
};

// Example 5: iOS-specific notification with category
const iosNotification: ExpoNotificationPayload = {
  channel: NotificationChannelEnum.Expo,
  to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  title: 'Loan Application Update',
  body: 'Your loan application has been approved!',
  categoryId: 'loan_updates', // iOS notification category for actions
  badge: 2,
  sound: 'default',
  data: {
    applicationId: 'app_567890',
    status: 'approved',
    type: 'application_update',
  },
};

/**
 * How to send notifications in the application:
 *
 * 1. Inject NotificationService or NotificationQueueService in your service
 * 2. Call the send method with the appropriate payload
 *
 * Example in a service:
 *
 * ```typescript
 * @Injectable()
 * export class LoanService {
 *   constructor(
 *     private readonly notificationQueue: NotificationQueueService,
 *   ) {}
 *
 *   async notifyLoanApproval(userId: string, loanId: string) {
 *     // Get user's Expo push token from database
 *     const userToken = await this.getUserExpoPushToken(userId);
 *
 *     if (userToken) {
 *       const notification: ExpoNotificationPayload = {
 *         channel: NotificationChannelEnum.Expo,
 *         to: userToken,
 *         title: 'Loan Approved!',
 *         body: 'Your loan application has been approved.',
 *         data: { loanId, type: 'loan_approved' },
 *         priority: 'high',
 *         sound: 'default',
 *       };
 *
 *       await this.notificationQueue.sendNotification(notification);
 *     }
 *   }
 * }
 * ```
 *
 * Note: The Expo push token must be obtained from the mobile app
 * and stored in the user's profile/settings in the database.
 */

export {
  basicNotification,
  notificationWithData,
  urgentNotification,
  androidNotification,
  iosNotification,
};
