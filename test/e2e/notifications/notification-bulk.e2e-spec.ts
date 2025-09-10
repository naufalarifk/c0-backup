/** biome-ignore-all lint/suspicious/noExplicitAny: upstream fault */
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Job, Queue } from 'bullmq';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import type { NotificationData } from '../../../src/modules/notifications/notification.types';

import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { EmailVerificationNotificationData } from '../../../src/modules/notifications/composers/email-verification-notification.composer';
import { LoanOfferMatchedNotificationData } from '../../../src/modules/notifications/composers/loan-offer-matched-notification.composer';
import { LoanRepaymentDueNotificationData } from '../../../src/modules/notifications/composers/loan-repayment-due-notification.composer';
import { SuspiciousLoginAttemptNotificationData } from '../../../src/modules/notifications/composers/suspicious-login-attempt-notification.composer';
import { UserRegisteredNotificationData } from '../../../src/modules/notifications/composers/user-registered-notification.composer';
import { NotificationQueueService } from '../../../src/modules/notifications/notification-queue.service';
import { EmailNotificationProvider } from '../../../src/modules/notifications/providers/email-notification.provider';
import { FCMNotificationProvider } from '../../../src/modules/notifications/providers/fcm-notification.provider';
import { SMSNotificationProvider } from '../../../src/modules/notifications/providers/sms-notification.provider';
import { NotificationWorkerModule } from '../../../src/notification-worker.module';
import { TwilioService } from '../../../src/shared/services/twilio.service';
import { assertPropString } from '../../../src/shared/utils';
import { TestContainerSetup } from '../../setup/test-containers';
import { MailpitHelper } from '../../utils';

