import type { AnyNotificationPayload, ExpoNotificationPayload } from '../notification.types';

import { Injectable, Logger } from '@nestjs/common';

import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Expo)
export class ExpoNotificationProvider extends NotificationProvider {
  private readonly logger = new Logger(ExpoNotificationProvider.name);
  private readonly expo: Expo;

  constructor(private readonly appConfigService: AppConfigService) {
    super();

    const { accessToken, enabled } = this.appConfigService.notificationConfig.expo;

    if (!enabled) {
      this.logger.warn('Expo notification provider is disabled');
    }

    this.expo = new Expo({
      ...(accessToken && { accessToken }),
    });

    if (accessToken) {
      this.logger.log('Expo SDK initialized with access token for priority notifications');
    } else {
      this.logger.log('Expo SDK initialized without access token (using default priority)');
    }
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is ExpoNotificationPayload {
    return payload.channel === NotificationChannelEnum.Expo;
  }

  async send(notification: ExpoNotificationPayload): Promise<void> {
    try {
      // Check that push token is valid
      if (!Expo.isExpoPushToken(notification.to)) {
        this.logger.error(`Push token ${notification.to} is not a valid Expo push token`);
        throw new Error(`Invalid Expo push token: ${notification.to}`);
      }

      // Construct the message
      const message: ExpoPushMessage = {
        to: notification.to,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: notification.sound,
        badge: notification.badge,
        ttl: notification.ttl,
        expiration: notification.expiration,
        priority: notification.priority,
        subtitle: notification.subtitle,
        categoryId: notification.categoryId,
        channelId: notification.channelId,
      };

      this.logger.log(
        `Sending Expo notification to ${notification.to} with title "${notification.title}"`,
      );

      // Send the notification in chunks (Expo recommends chunks of 100)
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          this.logger.log(`Successfully sent chunk with ${ticketChunk.length} notifications`);
        } catch (error) {
          this.logger.error('Error sending notification chunk:', error);
          throw error;
        }
      }

      // Log ticket information
      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          this.logger.log(`Notification sent successfully. Receipt ID: ${ticket.id}`);
        } else {
          this.logger.error(
            `Failed to send notification. Status: ${ticket.status}, Message: ${ticket.message}`,
          );
          if (ticket.details) {
            this.logger.error(`Error details: ${JSON.stringify(ticket.details)}`);
          }
        }
      }

      // Note: In production, you should store ticket IDs and later fetch receipts
      // to get the final delivery status of the notifications
      // Example:
      // await this.storeTicketIds(tickets.filter(t => t.status === 'ok').map(t => t.id));
      // Later: await this.checkReceipts(ticketIds);
    } catch (error) {
      this.logger.error(`Failed to send Expo notification to ${notification.to}:`, error);
      throw error;
    }
  }

  /**
   * Check notification receipts to get final delivery status
   * This should be called after a delay (15 minutes recommended by Expo)
   */
  async checkReceipts(ticketIds: string[]): Promise<void> {
    try {
      const receiptIds = ticketIds.filter(id => id);
      if (receiptIds.length === 0) {
        return;
      }

      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);

      for (const chunk of receiptIdChunks) {
        try {
          const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

          for (const receiptId in receipts) {
            const receipt = receipts[receiptId];
            if (receipt.status === 'ok') {
              this.logger.log(`Notification ${receiptId} delivered successfully`);
            } else {
              this.logger.error(
                `Notification ${receiptId} failed. Status: ${receipt.status}, Message: ${receipt.message}`,
              );
              if (receipt.details) {
                this.logger.error(`Error details: ${JSON.stringify(receipt.details)}`);
              }
            }
          }
        } catch (error) {
          this.logger.error('Error fetching receipts:', error);
        }
      }
    } catch (error) {
      this.logger.error('Error checking receipts:', error);
    }
  }
}
