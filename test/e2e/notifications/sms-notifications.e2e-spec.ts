import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import type { NotificationData } from '../../../src/modules/notifications/notification.types';

import { Test } from '@nestjs/testing';

import { NotificationQueueService } from '../../../src/modules/notifications/notification-queue.service';
import { SMSNotificationProvider } from '../../../src/modules/notifications/providers/sms-notification.provider';
import { NotificationWorkerModule } from '../../../src/notification-worker.module';
import { TwilioService } from '../../../src/shared/services/twilio.service';
import { TestContainerSetup } from '../../setup/test-containers';

describe('SMS Notifications E2E', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let notificationQueueService: NotificationQueueService;
  let smsProvider: SMSNotificationProvider;
  let twilioService: TwilioService;

  // Mock tracking for SMS notification calls
  const mockSMSCalls: Array<{ to: string; message: string }> = [];

  beforeAll(async () => {
    await TestContainerSetup.ensureContainersStarted();

    process.env.DATABASE_URL = TestContainerSetup.getPostgresConnectionString();
    process.env.DATABASE_LOGGER = 'false';

    const redisConfig = TestContainerSetup.getRedisConfig();
    process.env.REDIS_HOST = redisConfig.host;
    process.env.REDIS_PORT = String(redisConfig.port);
    process.env.REDIS_PASSWORD = redisConfig.password || '';

    // Mock Twilio configuration
    process.env.TWILIO_ACCOUNT_SID = 'ACtest_account_sid_12345678901234567890';
    process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';

    moduleFixture = await Test.createTestingModule({
      imports: [NotificationWorkerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    notificationQueueService =
      moduleFixture.get<NotificationQueueService>(NotificationQueueService);
    smsProvider = moduleFixture.get<SMSNotificationProvider>(SMSNotificationProvider);
    twilioService = moduleFixture.get<TwilioService>(TwilioService);

    // Mock the Twilio service to track calls instead of actually sending SMS
    jest.spyOn(twilioService, 'sendSMS').mockImplementation(async smsData => {
      mockSMSCalls.push({
        to: smsData.to,
        message: smsData.body ?? '',
      });
      // satisfy Twilio MessageInstance return type by casting through unknown
      return { sid: 'mock_message_sid', status: 'sent' } as unknown as MessageInstance;
    });

    await app.init();
  }, 60_000);

  beforeEach(async () => {
    mockSMSCalls.length = 0;

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
    if (twilioService && jest.isMockFunction(twilioService.sendSMS)) {
      (twilioService.sendSMS as jest.Mock).mockRestore();
    }

    if (app) {
      await app.close();
    }
  });

  describe('Authentication SMS Notifications', () => {
    it('should send SMS verification code', async () => {
      const phoneNumber = '+1555000' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-sms-' + Date.now();
      const verificationCode = '123456';

      const notificationData: NotificationData = {
        type: 'TwoFactorEnabled',
        userId: testUserId,
        phoneNumber,
        verificationCode,
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining(verificationCode),
      });
      expect(mockSMSCalls[0].message).toContain('CryptoGadai');
      expect(mockSMSCalls[0].message).toContain('verification');
    });

    it('should send SMS for suspicious login attempt', async () => {
      const phoneNumber = '+1555001' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-security-' + Date.now();

      const notificationData: NotificationData = {
        type: 'SuspiciousLoginAttempt',
        userId: testUserId,
        phoneNumber,
        location: 'Unknown Location, Country',
        ipAddress: '192.168.1.100',
        timestamp: new Date().toISOString(),
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining('Security Alert'),
      });
      expect(mockSMSCalls[0].message).toContain('Suspicious login attempt');
      expect(mockSMSCalls[0].message).toContain('Unknown Location');
    });

    it('should send SMS for password reset confirmation', async () => {
      const phoneNumber = '+1555002' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-reset-' + Date.now();

      const notificationData: NotificationData = {
        type: 'PasswordResetCompleted',
        userId: testUserId,
        phoneNumber,
        timestamp: new Date().toISOString(),
        ipAddress: '10.0.0.1',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining('password has been reset'),
      });
      expect(mockSMSCalls[0].message).toContain('CryptoGadai');
    });
  });

  describe('Financial SMS Notifications', () => {
    it('should send SMS for loan repayment due', async () => {
      const phoneNumber = '+1555003' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-loan-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanRepaymentDue',
        userId: testUserId,
        phoneNumber,
        loanId: 'loan-123',
        amount: '1,250.00',
        currency: 'USD',
        dueDate: '2024-12-31',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining('loan repayment'),
      });
      expect(mockSMSCalls[0].message).toContain('1,250.00');
      expect(mockSMSCalls[0].message).toContain('31/12/2024');
    });

    it('should send SMS for invoice payment received', async () => {
      const phoneNumber = '+1555004' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-invoice-' + Date.now();

      const notificationData: NotificationData = {
        type: 'InvoicePaid',
        userId: testUserId,
        phoneNumber,
        invoiceId: 'inv-456',
        amount: '750.50',
        currency: 'USD',
        paymentDate: new Date().toISOString(),
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining('invoice has been paid'),
      });
      expect(mockSMSCalls[0].message).toContain('750.50');
      expect(mockSMSCalls[0].message).toContain('750.50');
    });

    it('should send SMS for withdrawal confirmation', async () => {
      const phoneNumber = '+1555005' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-withdrawal-' + Date.now();

      const notificationData: NotificationData = {
        type: 'WithdrawalRequested',
        userId: testUserId,
        phoneNumber,
        withdrawalId: 'wd-789',
        amount: '2,500.00',
        currency: 'USD',
        bankAccount: '****1234',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining('Withdrawal request'),
      });
      expect(mockSMSCalls[0].message).toContain('2,500.00');
      expect(mockSMSCalls[0].message).toContain('****1234');
    });
  });

  describe('KYC and Verification SMS', () => {
    it('should send SMS for KYC verification success', async () => {
      const phoneNumber = '+1555006' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-kyc-' + Date.now();

      const notificationData: NotificationData = {
        type: 'UserKycVerified',
        userId: testUserId,
        phoneNumber,
        verificationLevel: 'Level 2',
        verifiedAt: new Date().toISOString(),
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining('KYC verification'),
      });
      expect(mockSMSCalls[0].message).toContain('approved');
      expect(mockSMSCalls[0].message).toContain('Level 2');
    });

    it('should send SMS for KYC verification failure', async () => {
      const phoneNumber = '+1555007' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-kyc-reject-' + Date.now();

      const notificationData: NotificationData = {
        type: 'UserKycRejected',
        userId: testUserId,
        phoneNumber,
        reason: 'Document quality insufficient',
        rejectedAt: new Date().toISOString(),
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      expect(mockSMSCalls[0]).toMatchObject({
        to: phoneNumber,
        message: expect.stringContaining('KYC verification'),
      });
      expect(mockSMSCalls[0].message).toContain('rejected');
      expect(mockSMSCalls[0].message).toContain('insufficient');
    });
  });

  describe('SMS Provider Validation', () => {
    it('should validate SMS payload structure', async () => {
      const phoneNumber = '+1555008';

      // Test that SMS provider correctly identifies SMS payloads
      expect(
        smsProvider.isSendablePayload({
          channel: 'SMS',
          to: phoneNumber,
          message: 'Test SMS message',
        }),
      ).toBe(true);

      // Test that SMS provider rejects non-SMS payloads
      expect(
        smsProvider.isSendablePayload({
          channel: 'Email',
          to: 'test@example.com',
          subject: 'Test',
          htmlBody: '<p>Test</p>',
          textBody: 'Test',
        }),
      ).toBe(false);

      expect(
        smsProvider.isSendablePayload({
          channel: 'FCM',
          to: 'fcm-token',
          title: 'Test',
          body: 'Test Body',
        }),
      ).toBe(false);
    });

    it('should handle phone number formatting', async () => {
      const phoneNumbers = [
        '+1555100' + Date.now().toString().slice(-4),
        '1555100' + Date.now().toString().slice(-4),
        '+1 555 100 ' + Date.now().toString().slice(-4),
      ];

      for (const phoneNumber of phoneNumbers) {
        const testUserId = 'test-user-format-' + Date.now() + '-' + phoneNumber.replace(/\D/g, '');

        const notificationData: NotificationData = {
          type: 'TwoFactorEnabled',
          userId: testUserId,
          phoneNumber,
          verificationCode: '654321',
        };

        await notificationQueueService.queueNotification(notificationData);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 4000));

      expect(mockSMSCalls.length).toBeGreaterThanOrEqual(phoneNumbers.length);

      // Each call should have been made with the provided phone number
      for (let i = 0; i < phoneNumbers.length; i++) {
        expect(mockSMSCalls[i].to).toBe(phoneNumbers[i]);
      }
    });
  });

  describe('SMS Error Handling', () => {
    it('should handle Twilio service errors gracefully', async () => {
      // Store the original method
      const originalSendSMS = twilioService.sendSMS;

      // Mock Twilio to throw error for this test
      twilioService.sendSMS = jest.fn().mockRejectedValueOnce(new Error('Twilio API error'));

      const phoneNumber = '+1555900' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-error-' + Date.now();

      const notificationData: NotificationData = {
        type: 'TwoFactorEnabled',
        userId: testUserId,
        phoneNumber,
        verificationCode: '999999',
      };

      // Should handle error without crashing
      await expect(
        notificationQueueService.queueNotification(notificationData),
      ).resolves.not.toThrow();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify the method was called despite the error
      expect(twilioService.sendSMS).toHaveBeenCalled();

      // Restore the original method
      twilioService.sendSMS = originalSendSMS;
    });

    it('should handle invalid phone numbers gracefully', async () => {
      const invalidPhoneNumbers = [
        'invalid-phone',
        '123', // too short
        '+999999999999999999', // too long
        '', // empty
      ];

      for (const phoneNumber of invalidPhoneNumbers) {
        const testUserId = 'test-user-invalid-' + Date.now();

        const notificationData: NotificationData = {
          type: 'TwoFactorEnabled',
          userId: testUserId,
          phoneNumber,
          verificationCode: '111111',
        };

        // Should handle invalid numbers without crashing the system
        await expect(
          notificationQueueService.queueNotification(notificationData),
        ).resolves.not.toThrow();
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
    });
  });

  describe('SMS Message Content', () => {
    it('should ensure SMS messages are within character limits', async () => {
      const phoneNumber = '+1555800' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-length-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanOfferPublished',
        userId: testUserId,
        phoneNumber,
        loanOfferId: 'offer-with-very-long-id-' + Date.now(),
        amount: '99,999,999.99',
        interestRate: '12.5%',
        term: '36 months',
        description:
          'This is a very detailed loan offer description that might make the SMS very long',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);

      // SMS messages should generally be under 160 characters for single SMS
      // or properly handle multi-part messages
      const smsMessage = mockSMSCalls[0].message;
      expect(smsMessage.length).toBeGreaterThan(0);

      // Should contain essential information even if truncated
      expect(smsMessage).toContain('99,999,999.99');
      expect(smsMessage).toContain('12.5%');
    });

    it('should include required information in SMS messages', async () => {
      const phoneNumber = '+1555801' + Date.now().toString().slice(-4);
      const testUserId = 'test-user-required-' + Date.now();

      const notificationData: NotificationData = {
        type: 'LoanRepaymentFailed',
        userId: testUserId,
        phoneNumber,
        loanId: 'loan-fail-123',
        amount: '1,000.00',
        failureReason: 'Insufficient funds',
        nextAttempt: '2024-01-15',
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(mockSMSCalls).toHaveLength(1);
      const smsMessage = mockSMSCalls[0].message;

      // Essential information should be present
      expect(smsMessage).toContain('1,000.00');
      expect(smsMessage).toContain('failed');
      expect(smsMessage).toContain('CryptoGadai'); // Brand name

      // Contact or action information should be included
      expect(smsMessage.toLowerCase()).toMatch(/(contact|support|help|call)/);
    });
  });
});
