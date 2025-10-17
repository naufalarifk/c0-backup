import type { IncomingMessage } from 'node:http';

import { randomUUID } from 'node:crypto';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import { assertDefined, assertPropString } from 'typeshaper';

import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { isRealtimeEventType, RealtimeEventType } from './realtime.types';
import { RealtimeAuthTokensService } from './services/realtime-auth-tokens.service';
import { RealtimeConnectionsService } from './services/realtime-connections.service';

interface AuthMessagePayload {
  accessToken: string;
  events: RealtimeEventType[];
}

interface HandshakeContext {
  readonly id: string;
  readonly origin?: string;
}

type GatewayWebSocket = {
  readonly readyState: number;
  readonly OPEN?: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
};

const WS_OPEN_STATE = 1;
const CLOSE_CODE_AUTH_FAILURE = 4003;
const CLOSE_CODE_ORIGIN_REJECTED = 4004;
const CLOSE_CODE_HANDSHAKE_TIMEOUT = 4005;

@WebSocketGateway({ path: '/api/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new TelemetryLogger(RealtimeGateway.name);
  private readonly allowedOrigins: readonly string[];
  private readonly handshakeTimeoutMs: number;
  private readonly maxSubscriptions: number;
  private readonly authTimeouts = new WeakMap<GatewayWebSocket, NodeJS.Timeout>();
  private readonly connectionContexts = new WeakMap<GatewayWebSocket, HandshakeContext>();

  constructor(
    private readonly authTokensService: RealtimeAuthTokensService,
    private readonly connectionsService: RealtimeConnectionsService,
    appConfigService: AppConfigService,
  ) {
    const { handshakeTimeoutMs, maxSubscriptionsPerConnection } = appConfigService.realtimeConfig;
    this.handshakeTimeoutMs = handshakeTimeoutMs;
    this.maxSubscriptions = maxSubscriptionsPerConnection;
    this.allowedOrigins = appConfigService.app.allowedOrigins;
  }

  handleConnection(client: GatewayWebSocket, request: IncomingMessage): void {
    const connectionId = randomUUID();
    const origin = this.extractOrigin(request);

    if (!this.isOriginAllowed(origin)) {
      this.logger.warn(`Rejected realtime connection ${connectionId} from origin ${origin}`);
      client.close(CLOSE_CODE_ORIGIN_REJECTED, 'Origin not allowed');
      return;
    }

    this.connectionsService.registerConnection(client, connectionId);
    this.connectionContexts.set(client, { id: connectionId, origin });

    const timeout = setTimeout(() => {
      if (!this.connectionsService.isAuthenticated(client)) {
        this.logger.warn(`Realtime connection ${connectionId} failed to authenticate in time`);
        client.close(CLOSE_CODE_HANDSHAKE_TIMEOUT, 'Authentication timeout');
        this.connectionsService.removeConnection(client);
      }
    }, this.handshakeTimeoutMs).unref();

    this.authTimeouts.set(client, timeout);
    this.logger.debug(`Accepted realtime connection ${connectionId} from origin ${origin}`);
  }

  handleDisconnect(client: GatewayWebSocket): void {
    const context = this.connectionContexts.get(client);

    if (context) {
      this.logger.debug(`Closing realtime connection ${context.id}`);
    }

    const timeout = this.authTimeouts.get(client);
    if (timeout) {
      clearTimeout(timeout);
      this.authTimeouts.delete(client);
    }

    this.connectionsService.removeConnection(client);
    this.connectionContexts.delete(client);
  }

  @SubscribeMessage('auth')
  async handleAuth(@ConnectedSocket() client: GatewayWebSocket, @MessageBody() payload: unknown) {
    if (this.connectionsService.isAuthenticated(client)) {
      this.sendError(client, 'ALREADY_AUTHENTICATED', 'Connection already authenticated');
      return;
    }

    let authPayload: AuthMessagePayload;

    try {
      authPayload = this.validateAuthPayload(payload);
    } catch (error) {
      this.sendError(client, 'INVALID_PAYLOAD', (error as Error).message);
      client.close(CLOSE_CODE_AUTH_FAILURE, 'Invalid authentication payload');
      return;
    }

    const tokenRecord = await this.authTokensService.validateAndConsume(authPayload.accessToken);

    if (!tokenRecord) {
      this.sendError(
        client,
        'INVALID_TOKEN',
        'Realtime authentication token is invalid or expired',
      );
      client.close(CLOSE_CODE_AUTH_FAILURE, 'Invalid token');
      return;
    }

    if (authPayload.events.length === 0) {
      this.sendError(
        client,
        'EMPTY_SUBSCRIPTIONS',
        'At least one realtime event subscription is required',
      );
      client.close(CLOSE_CODE_AUTH_FAILURE, 'No subscriptions provided');
      return;
    }

    if (this.maxSubscriptions > 0 && authPayload.events.length > this.maxSubscriptions) {
      this.sendError(
        client,
        'SUBSCRIPTION_LIMIT',
        `Cannot subscribe to more than ${this.maxSubscriptions} realtime events`,
      );
      client.close(CLOSE_CODE_AUTH_FAILURE, 'Subscription limit exceeded');
      return;
    }

    if (tokenRecord.allowedEventTypes && tokenRecord.allowedEventTypes.size > 0) {
      for (const eventType of authPayload.events) {
        if (!tokenRecord.allowedEventTypes.has(eventType)) {
          this.sendError(
            client,
            'FORBIDDEN_EVENT',
            `Subscription to ${eventType} is not permitted by the issued token`,
          );
          client.close(CLOSE_CODE_AUTH_FAILURE, 'Subscription not permitted');
          return;
        }
      }
    }

    const connection = this.connectionsService.authenticateConnection(
      client,
      tokenRecord.userId,
      tokenRecord.sessionId,
    );

    const subscriptions = this.connectionsService.updateSubscriptions(
      client,
      authPayload.events,
      this.maxSubscriptions,
    );

    const timeout = this.authTimeouts.get(client);
    if (timeout) {
      clearTimeout(timeout);
      this.authTimeouts.delete(client);
    }

    this.sendMessage(client, 'auth.confirmed', {
      userId: connection.userId,
      sessionId: connection.sessionId,
      subscriptions: Array.from(subscriptions),
      issuedAt: tokenRecord.issuedAt.toISOString(),
      expiresAt: tokenRecord.expiresAt.toISOString(),
    });

    const context = this.connectionContexts.get(client);
    if (context) {
      this.logger.log(
        `Realtime connection ${context.id} authenticated for user ${connection.userId} with ${subscriptions.size} subscriptions`,
      );
    }
  }

  private validateAuthPayload(value: unknown): AuthMessagePayload {
    assertDefined(value);
    assertPropString(value, 'accessToken');

    const payload = value as {
      accessToken: string;
      events?: unknown;
    };

    if (!payload.accessToken || payload.accessToken.trim().length === 0) {
      throw new TypeError('accessToken must be a non-empty string');
    }

    if (!Array.isArray(payload.events)) {
      throw new TypeError('events must be an array of realtime event types');
    }

    if (payload.events.some(event => !isRealtimeEventType(event))) {
      throw new TypeError('events array contains unsupported event types');
    }

    const events = payload.events as RealtimeEventType[];
    const uniqueEvents = Array.from(new Set<RealtimeEventType>(events));

    return {
      accessToken: payload.accessToken,
      events: uniqueEvents,
    };
  }

  private sendMessage(
    client: GatewayWebSocket,
    event: string,
    data: Record<string, unknown>,
  ): void {
    if (!this.isSocketOpen(client)) {
      return;
    }

    const payload = JSON.stringify({ event, data });

    try {
      client.send(payload);
    } catch (error) {
      this.logger.error('Failed to send realtime message', error as Error);
    }
  }

  private sendError(client: GatewayWebSocket, code: string, message: string): void {
    this.sendMessage(client, 'auth.error', { code, message });
  }

  private isOriginAllowed(origin?: string): boolean {
    if (!origin || this.allowedOrigins.length === 0) {
      return true;
    }

    if (this.allowedOrigins.includes('*')) {
      return true;
    }

    return this.allowedOrigins.includes(origin);
  }

  private extractOrigin(request: IncomingMessage): string | undefined {
    const headers = request.headers;
    const origin = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin;
    return (
      origin ??
      (Array.isArray(headers['sec-websocket-origin'])
        ? headers['sec-websocket-origin'][0]
        : headers['sec-websocket-origin'])
    );
  }

  private isSocketOpen(socket: GatewayWebSocket): boolean {
    const openState = socket.OPEN ?? WS_OPEN_STATE;
    return socket.readyState === openState;
  }
}