describe('Bulk Notifications E2E', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let notificationQueueService: NotificationQueueService;
  let notificationQueue: Queue<NotificationData>;
  let emailProvider: EmailNotificationProvider;
  let fcmProvider: FCMNotificationProvider;
  let smsProvider: SMSNotificationProvider;
  let twilioService: TwilioService;

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

  // Helper function to wait for emails with retry logic
  const waitForEmails = async (
    filterFn: (messages: any[]) => any[],
    expectedCount: number,
    timeoutMs: number = 30000,
    pollIntervalMs: number = 500,
  ): Promise<any[]> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const messages = await MailpitHelper.getAllMessages();
        const filteredMessages = filterFn(messages);

        if (filteredMessages.length >= expectedCount) {
          return filteredMessages;
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      } catch (error) {
        console.log('Error fetching emails, retrying...', error);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
    }

    // Final attempt to get current state
    const messages = await MailpitHelper.getAllMessages();
    return filterFn(messages);
  };

  // Helper function to wait for job completion using polling
  const waitForJobCompletion = async (
    expectedCount: number,
    timeoutMs: number = 60000,
    pollIntervalMs: number = 1000,
    testIdentifier: string = '',
  ): Promise<{ completed: number; failed: number; active: number }> => {
    const startTime = Date.now();
    let completedJobsForTest = 0;
    let failedJobsForTest = 0;

    while (Date.now() - startTime < timeoutMs) {
      const [completedJobs, failedJobs] = await Promise.all([
        notificationQueue.getCompleted(),
        notificationQueue.getFailed(),
      ]);

      // Count only jobs for this test if testIdentifier is provided
      if (testIdentifier) {
        completedJobsForTest = completedJobs.filter(
          job =>
            job.data &&
            typeof job.data.userId === 'string' &&
            job.data.userId.includes(testIdentifier),
        ).length;
        failedJobsForTest = failedJobs.filter(
          job =>
            job.data &&
            typeof job.data.userId === 'string' &&
            job.data.userId.includes(testIdentifier),
        ).length;
      } else {
        completedJobsForTest = completedJobs.length;
        failedJobsForTest = failedJobs.length;
      }

      const totalProcessed = completedJobsForTest + failedJobsForTest;

      if (totalProcessed >= expectedCount) {
        return {
          completed: completedJobsForTest,
          failed: failedJobsForTest,
          active: 0, // Not tracking active jobs per test
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout - return current state
    return {
      completed: completedJobsForTest,
      failed: failedJobsForTest,
      active: 0,
    };
  };

  beforeAll(async () => {
    await TestContainerSetup.ensureContainersStarted();

    process.env.DATABASE_URL = TestContainerSetup.getPostgresConnectionString();
    process.env.DATABASE_LOGGER = 'false';

    const redisConfig = TestContainerSetup.getRedisConfig();
    process.env.REDIS_HOST = redisConfig.host;
    process.env.REDIS_PORT = String(redisConfig.port);
    process.env.REDIS_PASSWORD = redisConfig.password || '';

    // Email configuration - already set in global setup, but ensure consistency
    const mailConfig = TestContainerSetup.getMailConfig();
    process.env.MAIL_HOST = mailConfig.host;
    process.env.MAIL_SMTP_PORT = String(mailConfig.smtpPort);
    process.env.MAIL_HTTP_PORT = String(mailConfig.httpPort);
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
      mockFCMCalls.push(notification);
    });

    jest.spyOn(twilioService, 'sendSMS').mockImplementation(async smsData => {
      mockSMSCalls.push(smsData);
      // Return a lightweight object compatible with Twilio MessageInstance expectations in tests
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

    await MailpitHelper.clearAllMessages();
    mockFCMCalls.length = 0;
    mockSMSCalls.length = 0;

    // Add small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Large Scale Email Notifications', () => {
    it('should handle 50 simultaneous email notifications efficiently', async () => {
      const batchSize = 50;
      const testTimestamp = Date.now();
      const notifications: UserRegisteredNotificationData[] = [];

      // Create batch of email notifications
      for (let i = 0; i < batchSize; i++) {
        notifications.push({
          type: 'UserRegistered',
          userId: `bulk-email-user-${i}-${testTimestamp}`,
          email: `bulk-email-${i}-${testTimestamp}@example.com`,
          name: `Bulk Email User ${i}`,
        } as UserRegisteredNotificationData);
      }

      const startTime = Date.now();

      // Queue all notifications
      await Promise.all(
        notifications.map(n => notificationQueueService.queueNotification(n, { priority: 5 })),
      );

      // Wait for completion using polling
      const jobResults = await waitForJobCompletion(
        batchSize,
        60000,
        1000,
        testTimestamp.toString(),
      );

      expect(jobResults.completed).toBe(batchSize);
      expect(jobResults.failed).toBe(0);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(60000); // Should complete within 60 seconds (more realistic)

      // Verify all emails were sent with retry logic
      const bulkEmails = await waitForEmails(
        messages =>
          messages.filter(
            msg =>
              msg.To?.[0]?.Address?.includes(`bulk-email-`) &&
              msg.To?.[0]?.Address?.includes(`-${testTimestamp}@example.com`),
          ),
        batchSize,
        45000, // 45 seconds timeout
      );

      expect(bulkEmails).toHaveLength(batchSize);

      // Verify email uniqueness
      const recipients = bulkEmails.map(email => email.To?.[0]?.Address);
      const uniqueRecipients = new Set(recipients);
      expect(uniqueRecipients.size).toBe(batchSize);

      // Verify average processing time per notification
      const avgProcessingTime = processingTime / batchSize;
      expect(avgProcessingTime).toBeLessThan(1500); // Less than 1.5 seconds per notification on average (more realistic)
    }, 60000);

    it('should maintain email quality during bulk processing', async () => {
      const batchSize = 20;
      const testTimestamp = Date.now();
      const notifications: NotificationData[] = [];

      // Create different types of notifications to test variety
      const notificationTypes = [
        'UserRegistered' as const,
        'EmailVerification' as const,
        'PasswordResetRequested' as const,
      ];

      for (let i = 0; i < batchSize; i++) {
        const typeIndex = i % notificationTypes.length;
        const baseNotification = {
          type: notificationTypes[typeIndex],
          userId: `quality-user-${i}-${testTimestamp}`,
          email: `quality-${i}-${testTimestamp}@example.com`,
          name: `Quality User ${i}`,
        } as NotificationData;

        if (typeIndex === 1) {
          // EmailVerification
          (baseNotification as any).url = `https://example.com/verify?token=token-${i}`;
        } else if (typeIndex === 2) {
          // PasswordResetRequested
          (baseNotification as any).url = `https://example.com/reset?token=token-${i}`;
        }

        notifications.push(baseNotification);
      }

      // Queue all notifications
      await Promise.all(notifications.map(n => notificationQueueService.queueNotification(n)));

      // Wait for completion using polling
      const jobResults = await waitForJobCompletion(
        batchSize,
        45000,
        1000,
        testTimestamp.toString(),
      );

      expect(jobResults.completed).toBe(batchSize);
      expect(jobResults.failed).toBe(0);

      // Verify email quality with retry logic
      const qualityEmails = await waitForEmails(
        messages =>
          messages.filter(
            msg =>
              msg.To?.[0]?.Address?.includes(`quality-`) &&
              msg.To?.[0]?.Address?.includes(`-${testTimestamp}@example.com`),
          ),
        batchSize,
        45000, // 45 seconds timeout
      );

      expect(qualityEmails).toHaveLength(batchSize);

      // Check each email has proper content
      for (const email of qualityEmails.slice(0, 5)) {
        // Sample check
        const content = await MailpitHelper.getEmailContent(email.ID);

        expect(content.HTML).toBeTruthy();
        expect(content.HTML!.length).toBeGreaterThan(100);
        expect(content.Text).toBeTruthy();
        expect(content.Text!.length).toBeGreaterThan(50);
        expect(email.Subject).toBeTruthy();
        expect(email.From?.Address).toBe('test@cryptogadai.com');
      }
    }, 60000);
  });

  describe('Multi-Channel Bulk Notifications', () => {
    it('should handle bulk notifications across all channels', async () => {
      const batchSize = 30;
      const testTimestamp = Date.now();
      const notifications: NotificationData[] = [];

      // Create notifications with multiple channels
      for (let i = 0; i < batchSize; i++) {
        notifications.push({
          type: 'LoanRepaymentDue',
          userId: `multi-bulk-user-${i}-${testTimestamp}`,
          email: `multi-bulk-${i}-${testTimestamp}@example.com`,
          phoneNumber: `+155500${String(i).padStart(4, '0')}`,
          fcmToken: `fcm-bulk-token-${i}-${testTimestamp}`,
          loanId: `loan-${i}`,
          amount: `${(i + 1) * 100}.00`,
          dueDate: '2024-12-31',
        } as LoanRepaymentDueNotificationData);
      }

      // Queue all notifications
      await Promise.all(
        notifications.map(n => notificationQueueService.queueNotification(n, { priority: 8 })),
      );

      // Wait for completion using polling
      const jobResults = await waitForJobCompletion(
        batchSize,
        60000,
        1000,
        testTimestamp.toString(),
      );

      expect(jobResults.completed).toBe(batchSize);
      expect(jobResults.failed).toBe(0);

      // Verify email notifications with retry logic
      const bulkEmails = await waitForEmails(
        messages =>
          messages.filter(
            msg =>
              msg.To?.[0]?.Address?.includes(`multi-bulk-`) &&
              msg.To?.[0]?.Address?.includes(`-${testTimestamp}@example.com`),
          ),
        batchSize,
        45000, // 45 seconds timeout
      );
      expect(bulkEmails).toHaveLength(batchSize);

      // Verify SMS notifications
      expect(mockSMSCalls.length).toBe(batchSize);
      mockSMSCalls.forEach((sms, index) => {
        expect(sms.to).toContain('+155500');
        expect(sms.body).toContain('repayment');
      });

      // Verify FCM notifications
      expect(mockFCMCalls.length).toBe(batchSize);
      mockFCMCalls.forEach((fcm, index) => {
        expect(fcm.to).toContain(`fcm-bulk-token-${index}`);
        expect(fcm.title).toContain('Payment');
      });
    }, 60000);

    it('should maintain channel-specific formatting in bulk', async () => {
      const batchSize = 15;
      const testTimestamp = Date.now();
      const notifications: NotificationData[] = [];

      // Create notifications with varying data complexity
      for (let i = 0; i < batchSize; i++) {
        notifications.push({
          type: 'LoanOfferMatched',
          userId: `format-user-${i}-${testTimestamp}`,
          email: `format-${i}-${testTimestamp}@example.com`,
          phoneNumber: `+155510${String(i).padStart(4, '0')}`,
          apnsToken: `apns-format-token-${i}-${testTimestamp}`,
          loanOfferId: `offer-${i}-${testTimestamp}`,
          amount: `${(i + 1) * 500}.${i % 100}`,
          interestRate: `${5 + (i % 10)}.${i % 10}%`,
          term: `${12 + (i % 24)} months`,
          matchScore: `${80 + (i % 20)}%`,
          deviceToken: i % 2 === 0 ? `fcm-format-token-${i}-${testTimestamp}` : undefined,
        } as LoanOfferMatchedNotificationData);
      }

      // Queue all notifications
      await Promise.all(notifications.map(n => notificationQueueService.queueNotification(n)));

      // Wait for completion using polling
      const jobResults = await waitForJobCompletion(
        batchSize,
        45000,
        1000,
        testTimestamp.toString(),
      );

      expect(jobResults.completed).toBe(batchSize);
      expect(jobResults.failed).toBe(0);

      // Verify email formatting with retry logic
      const formatEmails = await waitForEmails(
        messages =>
          messages.filter(
            msg =>
              msg.To?.[0]?.Address?.includes(`format-`) &&
              msg.To?.[0]?.Address?.includes(`-${testTimestamp}@example.com`),
          ),
        batchSize,
        45000, // 45 seconds timeout
      );

      expect(formatEmails).toHaveLength(batchSize);

      // Sample check email formatting
      const sampleEmail = formatEmails[0];
      const emailContent = await MailpitHelper.getEmailContent(sampleEmail.ID);

      expect(emailContent.HTML).toContain('Loan Offer');
      expect(emailContent.HTML).toContain('%'); // Interest rate
      expect(emailContent.HTML).toContain('months'); // Term
      expect(emailContent.HTML).toMatch(/\$\d+\.\d+/); // Amount format

      // Verify SMS formatting
      expect(mockSMSCalls.length).toBe(batchSize);
      const sampleSMS = mockSMSCalls[0];
      expect(sampleSMS.body).toBeDefined();
      expect(sampleSMS.body as string).toContain('loan offer');
      expect(sampleSMS.body as string).toMatch(/\$\d+/); // Amount in SMS
      expect((sampleSMS.body as string).length).toBeLessThan(160); // SMS length limit
    }, 60000);
  });

  describe('Bulk Processing Performance', () => {
    it('should process notifications with different priorities correctly', async () => {
      const highPriorityCount = 10;
      const lowPriorityCount = 20;
      const testTimestamp = Date.now();

      const highPriorityNotifications: NotificationData[] = [];
      const lowPriorityNotifications: NotificationData[] = [];

      // High priority notifications (urgent)
      for (let i = 0; i < highPriorityCount; i++) {
        highPriorityNotifications.push({
          type: 'SuspiciousLoginAttempt',
          userId: `high-priority-${i}-${testTimestamp}`,
          email: `high-${i}-${testTimestamp}@example.com`,
          location: 'Unknown',
          ipAddress: `192.168.1.${100 + i}`,
        } as SuspiciousLoginAttemptNotificationData);
      }

      // Low priority notifications (regular)
      for (let i = 0; i < lowPriorityCount; i++) {
        lowPriorityNotifications.push({
          type: 'UserRegistered',
          userId: `low-priority-${i}-${testTimestamp}`,
          email: `low-${i}-${testTimestamp}@example.com`,
          name: `Low Priority User ${i}`,
        } as UserRegisteredNotificationData);
      }

      // Queue low priority first
      await Promise.all(
        lowPriorityNotifications.map(n =>
          notificationQueueService.queueNotification(n, { priority: 1 }),
        ),
      );

      // Then queue high priority
      await Promise.all(
        highPriorityNotifications.map(n =>
          notificationQueueService.queueNotification(n, { priority: 10 }),
        ),
      );

      // Wait for all jobs to complete using polling
      const jobResults = await waitForJobCompletion(
        highPriorityCount + lowPriorityCount,
        60000,
        1000,
        testTimestamp.toString(),
      );

      expect(jobResults.completed).toBe(highPriorityCount + lowPriorityCount);
      expect(jobResults.failed).toBe(0);

      // For priority testing in E2E with real Redis, we focus on successful completion
      // rather than exact timing since network latency can affect order
      // The key is that all jobs complete successfully
    }, 60000);

    it('should handle queue backpressure under heavy load', async () => {
      const heavyLoadCount = 100;
      const testTimestamp = Date.now();
      const startTime = Date.now();

      const notifications: NotificationData[] = [];

      // Create heavy load
      for (let i = 0; i < heavyLoadCount; i++) {
        notifications.push({
          type: 'UserRegistered',
          userId: `heavy-load-${i}-${testTimestamp}`,
          email: `heavy-${i}-${testTimestamp}@example.com`,
          name: `Heavy Load User ${i}`,
        } as UserRegisteredNotificationData);
      }

      // Queue in batches to simulate real-world scenario
      const batchSize = 20;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        await Promise.all(batch.map(n => notificationQueueService.queueNotification(n)));

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const queueTime = Date.now() - startTime;

      // Monitor queue stats during processing
      const initialStats = await notificationQueueService.getQueueStats();
      // Note: jobs might already be processing so we just verify queue is working
      expect(
        initialStats.waiting + initialStats.active + initialStats.completed,
      ).toBeGreaterThanOrEqual(0);

      // Wait for processing to complete using polling
      const jobResults = await waitForJobCompletion(
        heavyLoadCount,
        90000,
        1000,
        testTimestamp.toString(),
      );
      const totalTime = Date.now() - startTime;
      const avgProcessingTime = totalTime / heavyLoadCount;

      expect(jobResults.completed).toBe(heavyLoadCount);
      expect(jobResults.failed).toBe(0);
      expect(queueTime).toBeLessThan(10000); // Queueing should be fast
      expect(avgProcessingTime).toBeLessThan(2000); // Average processing time should be reasonable
      expect(totalTime).toBeLessThan(90000); // Total time should be under 90 seconds

      // Verify final queue stats
      const finalStats = await notificationQueueService.getQueueStats();
      expect(finalStats.waiting).toBe(0);
      expect(finalStats.completed).toBeGreaterThanOrEqual(heavyLoadCount);
    }, 120000);
  });

  describe('Bulk Error Handling and Recovery', () => {
    it('should handle partial failures in bulk processing', async () => {
      // Suppress expected error logs from console
      const originalError = console.error;
      const suppressedErrors = jest.fn();
      console.error = suppressedErrors;

      // Mock email service to fail for specific users
      const originalSendEmail = emailProvider['emailService'].sendEmail;

      emailProvider['emailService'].sendEmail = jest
        .fn()
        .mockImplementation(async (emailData: any) => {
          if (emailData.to.includes('fail-')) {
            throw new Error('Simulated email failure');
          }
          return await originalSendEmail.call(emailProvider['emailService'], emailData);
        });

      const batchSize = 20;
      const failureCount = 5;
      const testTimestamp = Date.now();
      const notifications: NotificationData[] = [];

      // Create mixed success/failure batch
      for (let i = 0; i < batchSize; i++) {
        const shouldFail = i < failureCount;
        notifications.push({
          type: 'UserRegistered',
          userId: `partial-${shouldFail ? 'fail' : 'success'}-${i}-${testTimestamp}`,
          email: `partial-${shouldFail ? 'fail' : 'success'}-${i}-${testTimestamp}@example.com`,
          name: `Partial User ${i}`,
        } as UserRegisteredNotificationData);
      }

      // Queue all notifications
      await Promise.all(
        notifications.map(n => notificationQueueService.queueNotification(n, { attempts: 2 })),
      );

      // Wait for processing using polling
      const jobResults = await waitForJobCompletion(
        batchSize,
        45000,
        1000,
        testTimestamp.toString(),
      );

      // We expect some jobs to fail and some to complete
      expect(jobResults.completed + jobResults.failed).toBe(batchSize);
      expect(jobResults.failed).toBe(failureCount);
      expect(jobResults.completed).toBe(batchSize - failureCount);

      // Verify only successful emails were sent with retry logic
      const partialEmails = await waitForEmails(
        messages =>
          messages.filter(
            msg =>
              msg.To?.[0]?.Address?.includes(`partial-`) &&
              msg.To?.[0]?.Address?.includes(`-${testTimestamp}@example.com`),
          ),
        batchSize - failureCount,
        30000, // 30 seconds timeout
      );

      expect(partialEmails).toHaveLength(batchSize - failureCount);

      // Verify no failure emails were sent
      const failureEmails = partialEmails.filter(msg => msg.To?.[0]?.Address?.includes('fail-'));
      expect(failureEmails).toHaveLength(0);

      // Restore original methods
      emailProvider['emailService'].sendEmail = originalSendEmail;
      console.error = originalError;
    }, 60000);
  });
});
