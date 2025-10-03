import type { AppConfigService } from '../../shared/services/app-config.service';
import type { RedisService } from '../../shared/services/redis.service';

import assert from 'node:assert';
import { describe, it } from 'node:test';

import { RealtimeEventTypeEnum } from './realtime.types';
import { RealtimeAuthTokensService } from './services/realtime-auth-tokens.service';

class InMemoryRedisService {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }
}

class StubAppConfigService {
  constructor(private readonly overrides?: Partial<AppConfigService['realtimeConfig']>) {}

  get realtimeConfig() {
    return {
      tokenTtlSeconds: 60,
      handshakeTimeoutMs: 1_000,
      maxSubscriptionsPerConnection: 5,
      redisChannel: 'realtime:events',
      ...this.overrides,
    } as const;
  }
}

describe('RealtimeAuthTokensService', () => {
  it('issues and validates realtime auth tokens', async () => {
    const redis = new InMemoryRedisService();
    const config = new StubAppConfigService();
    const service = new RealtimeAuthTokensService(
      redis as unknown as RedisService,
      config as unknown as AppConfigService,
    );

    const response = await service.createToken('user-123', 'session-abc', [
      RealtimeEventTypeEnum.NotificationCreated,
    ]);

    assert.ok(response.token.length > 0, 'Token should be generated');
    assert.strictEqual(response.allowedEventTypes.length, 1);
    assert.strictEqual(response.allowedEventTypes[0], RealtimeEventTypeEnum.NotificationCreated);

    const validation = await service.validateAndConsume(response.token);
    assert.ok(validation, 'Token should validate exactly once');
    assert.strictEqual(validation?.userId, 'user-123');
    assert.strictEqual(validation?.sessionId, 'session-abc');
    assert.ok(validation?.allowedEventTypes?.has(RealtimeEventTypeEnum.NotificationCreated));

    const secondAttempt = await service.validateAndConsume(response.token);
    assert.strictEqual(secondAttempt, null, 'Token should not be reusable');
  });

  it('enforces subscription limit when issuing tokens', async () => {
    const redis = new InMemoryRedisService();
    const config = new StubAppConfigService({ maxSubscriptionsPerConnection: 1 });
    const service = new RealtimeAuthTokensService(
      redis as unknown as RedisService,
      config as unknown as AppConfigService,
    );

    await assert.rejects(
      () =>
        service.createToken('user-123', 'session-abc', [
          RealtimeEventTypeEnum.NotificationCreated,
          RealtimeEventTypeEnum.LoanStatusChanged,
        ]),
      /Cannot request more than 1 realtime subscriptions/,
    );
  });
});
