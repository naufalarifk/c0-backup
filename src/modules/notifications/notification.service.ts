import { Injectable, Logger } from '@nestjs/common';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { NotificationType } from '../../shared/types';
import { type AnyNotificationPayload, assertIsNotificationChannel } from './notification.types';
import { NotificationComposer } from './notification-composer.abstract';
import { NotificationComposerFactory } from './notification-composer.factory';
import { NotificationProvider } from './notification-provider.abstract';
import { NotificationProviderFactory } from './notification-provider.factory';

@Injectable()
export class NotificationService {
  private readonly logger = new TelemetryLogger(NotificationService.name);

  constructor(
    private readonly composerFactory: NotificationComposerFactory,
    private readonly providerFactory: NotificationProviderFactory,
  ) {}

  getComposerByType(type: NotificationType): NotificationComposer {
    const composer = this.composerFactory.getComposer(type);
    if (!composer) {
      throw new Error(`No composer found for notification type: ${type}`);
    }
    return composer;
  }

  getProvidersByPayload(payload: AnyNotificationPayload): NotificationProvider[] {
    try {
      const providers: NotificationProvider[] = [];

      // Handle single channel payload (not array)
      assertIsNotificationChannel(payload.channel);
      const allProviders = this.providerFactory.getComposers(payload.channel);
      for (const provider of allProviders) {
        if (provider.isSendablePayload(payload)) {
          providers.push(provider);
        }
      }

      if (providers.length === 0) {
        this.logger.warn(`No suitable providers found for payload channel: ${payload.channel}`);
      }

      return providers;
    } catch (error) {
      this.logger.error('Failed to get providers for payload:', error);
      throw error;
    }
  }
}
