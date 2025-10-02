import type {
  PushTokenGetActiveParams,
  SendPushNotificationParams,
  SendPushNotificationResult,
} from '../../../shared/repositories/push-tokens.types';

import { Injectable } from '@nestjs/common';

import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../../shared/services/app-config.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';

@Injectable()
export class PushSenderService {
  private readonly logger = new TelemetryLogger(PushSenderService.name);
  private readonly expo: Expo;

  constructor(
    private readonly repository: CryptogadaiRepository,
    private readonly configService: AppConfigService,
  ) {
    this.expo = new Expo({
      accessToken: this.configService.notificationConfig.expo.accessToken,
    });
  }

  /**
   * Send push notification to user's devices
   */
  async sendNotification(params: SendPushNotificationParams): Promise<SendPushNotificationResult> {
    const {
      userId,
      title,
      body,
      data,
      targetDevices = 'active_sessions',
      deviceIds,
      priority,
      sound = 'default',
      badge,
      channelId,
      categoryId,
      subtitle,
    } = params;

    // Get active tokens for user
    const activeParams: PushTokenGetActiveParams = {
      userId,
      targetDevices,
      deviceIds,
    };

    const { tokens } = await this.repository.getActiveTokensForUser(activeParams);

    if (tokens.length === 0) {
      this.logger.warn(`No active push tokens found for user ${userId}`);
      return { sent: 0, failed: 0, tickets: [] };
    }

    // Filter valid Expo push tokens
    const validTokens = tokens.filter(token => Expo.isExpoPushToken(token.pushToken));

    if (validTokens.length === 0) {
      this.logger.warn(`No valid Expo push tokens for user ${userId}`);
      return { sent: 0, failed: 0, tickets: [] };
    }

    // Build push messages with full Expo support
    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token.pushToken,
      sound: typeof sound === 'string' ? sound : sound ? 'default' : undefined,
      title,
      body,
      subtitle, // iOS only
      data: data || {},
      priority: priority === 'high' ? 'high' : 'default',
      badge, // iOS badge count
      channelId, // Android channel
      categoryId, // iOS category for actions
    }));

    try {
      // Send push notifications
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error(`Error sending push notification chunk: ${error.message}`);
        }
      }

      // Count success/failure
      let sent = 0;
      let failed = 0;

      tickets.forEach(ticket => {
        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          this.logger.error(`Push notification error: ${ticket.message}`);
        }
      });

      // Update last_used_at for successfully sent tokens
      const successfulTokenIds = validTokens
        .filter((_, index) => tickets[index]?.status === 'ok')
        .map(token => token.id);

      if (successfulTokenIds.length > 0) {
        await this.repository.updateLastUsedAt(successfulTokenIds);
      }

      this.logger.log(`Push notifications sent to user ${userId}: ${sent} sent, ${failed} failed`);

      return { sent, failed, tickets };
    } catch (error) {
      this.logger.error(`Fatal error sending push notifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send push notification to specific push tokens (bypassing user lookup)
   */
  async sendToTokens(
    pushTokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<SendPushNotificationResult> {
    const validTokens = pushTokens.filter(token => Expo.isExpoPushToken(token));

    if (validTokens.length === 0) {
      this.logger.warn('No valid Expo push tokens provided');
      return { sent: 0, failed: 0, tickets: [] };
    }

    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error(`Error sending push notification chunk: ${error.message}`);
        }
      }

      const sent = tickets.filter(ticket => ticket.status === 'ok').length;
      const failed = tickets.length - sent;

      this.logger.log(`Push notifications sent: ${sent} sent, ${failed} failed`);

      return { sent, failed, tickets };
    } catch (error) {
      this.logger.error(`Fatal error sending push notifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate push token format
   */
  isValidPushToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }
}
