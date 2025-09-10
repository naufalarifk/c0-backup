import type { NotificationType } from './notification.types';

import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { Composer, NotificationComposer } from './notification-composer.abstract';

@Injectable()
export class NotificationComposerFactory {
  constructor(private readonly discoveryService: DiscoveryService) {}

  getComposer(type: NotificationType): NotificationComposer | undefined {
    const providers = this.discoveryService.getProviders();
    const composer = providers.find(provider => {
      return this.discoveryService.getMetadataByDecorator(Composer, provider) === type;
    })?.instance;
    return composer instanceof NotificationComposer ? composer : undefined;
  }
}
