import type { RealtimeBroadcastEvent, RealtimeEventType } from '../realtime.types';

import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';

type WebSocket = {
  readonly readyState: number;
  readonly OPEN?: number;
  send(data: string): void;
  close?(code?: number, reason?: string): void;
};

const WS_OPEN_STATE = 1;

interface RealtimeConnectionState {
  readonly id: string;
  readonly socket: WebSocket;
  readonly createdAt: number;
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  subscriptions: Set<RealtimeEventType>;
}

interface AuthenticatedConnectionSnapshot {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly subscriptions: ReadonlySet<RealtimeEventType>;
}

@Injectable()
export class RealtimeConnectionsService {
  private readonly logger = new TelemetryLogger(RealtimeConnectionsService.name);
  private readonly connections = new Map<WebSocket, RealtimeConnectionState>();
  private readonly userSubscriptions = new Map<string, Map<RealtimeEventType, Set<WebSocket>>>();

  registerConnection(socket: WebSocket, connectionId: string): void {
    this.connections.set(socket, {
      id: connectionId,
      socket,
      createdAt: Date.now(),
      authenticated: false,
      subscriptions: new Set(),
    });
  }

  authenticateConnection(
    socket: WebSocket,
    userId: string,
    sessionId: string,
  ): AuthenticatedConnectionSnapshot {
    const state = this.connections.get(socket);

    if (!state) {
      throw new Error('Connection not found during authentication');
    }

    state.userId = userId;
    state.sessionId = sessionId;
    state.authenticated = true;

    return {
      id: state.id,
      userId,
      sessionId,
      subscriptions: state.subscriptions,
    };
  }

  updateSubscriptions(
    socket: WebSocket,
    eventTypes: ReadonlyArray<RealtimeEventType>,
    maxSubscriptions: number,
  ): ReadonlySet<RealtimeEventType> {
    const state = this.connections.get(socket);

    if (!state) {
      throw new Error('Connection not found while updating subscriptions');
    }

    if (!state.authenticated || !state.userId) {
      throw new Error('Cannot manage subscriptions for unauthenticated connection');
    }

    if (maxSubscriptions > 0 && eventTypes.length > maxSubscriptions) {
      throw new Error('Subscription limit exceeded');
    }

    this.removeAllSubscriptions(state);

    for (const eventType of eventTypes) {
      state.subscriptions.add(eventType);
      this.addSubscription(state.userId, eventType, socket);
    }

    return state.subscriptions;
  }

  removeConnection(socket: WebSocket): void {
    const state = this.connections.get(socket);
    if (!state) {
      return;
    }

    if (state.userId) {
      this.removeAllSubscriptions(state);
    }

    this.connections.delete(socket);
    this.logger.log(`Removed realtime connection ${state.id}`);
  }

  broadcast(event: RealtimeBroadcastEvent): number {
    const { userId, type } = event;
    const userMap = this.userSubscriptions.get(userId);
    if (!userMap) {
      return 0;
    }

    const sockets = userMap.get(type);
    if (!sockets || sockets.size === 0) {
      return 0;
    }

    const payload = JSON.stringify({ event: type, data: event.data });
    let delivered = 0;

    for (const socket of sockets) {
      const openState = socket.OPEN ?? WS_OPEN_STATE;
      if (socket.readyState !== openState) {
        continue;
      }

      try {
        socket.send(payload);
        delivered += 1;
      } catch (error) {
        this.logger.error('Failed to deliver realtime event', error as Error);
      }
    }

    if (delivered > 0) {
      this.logger.debug(
        `Delivered realtime event ${type} to ${delivered} connection(s) for user ${userId}`,
      );
    }

    return delivered;
  }

  isAuthenticated(socket: WebSocket): boolean {
    return Boolean(this.connections.get(socket)?.authenticated);
  }

  getConnection(socket: WebSocket): RealtimeConnectionState | undefined {
    return this.connections.get(socket);
  }

  private addSubscription(userId: string, eventType: RealtimeEventType, socket: WebSocket) {
    const userMap =
      this.userSubscriptions.get(userId) ?? new Map<RealtimeEventType, Set<WebSocket>>();
    const subscribers = userMap.get(eventType) ?? new Set<WebSocket>();
    subscribers.add(socket);
    userMap.set(eventType, subscribers);
    this.userSubscriptions.set(userId, userMap);
  }

  private removeSubscription(userId: string, eventType: RealtimeEventType, socket: WebSocket) {
    const userMap = this.userSubscriptions.get(userId);
    if (!userMap) {
      return;
    }

    const subscribers = userMap.get(eventType);
    if (!subscribers) {
      return;
    }

    subscribers.delete(socket);

    if (subscribers.size === 0) {
      userMap.delete(eventType);
    }

    if (userMap.size === 0) {
      this.userSubscriptions.delete(userId);
    }
  }

  private removeAllSubscriptions(state: RealtimeConnectionState) {
    if (!state.userId) {
      return;
    }

    for (const eventType of state.subscriptions) {
      this.removeSubscription(state.userId, eventType, state.socket);
    }

    state.subscriptions.clear();
  }
}
