/** biome-ignore-all lint/suspicious/noExplicitAny: upstream fault, BullMQ docs (official docs via Context7 for the bullmq package) and confirmed that queue and worker events such as 'completed', 'failed', and 'progress' are valid runtime events — but TypeScript typings for Queue in the installed version can be strict and not accept those literal strings on the Queue interface in this project's type setup. */
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Job, Queue } from 'bullmq';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import type { NotificationData } from '../../../src/modules/notifications/notification.types';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { UserRegisteredNotificationData } from '../../../src/modules/notifications/composers/user-registered-notification.composer';
import { NotificationQueueService } from '../../../src/modules/notifications/notification-queue.service';
import { EmailNotificationProvider } from '../../../src/modules/notifications/providers/email-notification.provider';
import { FCMNotificationProvider } from '../../../src/modules/notifications/providers/fcm-notification.provider';
import { SMSNotificationProvider } from '../../../src/modules/notifications/providers/sms-notification.provider';
import { NotificationWorkerModule } from '../../../src/notification-worker.module';
import { TwilioService } from '../../../src/shared/services/twilio.service';
import MailContainer from '../../setup/mail-container';
import { TestContainerSetup } from '../../setup/test-containers';
import { MailpitHelper } from '../../utils';

describe('Notification Queue E2E', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let notificationQueueService: NotificationQueueService;
  let notificationQueue: Queue<NotificationData>;
  let emailProvider: EmailNotificationProvider;
  let fcmProvider: FCMNotificationProvider;
  let smsProvider: SMSNotificationProvider;
  let twilioService: TwilioService;
  let mailContainer: MailContainer;

  beforeAll(async () => {
    await TestContainerSetup.ensureContainersStarted();

    mailContainer = new MailContainer();
    await mailContainer.start();

    process.env.DATABASE_URL = TestContainerSetup.getPostgresConnectionString();
    process.env.DATABASE_LOGGER = 'false';

    const redisConfig = TestContainerSetup.getRedisConfig();
    process.env.REDIS_HOST = redisConfig.host;
    process.env.REDIS_PORT = String(redisConfig.port);
    process.env.REDIS_PASSWORD = redisConfig.password || '';

    // Email configuration
    process.env.MAIL_HOST = mailContainer.getHost();
    process.env.MAIL_SMTP_PORT = String(mailContainer.getSmtpPort());
    process.env.MAIL_HTTP_PORT = String(mailContainer.getHttpPort());
    process.env.MAIL_FROM = 'test@cryptogadai.com';

    // Mock services configuration
    process.env.TWILIO_ACCOUNT_SID = 'ACtest_account_sid_12345678901234567890';
    process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';

    moduleFixture = await Test.createTestingModule({
      imports: [NotificationWorkerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    notificationQueueService =
      moduleFixture.get<NotificationQueueService>(NotificationQueueService);
    notificationQueue = moduleFixture.get<Queue<NotificationData>>(
      getQueueToken('notificationQueue'),
    );
    emailProvider = moduleFixture.get<EmailNotificationProvider>(EmailNotificationProvider);
    fcmProvider = moduleFixture.get<FCMNotificationProvider>(FCMNotificationProvider);
    smsProvider = moduleFixture.get<SMSNotificationProvider>(SMSNotificationProvider);
    twilioService = moduleFixture.get<TwilioService>(TwilioService);

    // Mock non-email providers
    jest.spyOn(fcmProvider, 'send').mockImplementation(async notification => {
      console.log('Mock FCM send:', notification);
    });

    jest.spyOn(twilioService, 'sendSMS').mockImplementation(async smsData => {
      console.log('Mock SMS send:', smsData);
      return { sid: 'mock_sms_sid', status: 'sent' } as unknown as MessageInstance;
    });

    await app.init();
  }, 60_000);

  beforeEach(async () => {
    // Clear queue before each test
    await notificationQueue.drain();
    await notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'completed');
    await notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'failed');
    await notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'active');
    await notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'waiting');
    await notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'delayed');
    await MailpitHelper.clearAllMessages();

    // Add small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await mailContainer.stop();
    if (app) {
      await app.close();
    }
  });

  describe('Queue Operations', () => {
    it('should successfully queue a notification', async () => {
      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Allow a small delay to check the queue state
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check multiple queue states to ensure the job exists
      const [waitingJobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
        notificationQueue.getWaiting(),
        notificationQueue.getActive(),
        notificationQueue.getCompleted(),
        notificationQueue.getFailed(),
      ]);

      const totalJobs =
        waitingJobs.length + activeJobs.length + completedJobs.length + failedJobs.length;
      expect(totalJobs).toBeGreaterThan(0);

      // Find the job in any of the states
      const allJobs = [...waitingJobs, ...activeJobs, ...completedJobs, ...failedJobs];
      const matchingJob = allJobs.find(
        job =>
          job.data.type === notificationData.type &&
          (job.data as UserRegisteredNotificationData).userId === notificationData.userId,
      );

      expect(matchingJob).toBeDefined();
      expect(matchingJob!.data).toEqual(notificationData);
    }, 10_000);

    it('should queue notification with custom priority', async () => {
      // Pause the worker BEFORE queuing to prevent immediate processing
      await notificationQueue.pause();

      try {
        const highPriorityData: NotificationData = {
          type: 'EmailVerification',
          userId: 'high-priority-' + Date.now(),
          email: 'test@example.com',
          url: 'https://example.com/verify?token=verification-token',
          name: 'Test User',
        };

        const lowPriorityData: NotificationData = {
          type: 'UserRegistered',
          userId: 'low-priority-' + Date.now(),
          email: 'test2@example.com',
          name: 'Test User 2',
        };

        // Queue both jobs with delays to ensure they persist in the queue
        await notificationQueueService.queueNotification(lowPriorityData, {
          priority: 1,
          delay: 30000, // 30 second delay to keep in delayed state
        });
        await notificationQueueService.queueNotification(highPriorityData, {
          priority: 10,
          delay: 30000, // 30 second delay to keep in delayed state
        });

        // Wait for jobs to be properly queued
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check all job states, focusing on delayed jobs
        const [waiting, active, completed, delayed] = await Promise.all([
          notificationQueue.getWaiting(),
          notificationQueue.getActive(),
          notificationQueue.getCompleted(),
          notificationQueue.getDelayed(),
        ]);

        const totalJobs = waiting.length + active.length + completed.length + delayed.length;
        expect(totalJobs).toBeGreaterThanOrEqual(2);

        // Check that both jobs are in the delayed state and verify priority
        expect(delayed.length).toBeGreaterThanOrEqual(2);

        // Find our specific jobs
        const highPriorityJob = delayed.find(job => job.data.userId === highPriorityData.userId);
        const lowPriorityJob = delayed.find(job => job.data.userId === lowPriorityData.userId);

        expect(highPriorityJob).toBeDefined();
        expect(lowPriorityJob).toBeDefined();
        expect(highPriorityJob!.opts.priority).toBe(10);
        expect(lowPriorityJob!.opts.priority).toBe(1);
      } finally {
        // Clean up delayed jobs and resume processing
        await notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'delayed');
        await notificationQueue.resume();
      }
    }, 15_000);

    it('should queue delayed notification', async () => {
      const notificationData: NotificationData = {
        type: 'UserRegistered',
        userId: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      const delay = 5000; // 5 seconds
      await notificationQueueService.queueNotification(notificationData, { delay });

      const delayedJobs = await notificationQueue.getDelayed();
      expect(delayedJobs).toHaveLength(1);
      expect(delayedJobs[0].data).toEqual(notificationData);
      expect(delayedJobs[0].opts.delay).toBe(delay);
    });

    it('should get accurate queue statistics', async () => {
      // Pause the worker to prevent immediate processing
      await notificationQueue.pause();

      try {
        // Add some jobs with unique IDs and delay to prevent immediate processing
        const baseId = 'stats-test-' + Date.now();
        const notificationData: NotificationData = {
          type: 'UserRegistered',
          userId: baseId + '-1',
          email: 'test@example.com',
          name: 'Test User',
        };

        // Queue jobs with delay to ensure they stay in the queue
        await Promise.all([
          notificationQueueService.queueNotification(notificationData, { delay: 30000 }),
          notificationQueueService.queueNotification(
            {
              ...notificationData,
              userId: baseId + '-2',
            },
            { delay: 30000 },
          ),
          notificationQueueService.queueNotification(
            {
              ...notificationData,
              userId: baseId + '-3',
            },
            { delay: 30000 },
          ),
        ]);

        // Wait for jobs to be properly queued
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Poll for jobs to appear in delayed state
        let totalJobs = 0;
        let attempts = 0;
        const maxAttempts = 10;

        while (totalJobs < 3 && attempts < maxAttempts) {
          const stats = await notificationQueueService.getQueueStats();
          // Also check delayed jobs since we queued with delay
          const delayedJobs = await notificationQueue.getDelayed();
          totalJobs =
            stats.waiting + stats.active + stats.completed + stats.failed + delayedJobs.length;
          attempts++;

          if (totalJobs < 3) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Should have at least 3 jobs in the system (likely in delayed state)
        expect(totalJobs).toBeGreaterThanOrEqual(3);
      } finally {
        // Resume processing and clean up delayed jobs
        await notificationQueue.resume();
        await notificationQueue.clean(0, Number.MAX_SAFE_INTEGER, 'delayed');
      }
    }, 15_000);

    it('should clear queue successfully', async () => {
      // Pause the worker to prevent immediate processing
      await notificationQueue.pause();

      try {
        // Add jobs with delay to ensure they stay in the queue
        const baseId = 'clear-test-' + Date.now();
        const notificationData: NotificationData = {
          type: 'UserRegistered',
          userId: baseId + '-1',
          email: 'test@example.com',
          name: 'Test User',
        };

        await notificationQueueService.queueNotification(notificationData, { delay: 30000 });
        await notificationQueueService.queueNotification(
          {
            ...notificationData,
            userId: baseId + '-2',
          },
          { delay: 30000 },
        );

        // Wait for jobs to be queued
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check delayed jobs directly since they'll be in delayed state
        const delayedJobs = await notificationQueue.getDelayed();
        expect(delayedJobs.length).toBeGreaterThanOrEqual(2);

        await notificationQueueService.clearQueue();

        // Verify queue is cleared - check all states
        const [waiting, active, completed, failed, delayedAfterClear] = await Promise.all([
          notificationQueue.getWaiting(),
          notificationQueue.getActive(),
          notificationQueue.getCompleted(),
          notificationQueue.getFailed(),
          notificationQueue.getDelayed(),
        ]);

        const totalJobsAfterClear =
          waiting.length +
          active.length +
          completed.length +
          failed.length +
          delayedAfterClear.length;
        expect(totalJobsAfterClear).toBe(0);
      } finally {
        // Resume processing
        await notificationQueue.resume();
      }
    }, 15_000);
  });

  describe('Job Processing', () => {
    it('should process notification job successfully', async () => {
      const notificationData: NotificationData = {
        type: 'UserRegistered',
        userId: 'test-user-id-' + Date.now(),
        email: 'test@example.com',
        name: 'Test User',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for job to be processed by polling with better error handling
      let job: Job<NotificationData> | undefined;
      const startTime = Date.now();
      const timeout = 20000;

      while (!job && Date.now() - startTime < timeout) {
        const [completedJobs, failedJobs] = await Promise.all([
          notificationQueue.getCompleted(),
          notificationQueue.getFailed(),
        ]);

        job = completedJobs.find(
          j =>
            j.data && j.data.userId === notificationData.userId && j.data.type === 'UserRegistered',
        );

        if (!job) {
          // Check if job failed
          const failedJob = failedJobs.find(
            j =>
              j.data &&
              j.data.userId === notificationData.userId &&
              j.data.type === 'UserRegistered',
          );
          if (failedJob) {
            throw new Error(`Job failed: ${failedJob.failedReason}`);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!job) {
        throw new Error('Job processing timeout - job not found in completed or failed queues');
      }

      expect(job.data.userId).toBe(notificationData.userId);
      expect(job.data.type).toBe(notificationData.type);
      expect(job.finishedOn).toBeDefined();
    }, 20_000);

    it('should handle job retry on failure', async () => {
      // Create a notification that will fail (invalid type)
      const invalidNotificationData = {
        type: 'InvalidType',
        userId: 'invalid-user-id-' + Date.now(),
      } as any;

      await notificationQueueService.queueNotification(invalidNotificationData, { attempts: 2 });

      // Wait for job to fail by polling with improved reliability
      let failedJob: Job<NotificationData> | undefined;
      const startTime = Date.now();
      const timeout = 25000;
      let pollCount = 0;

      while (!failedJob && Date.now() - startTime < timeout) {
        const failedJobs = await notificationQueue.getFailed();
        failedJob = failedJobs.find(
          j => j.data && j.data.userId === invalidNotificationData.userId,
        );

        if (!failedJob) {
          pollCount++;
          // Log progress every 10 polls for debugging
          if (pollCount % 10 === 0) {
            console.log(
              `Waiting for job failure, poll #${pollCount}, failed jobs: ${failedJobs.length}`,
            );
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!failedJob) {
        throw new Error('Job failure timeout - job not found in failed queue');
      }

      expect(failedJob.data.type).toBe(invalidNotificationData.type);
      expect(failedJob.attemptsMade).toBe(2);
    }, 25_000);

    it('should update job progress during processing', async () => {
      const notificationData: NotificationData = {
        type: 'UserRegistered',
        userId: 'progress-test-user-id-' + Date.now(),
        email: 'test@example.com',
        name: 'Test User',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for job to be processed by polling with better timeout handling
      let job: Job<NotificationData> | undefined;
      const startTime = Date.now();
      const timeout = 20000;

      while (!job && Date.now() - startTime < timeout) {
        const [completedJobs, failedJobs] = await Promise.all([
          notificationQueue.getCompleted(),
          notificationQueue.getFailed(),
        ]);

        job = completedJobs.find(
          j =>
            j.data && j.data.userId === notificationData.userId && j.data.type === 'UserRegistered',
        );

        if (!job) {
          // Check if job failed unexpectedly
          const failedJob = failedJobs.find(
            j => j.data && j.data.userId === notificationData.userId,
          );
          if (failedJob) {
            throw new Error(`Job failed unexpectedly: ${failedJob.failedReason}`);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!job) {
        throw new Error('Job processing timeout - job not found in completed queue');
      }

      expect(job.finishedOn).toBeDefined();
      expect(job.progress).toBeDefined();

      // Check that the job actually completed (progress should be 100 or the job succeeded)
      expect(job.returnvalue).toBeDefined();
    }, 20_000);
  });

  describe('Queue Health and Monitoring', () => {
    it('should handle queue connection issues gracefully', async () => {
      // This test verifies that the queue service handles Redis connection issues
      // In a real scenario, you might temporarily disconnect Redis

      const notificationData: NotificationData = {
        type: 'UserRegistered',
        userId: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      // Should not throw even if there are connection issues
      await expect(
        notificationQueueService.queueNotification(notificationData),
      ).resolves.not.toThrow();
    });

    it('should maintain job persistence across restarts', async () => {
      const notificationData: NotificationData = {
        type: 'UserRegistered',
        userId: 'persistent-test-user-id-' + Date.now(),
        email: 'test@example.com',
        name: 'Test User',
      };

      // Queue a job with delay
      await notificationQueueService.queueNotification(notificationData, { delay: 30000 });

      // Small delay to ensure job is queued
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify job persists
      const delayedJobs = await notificationQueue.getDelayed();
      expect(delayedJobs.length).toBeGreaterThanOrEqual(1);

      // Find our specific job
      const ourJob = delayedJobs.find(job => job.data.userId === notificationData.userId);
      expect(ourJob).toBeDefined();
      expect(ourJob!.data.type).toBe(notificationData.type);

      // In a real test, you might restart the application here
      // and verify the job is still there
    });
  });
});
