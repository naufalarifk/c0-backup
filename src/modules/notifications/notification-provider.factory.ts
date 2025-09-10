import type { NotificationChannel } from './notification.types';

import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { NotificationProvider } from './notification-provider.abstract';

export const NotificationProviderFlag = DiscoveryService.createDecorator<NotificationChannel>();

@Injectable()
export class NotificationProviderFactory {
  constructor(private readonly discoveryService: DiscoveryService) {}

  getComposer(type: NotificationChannel): NotificationProvider | undefined {
    const providers = this.discoveryService.getProviders();
    const composer = providers.find(provider => {
      return (
        this.discoveryService.getMetadataByDecorator(NotificationProviderFlag, provider) === type
      );
    })?.instance;
    return composer instanceof NotificationProvider ? composer : undefined;
  }
}
