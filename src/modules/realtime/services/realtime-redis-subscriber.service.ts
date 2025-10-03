import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { assertDefined, assertPropString } from 'typeshaper';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { RealtimeEventRegistry } from '../realtime.event-registry';
import {
  isRealtimeEventType,
  type RealtimeBroadcastEvent,
  type RealtimeEventType,
} from '../realtime.types';
import { RealtimeConnectionsService } from './realtime-connections.service';

interface IncomingRealtimeEvent {
  userId: string;
  type: RealtimeEventType;
  timestamp?: string;
  data: unknown;
}

@Injectable()
export class RealtimeRedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new TelemetryLogger(RealtimeRedisSubscriberService.name);
  private readonly channel: string;
  private readonly handler = (message: unknown) => {
    void this.handleIncomingEvent(message);
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly connectionsService: RealtimeConnectionsService,
    private readonly eventRegistry: RealtimeEventRegistry,
    appConfigService: AppConfigService,
  ) {
    this.channel = appConfigService.realtimeConfig.redisChannel;
  }

  async onModuleInit(): Promise<void> {
    await this.redisService.subscribe(this.channel, this.handler);
    this.logger.log(`Realtime module subscribed to channel ${this.channel}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redisService.unsubscribe(this.channel, this.handler);
  }

  private async handleIncomingEvent(message: unknown): Promise<void> {
    try {
      const parsed = this.validateIncoming(message);
      const payload = this.eventRegistry.validate(parsed.type, parsed.data);

      const event: RealtimeBroadcastEvent<typeof parsed.type> = {
        userId: parsed.userId,
        type: parsed.type,
        data: payload,
        timestamp: parsed.timestamp ?? new Date().toISOString(),
      };

      const recipients = this.connectionsService.broadcast(event);

      if (recipients === 0) {
        this.logger.debug(`No realtime subscribers for ${parsed.type} targeting ${parsed.userId}`);
      }
    } catch (error) {
      this.logger.error('Failed to process realtime event', error as Error);
    }
  }

  private validateIncoming(value: unknown): IncomingRealtimeEvent {
    assertDefined(value);
    assertPropString(value, 'userId');
    assertPropString(value, 'type');

    const payload = value as {
      userId: string;
      type: string;
      data: unknown;
      timestamp?: string;
    };

    if (!isRealtimeEventType(payload.type)) {
      throw new TypeError(`Unsupported realtime event type: ${payload.type}`);
    }

    return {
      userId: payload.userId,
      type: payload.type,
      data: payload.data,
      timestamp: payload.timestamp,
    };
  }
}
