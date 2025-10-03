import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import Redis from 'ioredis';

import { TelemetryLogger } from '../telemetry.logger';
import { AppConfigService } from './app-config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new TelemetryLogger(RedisService.name);
  private redis: Redis;
  // Separate client used only for subscribing to channels/patterns.
  private subClient?: Redis;

  // Handler types: receive parsed message (JSON object or raw string) and the channel name.
  // Using unknown for parsed message to avoid `any`.
  private readonly channelHandlers = new Map<
    string,
    Set<(message: unknown, channel: string) => void | Promise<void>>
  >();
  private readonly patternHandlers = new Map<
    string,
    Set<(message: unknown, channel: string) => void | Promise<void>>
  >();

  // Track subscriptions in progress to avoid duplicate subscribe calls.
  private readonly subscribingChannels = new Set<string>();
  private readonly patternSubscribing = new Set<string>();

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit() {
    try {
      this.redis = new Redis(this.configService.redisConfig);
      // this.redis.on('connect', () => this.logger.log('Connected to Redis'));
      this.redis.on('ready', () => this.logger.log('Redis connection is ready'));
      this.redis.on('error', error => this.logger.error('Redis connection error:', error));
      this.redis.on('close', () => this.logger.warn('Redis connection closed'));
      this.redis.on('reconnecting', () => this.logger.log('Reconnecting to Redis...'));

      // Create a dedicated subscriber client by duplicating the main connection.
      // Duplicate preserves connection options and prevents the subscriber from
      // blocking the publisher/client from issuing regular commands.
      this.subClient = this.redis.duplicate();
      // this.subClient.on('connect', () => this.logger.log('Redis subClient connected'));
      this.subClient.on('ready', () => this.logger.log('Redis subClient ready'));
      this.subClient.on('error', err => this.logger.error('Redis subClient error:', err));
      this.subClient.on('close', () => this.logger.warn('Redis subClient closed'));
      this.subClient.on('reconnecting', () => this.logger.log('Redis subClient reconnecting...'));

      // Dispatch incoming channel messages to registered handlers.
      this.subClient.on('message', (channel: string, message: string) => {
        const handlers = this.channelHandlers.get(channel);
        if (!handlers || handlers.size === 0) return;
        const payload = this.safeParseMessage(message);
        handlers.forEach(handler => {
          try {
            // Fire-and-forget: handlers can be async but we don't await them here.
            void Promise.resolve(handler(payload, channel));
          } catch (err) {
            this.logger.error(`Error in channel handler for ${channel}:`, err as Error);
          }
        });
      });

      // Dispatch pattern messages: (pattern, channel, message)
      this.subClient.on('pmessage', (_pattern: string, channel: string, message: string) => {
        // Notify handlers registered for the specific pattern(s)
        this.patternHandlers.forEach((set, pattern) => {
          // ioredis ensures that pmessage provides the pattern that matched,
          // but we'll call handlers for the pattern key.
          if (set.size === 0) return;
          const payload = this.safeParseMessage(message);
          set.forEach(handler => {
            try {
              void Promise.resolve(handler(payload, channel));
            } catch (err) {
              this.logger.error(
                `Error in pattern handler for ${pattern} (channel ${channel}):`,
                err as Error,
              );
            }
          });
        });
      });

      // Test connection
      await this.ping();
      this.logger.log('Redis service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Redis service:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.logger.log('Redis connection closed gracefully');
      }
      if (this.subClient) {
        try {
          await this.subClient.quit();
          this.logger.log('Redis subscriber connection closed gracefully');
        } catch (err) {
          this.logger.error('Error closing Redis subscriber connection:', err);
        }
      }
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.redis.ping();
    } catch (error) {
      this.logger.error('Error pinging Redis:', error);
      throw error;
    }
  }

  async exists(...keys: Array<string>): Promise<number> {
    try {
      return await this.redis.exists(...keys);
    } catch (error) {
      this.logger.error(`Error checking existence one of keys ${keys.join(', ')}:`, error);
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.redis.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Error setting expiration for key ${key}:`, error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error);
      throw error;
    }
  }

  // Counter operations for rate limiting, sessions, etc.
  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error);
      throw error;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.redis.decr(key);
    } catch (error) {
      this.logger.error(`Error decrementing key ${key}:`, error);
      throw error;
    }
  }

  // Hash operations for session management
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis.hget(key, field);
    } catch (error) {
      this.logger.error(`Error getting hash field ${field} from key ${key}:`, error);
      throw error;
    }
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.redis.hset(key, field, value);
    } catch (error) {
      this.logger.error(`Error setting hash field ${field} for key ${key}:`, error);
      throw error;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redis.hgetall(key);
    } catch (error) {
      this.logger.error(`Error getting all hash fields for key ${key}:`, error);
      throw error;
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.redis.setex(key, ttl, value);
  }

  async persist(key: string): Promise<void> {
    await this.redis.persist(key);
  }

  // Direct client access for advanced operations
  getClient(): Redis {
    return this.redis;
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Publish a message to a channel. If `message` is not a string it will be JSON-stringified.
   * Returns the number of clients that received the message.
   */
  async publish(channel: string, message: unknown): Promise<number> {
    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.redis.publish(channel, payload);
    } catch (error) {
      this.logger.error(`Error publishing to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe a handler to a specific channel. The handler receives a parsed message (JSON parsed when possible)
   * and the channel name. Returns when the underlying Redis subscription completes.
   */
  async subscribe(
    channel: string,
    handler: (message: unknown, channel: string) => void | Promise<void>,
  ): Promise<void> {
    if (!this.subClient) {
      this.subClient = this.redis.duplicate();
    }

    const handlers = this.channelHandlers.get(channel) ?? new Set();
    handlers.add(handler);
    this.channelHandlers.set(channel, handlers);

    // If subscription already in progress or already subscribed, no-op.
    if (this.subscribingChannels.has(channel)) return;

    try {
      this.subscribingChannels.add(channel);
      const count = await this.subClient.subscribe(channel);
      this.logger.log(`Subscribed to channel ${channel} (total subscriptions: ${count})`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to channel ${channel}:`, err);
      // Remove the handler we just added on error to keep state consistent.
      handlers.delete(handler);
      if (handlers.size === 0) this.channelHandlers.delete(channel);
      throw err;
    } finally {
      this.subscribingChannels.delete(channel);
    }
  }

  /**
   * Unsubscribe a handler from a channel. If no handler is provided, all handlers for the channel are removed
   * and the underlying Redis subscription will be cancelled.
   */
  async unsubscribe(
    channel: string,
    handler?: (message: unknown, channel: string) => void | Promise<void>,
  ) {
    const handlers = this.channelHandlers.get(channel);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      this.channelHandlers.delete(channel);
      try {
        await this.subClient?.unsubscribe(channel);
        this.logger.log(`Unsubscribed from channel ${channel}`);
      } catch (err) {
        this.logger.error(`Failed to unsubscribe from channel ${channel}:`, err);
      }
    }
  }

  /**
   * Pattern subscribe - subscribe handlers for channels matching the given pattern.
   */
  async psubscribe(
    pattern: string,
    handler: (message: unknown, channel: string) => void | Promise<void>,
  ): Promise<void> {
    if (!this.subClient) this.subClient = this.redis.duplicate();

    const handlers = this.patternHandlers.get(pattern) ?? new Set();
    handlers.add(handler);
    this.patternHandlers.set(pattern, handlers);

    if (this.patternSubscribing.has(pattern)) return;

    try {
      this.patternSubscribing.add(pattern);
      const count = await this.subClient.psubscribe(pattern);
      this.logger.log(`Psubscribed to pattern ${pattern} (total subscriptions: ${count})`);
    } catch (err) {
      this.logger.error(`Failed to psubscribe to pattern ${pattern}:`, err);
      handlers.delete(handler);
      if (handlers.size === 0) this.patternHandlers.delete(pattern);
      throw err;
    } finally {
      this.patternSubscribing.delete(pattern);
    }
  }

  /**
   * Unsubscribe from a pattern. If handler is omitted, remove all handlers for the pattern and unsubscribe.
   */
  async punsubscribe(
    pattern: string,
    handler?: (message: unknown, channel: string) => void | Promise<void>,
  ) {
    const handlers = this.patternHandlers.get(pattern);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      this.patternHandlers.delete(pattern);
      try {
        await this.subClient?.punsubscribe(pattern);
        this.logger.log(`Punsubscribed from pattern ${pattern}`);
      } catch (err) {
        this.logger.error(`Failed to punsubscribe from pattern ${pattern}:`, err);
      }
    }
  }

  /**
   * Safely parse message payloads that might be JSON. Non-JSON strings are returned as-is.
   */
  private safeParseMessage(message: string | Buffer): unknown {
    const str = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}
