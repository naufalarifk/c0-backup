import type { AnyNotificationPayload, DatabaseNotificationPayload } from '../notification.types';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { NotificationChannelEnum } from '../notification.types';
import {
  NotificationProvider,
  type NotificationSendResult,
} from '../notification-provider.abstract';
import { NotificationProviderFlag } from '../notification-provider.factory';

@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Database)
export class DatabaseNotificationProvider extends NotificationProvider {
  private readonly logger = new TelemetryLogger(DatabaseNotificationProvider.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
  ) {
    super();
  }

  isSendablePayload(payload: AnyNotificationPayload): payload is DatabaseNotificationPayload {
    return payload.channel === NotificationChannelEnum.Database;
  }

  async send(payload: DatabaseNotificationPayload): Promise<NotificationSendResult> {
    try {
      const creationDate = new Date();

      const rows = await this.repository.sql`
        INSERT INTO notifications (user_id, type, title, content, creation_date)
        VALUES (${payload.userId}, ${payload.type}, ${payload.title}, ${payload.content}, ${creationDate})
        RETURNING id
      `;

      assertDefined(rows[0], 'Failed to get notification ID after insert');
      const row = rows[0] as Record<string, unknown>;
      assertProp(check(isString, isNumber), row, 'id');
      const notificationId = String(row.id);

      this.logger.log(
        `Saved notification ${notificationId} to database for user ${payload.userId}: ${payload.type}`,
      );

      return { notificationId };
    } catch (error) {
      this.logger.error(
        `Failed to save notification to database for user ${payload.userId}:`,
        error,
      );
      throw error;
    }
  }
}
