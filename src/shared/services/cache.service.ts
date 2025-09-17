import type { CacheOptions } from '../types/redis.types';

import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../telemetry.logger';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new TelemetryLogger(CacheService.name);
  private readonly defaultTTL = 3600; // 1 hour
  private readonly defaultPrefix = 'cache';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get cached data with automatic JSON parsing
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const cacheKey = this.buildKey(key, options?.prefix);
    const cached = await this.redisService.get(cacheKey);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(`Error parsing JSON for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data with automatic JSON serialization
   */
  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    const cacheKey = this.buildKey(key, options?.prefix);
    const ttl = options?.ttl ?? this.defaultTTL;

    try {
      const serialized = JSON.stringify(data);
      await this.redisService.set(cacheKey, serialized, ttl);
    } catch (error) {
      this.logger.error(`Error serializing data for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete cached data
   */
  async del(key: string, options?: CacheOptions): Promise<void> {
    const cacheKey = this.buildKey(key, options?.prefix);
    await this.redisService.del(cacheKey);
  }

  /**
   * Get or set cached data (cache-aside pattern)
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetcher();

    // Cache the fresh data (don't fail if caching fails)
    try {
      await this.set(key, fresh, options);
    } catch (error) {
      this.logger.warn(`Failed to cache data for key ${key}, continuing with fresh data:`, error);
    }

    return fresh;
  }

  /**
   * Invalidate cache by pattern (be careful with this!)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const client = this.redisService.getClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      // Delete keys one by one
      for (const key of keys) {
        await this.redisService.del(key);
      }
      this.logger.log(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
    }
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const actualPrefix = prefix ?? this.defaultPrefix;
    return `${actualPrefix}:${key}`;
  }
}
