/** biome-ignore-all lint/suspicious/noExplicitAny: upstream fault */

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Job, Queue } from 'bullmq';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import type { NotificationData } from '../../../src/modules/notifications/notification.types';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { SuspiciousLoginAttemptNotificationData } from '../../../src/modules/notifications/composers/suspicious-login-attempt-notification.composer';
import { UserRegisteredNotificationData } from '../../../src/modules/notifications/composers/user-registered-notification.composer';
import { NotificationProcessor } from '../../../src/modules/notifications/notification.processor';
import { NotificationService } from '../../../src/modules/notifications/notification.service';
import { NotificationQueueService } from '../../../src/modules/notifications/notification-queue.service';
import { EmailNotificationProvider } from '../../../src/modules/notifications/providers/email-notification.provider';
import { FCMNotificationProvider } from '../../../src/modules/notifications/providers/fcm-notification.provider';
import { SMSNotificationProvider } from '../../../src/modules/notifications/providers/sms-notification.provider';
import { NotificationWorkerModule } from '../../../src/notification-worker.module';
import { TwilioService } from '../../../src/shared/services/twilio.service';
import { assertPropString } from '../../../src/shared/utils';
import MailContainer from '../../setup/mail-container';
import { TestContainerSetup } from '../../setup/test-containers';
import { MailpitHelper } from '../../utils';

