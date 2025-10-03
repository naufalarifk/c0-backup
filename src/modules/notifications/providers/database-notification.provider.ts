import type { AnyNotificationPayload, DatabaseNotificationPayload } from '../notification.types';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { NotificationChannelEnum } from '../notification.types';
import { NotificationProvider } from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Database)
export class DatabaseNotificationProvider extends NotificationProvider {
  private readonly logger = new Logger(DatabaseNotificationProvider.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
  ) {
    super();
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is DatabaseNotificationPayload {
    return payload.channel === NotificationChannelEnum.Database;
  }

  async send(payload: DatabaseNotificationPayload): Promise<void> {
    try {
      const creationDate = new Date();

      await this.repository.sql`
        INSERT INTO notifications (user_id, type, title, content, creation_date)
        VALUES (${payload.userId}, ${payload.type}, ${payload.title}, ${payload.content}, ${creationDate})
      `;

      this.logger.log(`Saved notification to database for user ${payload.userId}: ${payload.type}`);
    } catch (error) {
      this.logger.error(
        `Failed to save notification to database for user ${payload.userId}:`,
        error,
      );
      throw error;
    }
  }
}
