import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { NotificationData } from '../../../src/modules/notifications/notification.types';

import { Test } from '@nestjs/testing';

import { NotificationQueueService } from '../../../src/modules/notifications/notification-queue.service';
import { APNSNotificationProvider } from '../../../src/modules/notifications/providers/apns-notification.provider';
import { FCMNotificationProvider } from '../../../src/modules/notifications/providers/fcm-notification.provider';
import { NotificationWorkerModule } from '../../../src/notification-worker.module';
import { TestContainerSetup } from '../../setup/test-containers';

describe('Push Notifications E2E', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let notificationQueueService: NotificationQueueService;
  let fcmProvider: FCMNotificationProvider;
  let apnsProvider: APNSNotificationProvider;

  // Mock tracking for push notification calls
  const mockFCMCalls: Array<{
    to: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }> = [];
  const mockAPNSCalls: Array<{
    to: string;
    title: string;
    body: string;
    badge?: number;
    sound?: string;
  }> = [];

  beforeAll(async () => {
    await TestContainerSetup.ensureContainersStarted();

    process.env.DATABASE_URL = TestContainerSetup.getPostgresConnectionString();
    process.env.DATABASE_LOGGER = 'false';

    const redisConfig = TestContainerSetup.getRedisConfig();
    process.env.REDIS_HOST = redisConfig.host;
    process.env.REDIS_PORT = String(redisConfig.port);
    process.env.REDIS_PASSWORD = redisConfig.password || '';

    moduleFixture = await Test.createTestingModule({
      imports: [NotificationWorkerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    notificationQueueService =
      moduleFixture.get<NotificationQueueService>(NotificationQueueService);
    fcmProvider = moduleFixture.get<FCMNotificationProvider>(FCMNotificationProvider);
    apnsProvider = moduleFixture.get<APNSNotificationProvider>(APNSNotificationProvider);

    // Mock the send methods to track calls instead of actually sending
    jest.spyOn(fcmProvider, 'send').mockImplementation(async notification => {
      mockFCMCalls.push({
        to: notification.to,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });
    });

    jest.spyOn(apnsProvider, 'send').mockImplementation(async notification => {
      mockAPNSCalls.push({
        to: notification.to,
        title: notification.title,
        body: notification.body,
        badge: notification.badge,
        sound: notification.sound,
      });
    });

    await app.init();
  }, 60_000);

  beforeEach(async () => {
    mockFCMCalls.length = 0;
    mockAPNSCalls.length = 0;

    // Ensure clean state by clearing any pending jobs
    try {
      const notificationQueue = moduleFixture.get('BullQueue_notificationQueue');
      if (notificationQueue) {
        await notificationQueue.drain();
        await notificationQueue.clean(0, 'completed');
        await notificationQueue.clean(0, 'failed');
      }
    } catch (error) {
      // Queue might not be available in all tests, ignore error
    }
  });

  afterAll(async () => {
    // Restore original methods if they were mocked
    if (fcmProvider && jest.isMockFunction(fcmProvider.send)) {
      (fcmProvider.send as jest.Mock).mockRestore();
    }
    if (apnsProvider && jest.isMockFunction(apnsProvider.send)) {
      (apnsProvider.send as jest.Mock).mockRestore();
    }

    if (app) {
      await app.close();
    }
  });

  describe('FCM Push Notifications', () => {
    it('should send FCM notification for login security alert', async () => {
      const deviceToken = 'fcm-device-token-123';
      const testUserId = 'test-user-fcm-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoginFromNewDevice',
        userId: testUserId,
        deviceToken,
        deviceInfo: 'Chrome on Windows 10',
        location: 'New York, NY',
        timestamp: new Date().toISOString(),
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockFCMCalls).toHaveLength(1);
      expect(mockFCMCalls[0]).toMatchObject({
        to: deviceToken,
        title: expect.stringContaining('Security Alert'),
        body: expect.stringContaining('New login detected'),
      });
      expect(mockFCMCalls[0].data).toBeDefined();
    });

    it('should send FCM notification with custom data payload', async () => {
      const deviceToken = 'fcm-device-token-custom-' + Date.now();
      const testUserId = 'test-user-fcm-custom-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanRepaymentDue',
        userId: testUserId,
        deviceToken,
        loanId: 'loan-123',
        amount: '1000.00',
        dueDate: '2024-12-31',
        currency: 'USD',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockFCMCalls).toHaveLength(1);
      expect(mockFCMCalls[0]).toMatchObject({
        to: deviceToken,
        title: expect.stringContaining('Payment Due'),
        body: expect.stringContaining('1000.00'),
      });
      expect(mockFCMCalls[0].data).toMatchObject({
        loanId: 'loan-123',
        amount: '1000.00',
        type: 'LoanRepaymentDue',
      });
    });

    it('should handle FCM notification with click action', async () => {
      const deviceToken = 'fcm-device-token-action-' + Date.now();
      const testUserId = 'test-user-fcm-action-' + Date.now();

      const notificationData: NotificationData = {
        type: 'InvoiceCreated',
        userId: testUserId,
        deviceToken,
        invoiceId: 'inv-123',
        amount: '500.00',
        clickAction: '/invoices/inv-123',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockFCMCalls).toHaveLength(1);
      expect(mockFCMCalls[0]).toMatchObject({
        to: deviceToken,
        title: expect.stringContaining('Invoice'),
        body: expect.stringContaining('500.00'),
      });
    });

    it('should validate FCM payload structure', async () => {
      const deviceToken = 'fcm-device-token-validation';

      // Test that FCM provider correctly identifies FCM payloads
      expect(
        fcmProvider.isSendablePayload({
          channel: 'FCM',
          to: deviceToken,
          title: 'Test',
          body: 'Test Body',
        }),
      ).toBe(true);

      // Test that FCM provider rejects non-FCM payloads
      expect(
        fcmProvider.isSendablePayload({
          channel: 'Email',
          to: 'test@example.com',
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          textBody: 'Test',
        }),
      ).toBe(false);
    });
  });

  describe('APNS Push Notifications', () => {
    it('should send APNS notification for iOS devices', async () => {
      const deviceToken = 'apns-device-token-123';
      const testUserId = 'test-user-apns-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanOfferMatched',
        userId: testUserId,
        deviceToken,
        loanOfferId: 'offer-123',
        amount: '2000.00',
        interestRate: '5.5%',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockAPNSCalls).toHaveLength(1);
      expect(mockAPNSCalls[0]).toMatchObject({
        to: deviceToken,
        title: expect.stringContaining('Loan Offer'),
        body: expect.stringContaining('2000.00'),
      });
    });

    it('should send APNS notification with badge count', async () => {
      const deviceToken = 'apns-device-token-badge-' + Date.now();
      const testUserId = 'test-user-apns-badge-' + Date.now();

      const notificationData: NotificationData = {
        type: 'UserKycVerified',
        userId: testUserId,
        apnsToken: deviceToken,
        badgeCount: 3,
        verificationLevel: 'Level 2',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockAPNSCalls).toHaveLength(1);
      expect(mockAPNSCalls[0]).toMatchObject({
        to: deviceToken,
        title: expect.stringContaining('KYC Verified'),
        body: expect.stringContaining('Level 2'),
        badge: 3,
      });
    });

    it('should send APNS notification with custom sound', async () => {
      const deviceToken = 'apns-device-token-sound-' + Date.now();
      const testUserId = 'test-user-apns-sound-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanLiquidation',
        userId: testUserId,
        apnsToken: deviceToken,
        loanId: 'loan-urgent-123',
        sound: 'urgent_alert.caf',
        liquidationAmount: '1500.00',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockAPNSCalls).toHaveLength(1);
      expect(mockAPNSCalls[0]).toMatchObject({
        to: deviceToken,
        title: expect.stringContaining('Liquidation'),
        body: expect.stringContaining('1500.00'),
        sound: 'urgent_alert.caf',
      });
    });

    it('should validate APNS payload structure', async () => {
      const deviceToken = 'apns-device-token-validation';

      // Test that APNS provider correctly identifies APNS payloads
      expect(
        apnsProvider.isSendablePayload({
          channel: 'APN',
          to: deviceToken,
          title: 'Test',
          body: 'Test Body',
        }),
      ).toBe(true);

      // Test that APNS provider rejects non-APNS payloads
      expect(
        apnsProvider.isSendablePayload({
          channel: 'SMS',
          to: '+1234567890',
          message: 'Test SMS',
        }),
      ).toBe(false);
    });
  });

  describe('Multi-Platform Push Notifications', () => {
    it('should send notifications to both FCM and APNS simultaneously', async () => {
      const fcmToken = 'fcm-multi-token-' + Date.now();
      const apnsToken = 'apns-multi-token-' + Date.now();
      const testUserId = 'test-user-multi-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanLtvBreach',
        userId: testUserId,
        fcmToken,
        apnsToken,
        loanId: 'loan-breach-123',
        currentLtv: '85%',
        thresholdLtv: '80%',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have sent to both platforms
      expect(mockFCMCalls).toHaveLength(1);
      expect(mockAPNSCalls).toHaveLength(1);

      expect(mockFCMCalls[0]).toMatchObject({
        to: fcmToken,
        title: expect.stringContaining('LTV Alert'),
        body: expect.stringContaining('85%'),
      });

      expect(mockAPNSCalls[0]).toMatchObject({
        to: apnsToken,
        title: expect.stringContaining('LTV Alert'),
        body: expect.stringContaining('85%'),
      });
    });
  });

  describe('Push Notification Error Handling', () => {
    it('should handle FCM send errors gracefully', async () => {
      // Store original method
      const originalSend = fcmProvider.send;

      // Mock FCM to throw error temporarily
      fcmProvider.send = jest.fn().mockRejectedValueOnce(new Error('FCM service unavailable'));

      const deviceToken = 'fcm-error-token';
      const testUserId = 'test-user-fcm-error-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoginFromNewDevice',
        userId: testUserId,
        deviceToken,
        deviceInfo: 'Test Device',
      };

      // Should handle error without crashing
      await expect(
        notificationQueueService.queueNotification(notificationData),
      ).resolves.not.toThrow();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify the method was called despite the error
      expect(fcmProvider.send).toHaveBeenCalled();

      // Restore original method
      fcmProvider.send = originalSend;
    });

    it('should handle APNS send errors gracefully', async () => {
      // Store original method
      const originalSend = apnsProvider.send;

      // Mock APNS to throw error temporarily
      apnsProvider.send = jest
        .fn()
        .mockRejectedValueOnce(new Error('APNS service unavailable [Expected Test Error]'));

      const deviceToken = 'apns-error-token';
      const testUserId = 'test-user-apns-error-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanRepaymentDue',
        userId: testUserId,
        apnsToken: deviceToken,
        loanId: 'loan-error-123',
        amount: '1000.00',
        dueDate: '2024-12-31',
      };

      // Should handle error without crashing
      await expect(
        notificationQueueService.queueNotification(notificationData),
      ).resolves.not.toThrow();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify the method was called despite the error
      expect(apnsProvider.send).toHaveBeenCalled();

      // Restore original method
      apnsProvider.send = originalSend;
    });
  });

  describe('Push Notification Priority and Urgency', () => {
    it('should handle high priority notifications', async () => {
      const deviceToken = 'fcm-priority-token-' + Date.now();
      const testUserId = 'test-user-priority-' + Date.now();

      const highPriorityNotificationData: NotificationData = {
        type: 'SuspiciousLoginAttempt',
        userId: testUserId,
        deviceToken,
        ipAddress: '192.168.1.100',
        location: 'Unknown Location',
        timestamp: new Date().toISOString(),
      };

      await notificationQueueService.queueNotification(highPriorityNotificationData, {
        priority: 10,
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(mockFCMCalls).toHaveLength(1);
      expect(mockFCMCalls[0]).toMatchObject({
        to: deviceToken,
        title: expect.stringContaining('Security'),
        body: expect.stringContaining('Suspicious login attempt'),
      });
    });

    it('should handle delayed push notifications', async () => {
      const deviceToken = 'fcm-delayed-token-' + Date.now();
      const testUserId = 'test-user-delayed-' + Date.now();

      const delayedNotificationData: NotificationData = {
        type: 'LoanRepaymentDue',
        userId: testUserId,
        deviceToken,
        loanId: 'loan-delayed-123',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      };

      // Queue with 5 second delay
      await notificationQueueService.queueNotification(delayedNotificationData, { delay: 5000 });

      // Should not be processed immediately
      await new Promise(resolve => setTimeout(resolve, 2000));
      expect(mockFCMCalls).toHaveLength(0);

      // Should be processed after delay
      await new Promise(resolve => setTimeout(resolve, 4000));
      expect(mockFCMCalls).toHaveLength(1);
    });
  });
});