describe('Notification Flow E2E', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let notificationQueueService: NotificationQueueService;
  let notificationService: NotificationService;
  let notificationProcessor: NotificationProcessor;
  let notificationQueue: Queue<NotificationData>;
  let emailProvider: EmailNotificationProvider;
  let fcmProvider: FCMNotificationProvider;
  let smsProvider: SMSNotificationProvider;
  let twilioService: TwilioService;
  let mailContainer: MailContainer;

  // Mock tracking
  interface MockFCM {
    to?: string;
    title?: string;
    body?: string;
  }
  interface MockSMS {
    to?: string;
    body?: string;
  }

  const mockFCMCalls: MockFCM[] = [];
  const mockSMSCalls: MockSMS[] = [];

  // Helper function to wait for job completion using polling
  const waitForJobCompletion = async (
    userId: string,
    timeoutMs: number = 20000,
    pollIntervalMs: number = 500,
  ): Promise<Job<NotificationData>> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Check completed jobs first
      const completedJobs = await notificationQueue.getCompleted();
      const completedJob = completedJobs.find(job => job.data && job.data.userId === userId);
      if (completedJob) {
        return completedJob as Job<NotificationData>;
      }

      // Check failed jobs
      const failedJobs = await notificationQueue.getFailed();
      const failedJob = failedJobs.find(job => job.data && job.data.userId === userId);
      if (failedJob) {
        throw new Error(`Job failed: ${failedJob.failedReason}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Job processing timeout after ${timeoutMs}ms`);
  };

  // Helper function to wait for specific job result (completed or failed)
  const waitForJobResult = async (
    userId: string,
    timeoutMs: number = 15000,
    pollIntervalMs: number = 500,
  ): Promise<'completed' | 'failed'> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Check completed jobs
      const completedJobs = await notificationQueue.getCompleted();
      if (completedJobs.some(job => job.data && job.data.userId === userId)) {
        return 'completed';
      }

      // Check failed jobs
      const failedJobs = await notificationQueue.getFailed();
      if (failedJobs.some(job => job.data && job.data.userId === userId)) {
        return 'failed';
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return 'timeout' as any;
  };

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
    notificationService = moduleFixture.get<NotificationService>(NotificationService);
    notificationProcessor = moduleFixture.get<NotificationProcessor>(NotificationProcessor);
    notificationQueue = moduleFixture.get<Queue<NotificationData>>(
      getQueueToken('notificationQueue'),
    );
    emailProvider = moduleFixture.get<EmailNotificationProvider>(EmailNotificationProvider);
    fcmProvider = moduleFixture.get<FCMNotificationProvider>(FCMNotificationProvider);
    smsProvider = moduleFixture.get<SMSNotificationProvider>(SMSNotificationProvider);
    twilioService = moduleFixture.get<TwilioService>(TwilioService);

    // Mock non-email providers
    jest.spyOn(fcmProvider, 'send').mockImplementation(async notification => {
      mockFCMCalls.push(notification);
    });

    jest.spyOn(twilioService, 'sendSMS').mockImplementation(async smsData => {
      mockSMSCalls.push(smsData);
      return { sid: 'mock_sms_sid', status: 'sent' } as unknown as MessageInstance;
    });

    await app.init();
  }, 60_000);

  beforeEach(async () => {
    // Clear queue and mocks before each test
    await notificationQueue.drain();
    await (
      notificationQueue as unknown as { clean: (grace: number, type?: string) => Promise<unknown> }
    ).clean(0, 'completed');
    await (
      notificationQueue as unknown as { clean: (grace: number, type?: string) => Promise<unknown> }
    ).clean(0, 'failed');
    await (
      notificationQueue as unknown as { clean: (grace: number, type?: string) => Promise<unknown> }
    ).clean(0, 'active');
    await (
      notificationQueue as unknown as { clean: (grace: number, type?: string) => Promise<unknown> }
    ).clean(0, 'waiting');
    await (
      notificationQueue as unknown as { clean: (grace: number, type?: string) => Promise<unknown> }
    ).clean(0, 'delayed');

    // Clear mail messages
    await MailpitHelper.clearAllMessages();

    // Reset mock arrays
    mockFCMCalls.length = 0;
    mockSMSCalls.length = 0;

    // Add a small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await mailContainer.stop();
    if (app) {
      await app.close();
    }
  });

  describe('Complete User Registration Flow', () => {
    it('should process complete user registration notification flow', async () => {
      const testTimestamp = Date.now();
      const testUserId = 'flow-user-' + String(testTimestamp);
      const testEmail = `flow-${testTimestamp}@example.com`;
      const testName = 'Flow Test User';

      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: testUserId,
        email: testEmail,
        name: testName,
      };

      // 1. Queue the notification
      await notificationQueueService.queueNotification(notificationData);

      // Wait a moment for the job to be queued
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Verify job was queued
      // Check for jobs in any state (waiting, active, completed, failed)
      const [waitingJobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
        notificationQueue.getWaiting(),
        notificationQueue.getActive(),
        notificationQueue.getCompleted(),
        notificationQueue.getFailed(),
      ]);

      const totalJobs =
        waitingJobs.length + activeJobs.length + completedJobs.length + failedJobs.length;
      console.log(
        `Found ${totalJobs} total jobs: ${waitingJobs.length} waiting, ${activeJobs.length} active, ${completedJobs.length} completed, ${failedJobs.length} failed`,
      );
      expect(totalJobs).toBeGreaterThan(0);

      // Find the job in any state
      const allJobs = [...waitingJobs, ...activeJobs, ...completedJobs, ...failedJobs];
      const matchingJob = allJobs.find(
        job =>
          job.data.type === 'UserRegistered' &&
          (job.data as UserRegisteredNotificationData).userId === testUserId,
      );
      expect(matchingJob).toBeDefined();

      // 3. Wait for processing
      const processedJob = await waitForJobCompletion(testUserId, 20000);

      // 4. Verify job completed successfully
      expect(processedJob.finishedOn).toBeDefined();
      expect(processedJob.returnvalue).toBeDefined();

      // 5. Wait for email delivery
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 6. Verify email was sent
      const messages = await MailpitHelper.getAllMessages();
      const welcomeEmail = messages.find(
        msg =>
          msg.To?.[0]?.Address === testEmail && msg.Subject?.includes('Welcome to CryptoGadai'),
      );

      expect(welcomeEmail).toBeDefined();
      expect(welcomeEmail?.Subject).toBe('Welcome to CryptoGadai - Account Created Successfully');

      // 7. Verify email content
      const emailContent = await MailpitHelper.getEmailContent(welcomeEmail!.ID);
      expect(emailContent.HTML).toContain(testName);
      expect(emailContent.HTML).toContain('Welcome to CryptoGadai');
      expect(emailContent.Text).toContain(testName);
    }, 20000);
  });

  describe('Multi-Channel Notification Flow', () => {
    it('should send notifications across multiple channels simultaneously', async () => {
      const testTimestamp = Date.now();
      const testUserId = 'multi-user-' + String(testTimestamp);
      const testEmail = `multi-${testTimestamp}@example.com`;
      const testPhone = '+1555' + testTimestamp.toString().slice(-6);
      const testFCMToken = 'fcm-token-' + testTimestamp;

      const notificationData: SuspiciousLoginAttemptNotificationData = {
        type: 'SuspiciousLoginAttempt',
        userId: testUserId,
        email: testEmail,
        phoneNumber: testPhone,
        fcmToken: testFCMToken,
        location: 'Unknown Location',
        ipAddress: '192.168.1.100',
        timestamp: new Date().toISOString(),
      };

      // Queue the notification
      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      const processedJob = await waitForJobCompletion(testUserId, 20000);

      expect(processedJob.finishedOn).toBeDefined();

      // Wait for all providers to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify email notification
      const messages = await MailpitHelper.getAllMessages();
      const securityEmail = messages.find(
        msg => msg.To?.[0]?.Address === testEmail && msg.Subject?.includes('Security'),
      );
      expect(securityEmail).toBeDefined();

      // Verify SMS notification
      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: testPhone,
        body: expect.stringContaining('Security Alert'),
      });

      // Verify FCM notification
      expect(mockFCMCalls).toHaveLength(1);
      expect(mockFCMCalls[0]).toMatchObject({
        to: testFCMToken,
        title: expect.stringContaining('Security'),
        body: expect.stringContaining('Suspicious'),
      });
    }, 20000);
  });

  describe('Error Recovery and Retry Flow', () => {
    it('should retry failed notifications according to configuration', async () => {
      // Mock email service to fail initially
      const originalSendEmail = emailProvider['emailService'].sendEmail;
      let attemptCount = 0;

      emailProvider['emailService'].sendEmail = jest
        .fn()
        .mockImplementation(async (emailData: any) => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('Temporary email service failure');
          }
          // Call the original method with proper context
          return await originalSendEmail.call(emailProvider['emailService'], emailData);
        });

      const testTimestamp = Date.now();
      const testUserId = 'retry-user-' + String(testTimestamp);
      const testEmail = `retry-${testTimestamp}@example.com`;

      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: testUserId,
        email: testEmail,
        name: 'Retry Test User',
      };

      // Queue with custom retry settings
      await notificationQueueService.queueNotification(notificationData, {
        attempts: 3,
        backoff: { type: 'fixed', delay: 1000 },
      });

      // Wait for retries and eventual success
      const processedJob = await waitForJobCompletion(testUserId, 25000);

      expect(processedJob.finishedOn).toBeDefined();
      expect(attemptCount).toBeGreaterThan(1); // Should have retried

      // Wait for email delivery
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify email was eventually sent
      const messages = await MailpitHelper.getAllMessages();
      const retryEmail = messages.find(msg => msg.To?.[0]?.Address === testEmail);
      expect(retryEmail).toBeDefined();

      // Restore original method
      emailProvider['emailService'].sendEmail = originalSendEmail;
    }, 25000);

    it('should handle partial failures in multi-channel notifications', async () => {
      // Store original method for restoration
      const originalSendSMS = twilioService.sendSMS;

      // Mock SMS to fail but email to succeed
      jest.spyOn(twilioService, 'sendSMS').mockRejectedValue(new Error('SMS service unavailable'));

      const testTimestamp = Date.now();
      const testUserId = 'partial-user-' + String(testTimestamp);
      const testEmail = `partial-${testTimestamp}@example.com`;
      const testPhone = '+1555' + testTimestamp.toString().slice(-6);

      // Use SuspiciousLoginAttempt which actually sends both email and SMS
      const notificationData: SuspiciousLoginAttemptNotificationData = {
        type: 'SuspiciousLoginAttempt',
        userId: testUserId,
        email: testEmail,
        phoneNumber: testPhone,
        location: 'Test Location',
        ipAddress: '192.168.1.100',
        timestamp: new Date().toISOString(),
      };

      // Queue the notification
      await notificationQueueService.queueNotification(notificationData);

      // Job should fail due to SMS failure
      const result = await waitForJobResult(testUserId, 15000);

      expect(result).toBe('failed'); // Job should fail due to SMS error

      // But email might still have been sent before the failure
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify SMS was attempted
      expect(twilioService.sendSMS).toHaveBeenCalled();

      // Restore original SMS method
      twilioService.sendSMS = originalSendSMS;
    }, 15000);
  });

  describe('Composer and Provider Integration Flow', () => {
    it('should correctly route notifications through composer factory', async () => {
      const testTimestamp = Date.now();
      const testUserId = 'composer-user-' + String(testTimestamp);

      // Test different notification types to verify composer routing
      const notificationTypes = [
        {
          type: 'UserRegistered' as const,
          userId: testUserId + '-reg',
          email: `reg-${testTimestamp}@example.com`,
          name: 'Registration User',
        },
        {
          type: 'EmailVerification' as const,
          userId: testUserId + '-verify',
          email: `verify-${testTimestamp}@example.com`,
          url: `https://example.com/verify?token=verify-token-123`,
          name: 'Test User Verify',
        },
        {
          type: 'PasswordResetRequested' as const,
          userId: testUserId + '-reset',
          email: `reset-${testTimestamp}@example.com`,
          url: `https://example.com/reset?token=reset-token-456`,
          name: 'Test User Reset',
        },
      ];

      // Queue all notifications
      for (const notificationData of notificationTypes) {
        await notificationQueueService.queueNotification(notificationData);
      }

      // Wait for all to process
      const completedJobs: Job<NotificationData>[] = [];

      // Wait for all jobs to complete using polling
      const startTime = Date.now();
      const timeout = 20000;

      while (completedJobs.length < notificationTypes.length && Date.now() - startTime < timeout) {
        const currentCompleted = await notificationQueue.getCompleted();
        const newJobs = currentCompleted.filter(
          job =>
            job.data &&
            typeof job.data.userId === 'string' &&
            job.data.userId.startsWith(testUserId) &&
            !completedJobs.some(existingJob => existingJob.id === job.id),
        ) as Job<NotificationData>[];

        completedJobs.push(...newJobs);

        if (completedJobs.length < notificationTypes.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (completedJobs.length < notificationTypes.length) {
        throw new Error('Composer flow timeout - not all jobs completed');
      }

      expect(completedJobs).toHaveLength(notificationTypes.length);

      // Wait for email delivery
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all emails were sent with correct content
      const messages = await MailpitHelper.getAllMessages();
      expect(messages.length).toBeGreaterThanOrEqual(notificationTypes.length);

      const registrationEmail = messages.find(msg => msg.Subject?.includes('Welcome'));
      const verificationEmail = messages.find(msg => msg.Subject?.includes('Verify'));
      const resetEmail = messages.find(msg => msg.Subject?.includes('Reset'));

      expect(registrationEmail).toBeDefined();
      expect(verificationEmail).toBeDefined();
      expect(resetEmail).toBeDefined();
    }, 25000);

    it('should handle invalid notification types gracefully', async () => {
      const invalidNotificationData = {
        type: 'InvalidNotificationType',
        userId: 'invalid-user-' + Date.now(),
        email: `invalid-${Date.now()}@example.com`,
      } as unknown as NotificationData;

      // Queue invalid notification
      await notificationQueueService.queueNotification(invalidNotificationData);

      // Should fail gracefully
      assertPropString(invalidNotificationData, 'userId');
      const result = await waitForJobResult(invalidNotificationData.userId, 10000);

      expect(result).toBe('failed');
    }, 15000);
  });

  describe('Queue Performance and Load Flow', () => {
    it('should handle concurrent notification processing', async () => {
      const concurrentCount = 10;
      const testTimestamp = Date.now();
      const notifications: NotificationData[] = [];

      // Create multiple notifications
      for (let i = 0; i < concurrentCount; i++) {
        notifications.push({
          type: 'UserRegistered',
          userId: `concurrent-user-${i}-${testTimestamp}`,
          email: `concurrent-${i}-${testTimestamp}@example.com`,
          name: `Concurrent User ${i}`,
        });
      }

      // Queue all notifications simultaneously
      await Promise.all(notifications.map(n => notificationQueueService.queueNotification(n)));

      // Wait for all to process
      const completedJobs: Job<NotificationData>[] = [];

      // Wait for all concurrent jobs to complete using polling
      const startTime = Date.now();
      const timeout = 25000;

      while (completedJobs.length < concurrentCount && Date.now() - startTime < timeout) {
        const currentCompleted = await notificationQueue.getCompleted();
        const newJobs = currentCompleted.filter(
          job =>
            job.data &&
            typeof job.data.userId === 'string' &&
            job.data.userId.includes(`${testTimestamp}`) &&
            !completedJobs.some(existingJob => existingJob.id === job.id),
        ) as Job<NotificationData>[];

        completedJobs.push(...newJobs);

        if (completedJobs.length < concurrentCount) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (completedJobs.length < concurrentCount) {
        throw new Error('Concurrent processing timeout - not all jobs completed');
      }

      expect(completedJobs).toHaveLength(concurrentCount);

      // Wait for all emails
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify all emails were sent
      const messages = await MailpitHelper.getAllMessages();
      const concurrentEmails = messages.filter(msg =>
        msg.To?.[0]?.Address?.includes(`${testTimestamp}@example.com`),
      );

      expect(concurrentEmails).toHaveLength(concurrentCount);

      // Verify each email is unique
      const recipients = concurrentEmails.map(email => email.To?.[0]?.Address);
      const uniqueRecipients = new Set(recipients);
      expect(uniqueRecipients.size).toBe(concurrentCount);
    }, 30000);
  });
});
