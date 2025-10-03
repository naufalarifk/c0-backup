import type { AnyNotificationPayload, NotificationData } from './notification.types';

import { DiscoveryService } from '@nestjs/core';

import invariant from 'tiny-invariant';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { NotificationType } from '../../shared/types';

export const Composer = DiscoveryService.createDecorator<NotificationType>();

export interface UserNotificationData {
  email?: string;
  phoneNumber?: string;
  expoPushToken?: string; // Legacy - single token
  expoPushTokens?: string[]; // Multi-device support
  fcmToken?: string;
  apnsToken?: string;
  deviceToken?: string;
}

export abstract class NotificationComposer<T extends NotificationData = NotificationData> {
  protected repository?: CryptogadaiRepository;

  constructor(repository?: CryptogadaiRepository) {
    this.repository = repository;
  }

  abstract composePayloads(data: T): Promise<AnyNotificationPayload[]>;

  /**
   * Smart auto-enrichment: automatically fetch and merge user notification data
   * @param data - Original notification data
   * @param userId - User ID to fetch contact info for
   * @returns Enriched data with user contact information
   */
  protected async enrichWithUserData<D extends { userId: string } & Partial<UserNotificationData>>(
    data: D,
    userId?: string,
  ): Promise<D & UserNotificationData> {
    invariant(this.repository, 'Repository not available for user data enrichment');

    const targetUserId = userId || data.userId;

    // Skip database call if all contact data already provided
    const hasAllContactData = this.hasCompleteContactData(data);
    if (hasAllContactData) {
      return { ...data, ...this.fillMissingContactFields(data) };
    }

    // Fetch missing user notification data
    const userNotificationData = await this.getUserNotificationData(this.repository, targetUserId);

    // Auto-merge: provided data takes precedence over fetched data
    return {
      ...data,
      email: data.email || userNotificationData.email,
      phoneNumber: data.phoneNumber || userNotificationData.phoneNumber,
      expoPushToken: data.expoPushToken || userNotificationData.expoPushToken,
      expoPushTokens: data.expoPushTokens || userNotificationData.expoPushTokens,
      fcmToken: data.fcmToken || userNotificationData.fcmToken,
      apnsToken: data.apnsToken || userNotificationData.apnsToken,
      deviceToken: data.deviceToken || userNotificationData.deviceToken,
    };
  }

  /**
   * Check if data already contains complete contact information
   * @param data - Data to check
   * @returns true if no database fetch needed
   */
  private hasCompleteContactData(data: Partial<UserNotificationData>): boolean {
    // Consider "complete" if has at least one primary channel (email OR expoPushToken/expoPushTokens OR phoneNumber)
    return !!(
      data.email ||
      data.expoPushToken ||
      (data.expoPushTokens && data.expoPushTokens.length > 0) ||
      data.phoneNumber
    );
  }

  /**
   * Fill missing contact fields with undefined for type safety
   * @param data - Partial contact data
   * @returns Complete UserNotificationData with undefined for missing fields
   */
  private fillMissingContactFields(data: Partial<UserNotificationData>): UserNotificationData {
    return {
      email: data.email,
      phoneNumber: data.phoneNumber,
      expoPushToken: data.expoPushToken,
      expoPushTokens: data.expoPushTokens,
      fcmToken: data.fcmToken,
      apnsToken: data.apnsToken,
      deviceToken: data.deviceToken,
    };
  }

  /**
   * Internal helper method to get user notification data from database
   * @param repository - Database repository instance
   * @param userId - User ID to fetch contact info for
   * @returns User notification contact data
   */
  private async getUserNotificationData(
    repository: CryptogadaiRepository,
    userId: string,
  ): Promise<UserNotificationData> {
    try {
      const user = await repository.userViewsProfile({ userId });

      // Fetch active push tokens from multi-device system
      let expoPushTokens: string[] = [];
      try {
        const { tokens } = await repository.platformViewsActivePushTokens({
          userId,
          targetDevices: 'active_sessions', // Only send to devices with active sessions
        });
        expoPushTokens = tokens.map(t => t.pushToken);
      } catch (error) {
        console.error(`Failed to fetch active push tokens for userId ${userId}:`, error);
      }

      return {
        email: user.email || undefined,
        phoneNumber: user.phoneNumber || undefined,
        expoPushToken: expoPushTokens[0] || undefined, // Legacy - first token
        expoPushTokens: expoPushTokens.length > 0 ? expoPushTokens : undefined,
        // Add other tokens when they become available in database
        fcmToken: undefined, // TODO: implement when FCM tokens are stored
        apnsToken: undefined, // TODO: implement when APNS tokens are stored
        deviceToken: undefined, // TODO: implement when device tokens are stored
      };
    } catch (error) {
      console.error(`Failed to get user notification data for userId ${userId}:`, error);
      // Return empty object if user lookup fails - notification will proceed without contact info
      return {};
    }
  }
}
