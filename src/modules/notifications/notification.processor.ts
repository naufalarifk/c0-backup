/** biome-ignore-all lint/suspicious/noExplicitAny: quick fix */

import type { Job } from 'bullmq';
import type { NotificationData } from './notification.types';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { NotificationService } from './notification.service';

@Injectable()
@Processor('notificationQueue')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<NotificationData>): Promise<void> {
    this.logger.log(`Processing notification job ${job.id} of type ${job.data.type}`);

    // Handle nested data structure from BullMQ serialization
    const notificationData: NotificationData = job.data.data
      ? { ...job.data.data, type: job.data.type }
      : job.data;

    // Ensure all properties that should be strings are properly serialized
    Object.keys(notificationData).forEach(key => {
      const value = (notificationData as any)[key];
      if (
        value !== null &&
        value !== undefined &&
        typeof value !== 'string' &&
        typeof value !== 'boolean' &&
        typeof value !== 'object'
      ) {
        // Convert numbers and other types to strings, except for specific known non-string fields
        const nonStringFields = ['badgeCount', 'priority', 'attempts', 'delay'];
        if (!nonStringFields.includes(key)) {
          (notificationData as any)[key] = String(value);
        }
      }
    });

    try {
      const composer = this.notificationService.getComposerByType(notificationData.type);
      const payloads = await composer.composePayloads(notificationData);

      this.logger.log(`Generated ${payloads.length} notification payloads for job ${job.id}`);

      for (const [index, payload] of payloads.entries()) {
        const providers = this.notificationService.getProvidersByPayload(payload);

        for (const provider of providers) {
          await provider.send(payload);
        }

        await job.updateProgress(Math.floor((100 * (index + 1)) / payloads.length));
      }

      this.logger.log(`Successfully processed notification job ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to process notification job ${job.id}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<NotificationData>) {
    this.logger.log(`Job ${job.id} started processing notification type: ${job.data.type}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationData>) {
    this.logger.log(`Job ${job.id} completed for notification type: ${job.data.type}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationData>, error: Error) {
    this.logger.error(`Job ${job.id} failed for notification type: ${job.data.type}:`, error);
  }
}
