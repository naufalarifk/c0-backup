import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { RealtimeAuthTokensController } from './controllers/realtime-auth-tokens.controller';
import { RealtimeEventRegistry, registerDefaultRealtimeEvents } from './realtime.event-registry';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeAuthTokensService } from './services/realtime-auth-tokens.service';
import { RealtimeConnectionsService } from './services/realtime-connections.service';
import { RealtimeRedisSubscriberService } from './services/realtime-redis-subscriber.service';

@Module({
  imports: [SharedModule],
  controllers: [RealtimeAuthTokensController],
  providers: [
    RealtimeGateway,
    RealtimeAuthTokensService,
    RealtimeConnectionsService,
    RealtimeRedisSubscriberService,
    RealtimeEventRegistry,
    {
      provide: 'REALTIME_EVENT_REGISTRY_INITIALIZER',
      inject: [RealtimeEventRegistry],
      useFactory: (registry: RealtimeEventRegistry) => {
        registerDefaultRealtimeEvents(registry);
        return true;
      },
    },
  ],
  exports: [RealtimeAuthTokensService, RealtimeEventRegistry],
})
export class RealtimeModule {}
