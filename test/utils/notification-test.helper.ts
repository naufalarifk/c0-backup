import type { Queue } from 'bullmq';
import type { NotificationData } from '../../src/modules/notifications/notification.types';

/**
 * Helper utilities for notification e2e tests
 */
export class NotificationTestHelper {
  /**
   * Wait for a specific number of jobs to complete in the notification queue
   */
  static async waitForJobsToComplete(
    queue: Queue<NotificationData>,
    expectedCount: number,
    timeout: number = 30000,
    userIdFilter?: string,
  ): Promise<{ completed: number; failed: number }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${expectedCount} jobs to complete`));
      }, timeout);

      let completed = 0;
      let failed = 0;

      const checkCompletion = () => {
        if (completed + failed >= expectedCount) {
          clearTimeout(timeoutId);
          resolve({ completed, failed });
        }
      };

      // Local, narrow event-listener wrapper to avoid strict Queue event typing in tests
      type JobLike = { id?: string; data?: { data?: { userId?: string | number } } };

      const emitter = queue as unknown as {
        on: (event: string, listener: (job: JobLike) => void) => void;
      };

      emitter.on('completed', job => {
        if (!userIdFilter || job.data?.data?.userId?.toString().includes(userIdFilter)) {
          completed++;
          checkCompletion();
        }
      });

      emitter.on('failed', job => {
        if (!userIdFilter || job.data?.data?.userId?.toString().includes(userIdFilter)) {
          failed++;
          checkCompletion();
        }
      });
    });
  }

  /**
   * Wait for jobs with progress updates
   */
  static async waitForJobsWithProgress(
    queue: Queue<NotificationData>,
    expectedCount: number,
    timeout: number = 30000,
  ): Promise<{ jobs: Array<{ id: string; progress: number[] }> }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${expectedCount} jobs with progress`));
      }, timeout);

      const jobProgressMap = new Map<string, number[]>();
      let completedJobs = 0;

      type JobLike = { id?: string };

      const emitter = queue as unknown as {
        on: (event: string, listener: (job: JobLike, progress?: unknown) => void) => void;
      };

      emitter.on('progress', (job, progress) => {
        if (typeof progress === 'number') {
          const jobId = job.id?.toString() || 'unknown';
          if (!jobProgressMap.has(jobId)) {
            jobProgressMap.set(jobId, []);
          }
          jobProgressMap.get(jobId)!.push(progress);
        }
      });

      emitter.on('completed', () => {
        completedJobs++;
        if (completedJobs >= expectedCount) {
          clearTimeout(timeoutId);
          const jobs = Array.from(jobProgressMap.entries()).map(([id, progress]) => ({
            id,
            progress,
          }));
          resolve({ jobs });
        }
      });
    });
  }

  /**
   * Generate test notification data with common patterns
   */
  static generateTestNotificationData(
    type: NotificationData['type'],
    index: number,
    timestamp: number = Date.now(),
  ): NotificationData {
    const baseUserId = `test-${type.toLowerCase()}-${index}-${timestamp}`;
    const baseEmail = `test-${type.toLowerCase()}-${index}-${timestamp}@example.com`;

    const commonData = {
      userId: baseUserId,
      email: baseEmail,
      name: `Test User ${index}`,
    };

    switch (type) {
      case 'UserRegistered':
        return {
          type,
          data: commonData,
        };

      case 'EmailVerification':
        return {
          type,
          ...commonData,
          token: `verify-token-${index}-${timestamp}`,
        };

      case 'PasswordResetRequested':
        return {
          type,
          ...commonData,
          token: `reset-token-${index}-${timestamp}`,
        };

      case 'LoanRepaymentDue':
        return {
          type,
          ...commonData,
          phoneNumber: `+155500${String(index).padStart(4, '0')}`,
          fcmToken: `fcm-token-${index}-${timestamp}`,
          loanId: `loan-${index}`,
          amount: `${(index + 1) * 100}.00`,
          currency: 'USD',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        };

      case 'SuspiciousLoginAttempt':
        return {
          type,
          ...commonData,
          phoneNumber: `+155501${String(index).padStart(4, '0')}`,
          fcmToken: `fcm-security-token-${index}-${timestamp}`,
          location: `Location ${index}`,
          ipAddress: `192.168.1.${100 + (index % 155)}`,
          timestamp: new Date().toISOString(),
        };

      case 'UserKycVerified':
        return {
          type,
          ...commonData,
          phoneNumber: `+155502${String(index).padStart(4, '0')}`,
          verificationLevel: index % 2 === 0 ? 'Level 2' : 'Level 3',
          verifiedAt: new Date().toISOString(),
        };

      default:
        return {
          type,
          ...commonData,
        };
    }
  }

  /**
   * Generate bulk test notifications
   */
  static generateBulkTestNotifications(
    count: number,
    types: NotificationData['type'][],
    timestamp: number = Date.now(),
  ): NotificationData[] {
    const notifications: NotificationData[] = [];

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      notifications.push(this.generateTestNotificationData(type, i, timestamp));
    }

    return notifications;
  }

  /**
   * Assert queue statistics
   */
  static assertQueueStats(
    actual: { waiting: number; active: number; completed: number; failed: number },
    expected: Partial<{ waiting: number; active: number; completed: number; failed: number }>,
  ): void {
    if (expected.waiting !== undefined) {
      expect(actual.waiting).toBe(expected.waiting);
    }
    if (expected.active !== undefined) {
      expect(actual.active).toBe(expected.active);
    }
    if (expected.completed !== undefined) {
      expect(actual.completed).toBeGreaterThanOrEqual(expected.completed);
    }
    if (expected.failed !== undefined) {
      expect(actual.failed).toBe(expected.failed);
    }
  }

  /**
   * Clean up queue state
   */
  static async cleanQueue(queue: Queue<NotificationData>): Promise<void> {
    // Use a narrow cleaner type to accept string-based job type names used in tests
    const cleaner = queue as unknown as {
      drain: () => Promise<void>;
      clean: (grace: number, type: string) => Promise<void>;
    };

    await cleaner.drain();
    await cleaner.clean(0, 'completed');
    await cleaner.clean(0, 'failed');
    await cleaner.clean(0, 'active');
    await cleaner.clean(0, 'waiting');
    await cleaner.clean(0, 'delayed');
  }

  /**
   * Create mock provider calls tracker
   */
  static createMockTracker<T>(): {
    calls: T[];
    clear: () => void;
    getMock: () => jest.MockedFunction<(data: T) => Promise<void>>;
  } {
    const calls: T[] = [];

    const mockFn = jest.fn().mockImplementation(async (data: T) => {
      calls.push(data);
    });

    return {
      calls,
      clear: () => {
        calls.length = 0;
      },
      getMock: () => mockFn,
    };
  }

  /**
   * Validate notification content structure
   */
  static validateNotificationContent(
    content: { HTML?: string; Text?: string },
    expectations: {
      containsHTML?: string[];
      containsText?: string[];
      minHTMLLength?: number;
      minTextLength?: number;
    },
  ): void {
    if (expectations.containsHTML) {
      expect(content.HTML).toBeTruthy();
      for (const text of expectations.containsHTML) {
        expect(content.HTML).toContain(text);
      }
    }

    if (expectations.containsText) {
      expect(content.Text).toBeTruthy();
      for (const text of expectations.containsText) {
        expect(content.Text).toContain(text);
      }
    }

    if (expectations.minHTMLLength) {
      expect(content.HTML?.length || 0).toBeGreaterThan(expectations.minHTMLLength);
    }

    if (expectations.minTextLength) {
      expect(content.Text?.length || 0).toBeGreaterThan(expectations.minTextLength);
    }
  }

  /**
   * Performance measurement helper
   */
  static async measurePerformance<T>(
    operation: () => Promise<T>,
    label: string = 'Operation',
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;

    console.log(`📊 ${label} completed in ${duration}ms`);

    return { result, duration };
  }

  /**
   * Batch operation helper
   */
  static async executeBatch<T, R>(
    items: T[],
    operation: (item: T, index: number) => Promise<R>,
    batchSize: number = 10,
    delayBetweenBatches: number = 100,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((item, batchIndex) => operation(item, i + batchIndex)),
      );

      results.push(...batchResults);

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < items.length && delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}
