import { createHash, randomBytes } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { assertDefined, assertPropString } from 'typeshaper';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { isRealtimeEventType, type RealtimeEventType } from '../realtime.types';

interface RealtimeAuthTokenStorageRecord {
  userId: string;
  sessionId: string;
  issuedAt: string;
  expiresAt: string;
  allowedEventTypes?: RealtimeEventType[];
}

export interface RealtimeAuthTokenValidationResult {
  userId: string;
  sessionId: string;
  issuedAt: Date;
  expiresAt: Date;
  allowedEventTypes?: ReadonlySet<RealtimeEventType>;
}

@Injectable()
export class RealtimeAuthTokensService {
  private readonly logger = new TelemetryLogger(RealtimeAuthTokensService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly appConfigService: AppConfigService,
  ) {}

  async createToken(
    userId: string,
    sessionId: string,
    allowedEventTypes?: ReadonlyArray<RealtimeEventType>,
  ) {
    const { tokenTtlSeconds, maxSubscriptionsPerConnection } = this.appConfigService.realtimeConfig;

    if (!userId || !sessionId) {
      throw new BadRequestException('User session is required to create realtime auth token');
    }

    const uniqueEvents = allowedEventTypes ? Array.from(new Set(allowedEventTypes)) : undefined;

    if (
      uniqueEvents &&
      uniqueEvents.length > maxSubscriptionsPerConnection &&
      maxSubscriptionsPerConnection > 0
    ) {
      throw new BadRequestException(
        `Cannot request more than ${maxSubscriptionsPerConnection} realtime subscriptions`,
      );
    }

    const token = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(token);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + tokenTtlSeconds * 1000);

    const storageRecord: RealtimeAuthTokenStorageRecord = {
      userId,
      sessionId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      allowedEventTypes: uniqueEvents?.length ? uniqueEvents : undefined,
    };

    await this.redisService.set(
      this.buildKey(tokenHash),
      JSON.stringify(storageRecord),
      tokenTtlSeconds,
    );

    this.logger.log(
      `Issued realtime auth token for user ${userId} (session ${sessionId}) valid for ${tokenTtlSeconds} seconds`,
    );

    return {
      token,
      expiresAt: storageRecord.expiresAt,
      expiresIn: tokenTtlSeconds,
      allowedEventTypes: storageRecord.allowedEventTypes ?? [],
    };
  }

  async validateAndConsume(token: string): Promise<RealtimeAuthTokenValidationResult | null> {
    if (!token) {
      return null;
    }

    const tokenHash = this.hashToken(token);
    const raw = await this.redisService.get(this.buildKey(tokenHash));

    if (!raw) {
      return null;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      this.logger.error('Failed to parse realtime auth token payload', error as Error);
      await this.redisService.del(this.buildKey(tokenHash));
      return null;
    }

    try {
      const record = this.validateStorageRecord(parsed);
      await this.redisService.del(this.buildKey(tokenHash));

      const expiresAt = new Date(record.expiresAt);
      const issuedAt = new Date(record.issuedAt);

      if (Number.isNaN(expiresAt.valueOf()) || expiresAt.getTime() < Date.now()) {
        this.logger.warn('Realtime auth token expired before consumption');
        return null;
      }

      if (Number.isNaN(issuedAt.valueOf())) {
        this.logger.warn('Realtime auth token issuedAt is invalid');
        return null;
      }

      return {
        userId: record.userId,
        sessionId: record.sessionId,
        issuedAt,
        expiresAt,
        allowedEventTypes: record.allowedEventTypes ? new Set(record.allowedEventTypes) : undefined,
      };
    } catch (error) {
      this.logger.error('Invalid realtime auth token payload', error as Error);
      await this.redisService.del(this.buildKey(tokenHash));
      return null;
    }
  }

  private validateStorageRecord(value: unknown): RealtimeAuthTokenStorageRecord {
    assertDefined(value);
    assertPropString(value, 'userId');
    assertPropString(value, 'sessionId');
    assertPropString(value, 'issuedAt');
    assertPropString(value, 'expiresAt');

    const typed = value as RealtimeAuthTokenStorageRecord & {
      allowedEventTypes?: unknown;
    };

    if (typed.allowedEventTypes !== undefined && typed.allowedEventTypes !== null) {
      const candidate = typed.allowedEventTypes;

      if (!Array.isArray(candidate)) {
        throw new TypeError('allowedEventTypes must be an array of realtime event types');
      }

      for (const item of candidate) {
        if (!isRealtimeEventType(item)) {
          throw new TypeError(`Invalid realtime event type: ${String(item)}`);
        }
      }

      return {
        userId: typed.userId,
        sessionId: typed.sessionId,
        issuedAt: typed.issuedAt,
        expiresAt: typed.expiresAt,
        allowedEventTypes: candidate as RealtimeEventType[],
      };
    }

    return {
      userId: typed.userId,
      sessionId: typed.sessionId,
      issuedAt: typed.issuedAt,
      expiresAt: typed.expiresAt,
      allowedEventTypes: undefined,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildKey(hash: string): string {
    return `realtime:auth:${hash}`;
  }
}
