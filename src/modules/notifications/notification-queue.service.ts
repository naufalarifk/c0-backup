/** biome-ignore-all lint/suspicious/noExplicitAny: test req */

import type { Queue } from 'bullmq';
import type { NotificationData, NotificationType } from './notification.types';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

export interface QueueNotificationOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @InjectQueue('notificationQueue')
    private readonly notificationQueue: Queue<NotificationData>,
  ) {}

  async queueNotification(
    data: NotificationData,
    options: QueueNotificationOptions = {},
  ): Promise<void> {
    try {
      const job = await this.notificationQueue.add(`notification-${data.type}`, data, {
        priority: options.priority ?? 10,
        delay: options.delay ?? 0,
        attempts: options.attempts ?? 3,
        backoff: options.backoff ?? {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      this.logger.log(`Queued notification ${data.type} with job ID: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to queue notification ${data.type}:`, error);
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.notificationQueue.getWaiting(),
        this.notificationQueue.getActive(),
        this.notificationQueue.getCompleted(),
        this.notificationQueue.getFailed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch (error) {
      this.logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  async clearQueue(): Promise<void> {
    try {
      // Clear all job types including delayed jobs
      await this.notificationQueue.drain();
      await this.notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'completed');
      await this.notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'failed');
      await this.notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'active');
      await this.notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'waiting');
      await this.notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'delayed');
      this.logger.log('Notification queue cleared');
    } catch (error) {
      this.logger.error('Failed to clear notification queue:', error);
      throw error;
    }
  }
}
