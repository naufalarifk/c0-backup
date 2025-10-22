import { Body, Controller, Post } from '@nestjs/common';

import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isNullable,
  isString,
} from 'typeshaper';

import { Auth } from '../../decorators/auth.decorator';
import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { NotificationQueueService } from '../notifications/notification-queue.service';

@Controller('test')
@Auth({ public: true })
export class NotificationTestController {
  #logger = new TelemetryLogger(NotificationTestController.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  @Post('send-test-notification')
  async sendTestNotification(
    @Body()
    body: {
      expoPushToken: string;
      title?: string;
      body?: string;
      data?: Record<string, string | number | boolean>;
    },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    assertDefined(body, 'Request body is required');
    assertPropString(body, 'expoPushToken', 'Expo push token is required');
    assertProp(check(isNullable, isString), body, 'title');
    assertProp(check(isNullable, isString), body, 'body');

    this.#logger.debug('Queueing test notification:', {
      expoPushToken: body.expoPushToken,
      title: body.title,
      body: body.body,
    });

    await this.notificationQueue.queueNotification({
      type: 'TestNotification',
      expoPushToken: body.expoPushToken,
      title: body.title,
      body: body.body,
      data: body.data,
    });

    return {
      success: true,
      message: 'Test notification queued successfully',
      queuedAt: new Date().toISOString(),
    };
  }
}
