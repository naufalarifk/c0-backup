import assert from 'node:assert';
import { describe, it } from 'node:test';

import { RealtimeEventRegistry, registerDefaultRealtimeEvents } from './realtime.event-registry';
import { RealtimeEventTypeEnum } from './realtime.types';

describe('RealtimeEventRegistry', () => {
  it('validates notification created payload', () => {
    const registry = new RealtimeEventRegistry();
    registerDefaultRealtimeEvents(registry);

    const payload = registry.validate(RealtimeEventTypeEnum.NotificationCreated, {
      notificationId: 'notif-1',
      type: 'UserRegistered',
      title: 'Welcome',
      content: 'Hello there',
      createdAt: new Date().toISOString(),
    });

    assert.strictEqual(payload.notificationId, 'notif-1');
    assert.strictEqual(payload.title, 'Welcome');
  });

  it('throws on unsupported event type', () => {
    const registry = new RealtimeEventRegistry();
    registerDefaultRealtimeEvents(registry);

    assert.throws(() => registry.validate('unknown.event' as never, {}), /No validator registered/);
  });

  it('throws on invalid payload shape', () => {
    const registry = new RealtimeEventRegistry();
    registerDefaultRealtimeEvents(registry);

    assert.throws(() =>
      registry.validate(RealtimeEventTypeEnum.NotificationCreated, {
        notificationId: 'notif-1',
      }),
    );
  });
});
