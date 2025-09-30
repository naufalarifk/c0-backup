import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { ensureExists } from '../../shared/utils';
import { GetNotificationsQueryDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: CryptogadaiRepository) {}

  findAll(userId: string, query: GetNotificationsQueryDto) {
    return this.repository.userListsNotifications({ userId, ...query });
  }

  async read(userId: string, notificationId: number) {
    const result = await this.repository.userMarksNotificationRead({
      userId,
      notificationId: notificationId.toString(),
    });

    ensureExists(result, 'Notification not found');

    return {
      message: 'Notification marked as read',
    };
  }

  async readAll(userId: string) {
    const { updatedCount } = await this.repository.userMarksAllNotificationsRead({ userId });

    return {
      message: 'All notifications marked as read',
      updatedCount,
    };
  }

  async archive(_userId: string, _notificationId: number) {
    // Todo: Implement archive functionality in the database and repository
    return {
      message: 'Notification archived successfully',
    };
  }

  async remove(userId: string, notificationId: number) {
    const result = await this.repository.userDeletesNotification({
      userId,
      notificationId: notificationId.toString(),
    });
    ensureExists(result.deleted, 'Notification not found');

    return {
      message: 'Notification deleted successfully',
    };
  }
}
