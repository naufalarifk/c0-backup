import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { NotificationData } from '../../../src/modules/notifications/notification.types';

import { Test } from '@nestjs/testing';

import { EmailVerificationNotificationData } from '../../../src/modules/notifications/composers/email-verification-notification.composer';
import { EmailPasswordResetNotificationData } from '../../../src/modules/notifications/composers/password-reset-notification.composer';
import { UserRegisteredNotificationData } from '../../../src/modules/notifications/composers/user-registered-notification.composer';
import { NotificationQueueService } from '../../../src/modules/notifications/notification-queue.service';
import { NotificationWorkerModule } from '../../../src/notification-worker.module';
import MailContainer from '../../setup/mail-container';
import { TestContainerSetup } from '../../setup/test-containers';
import { MailpitHelper } from '../../utils';

describe('Email Notifications E2E', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let notificationQueueService: NotificationQueueService;
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

    moduleFixture = await Test.createTestingModule({
      imports: [NotificationWorkerModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    notificationQueueService =
      moduleFixture.get<NotificationQueueService>(NotificationQueueService);

    await app.init();
  }, 60_000);

  beforeEach(async () => {
    await MailpitHelper.clearAllMessages();
  });

  afterAll(async () => {
    await mailContainer.stop();
    if (app) {
      await app.close();
    }
  });

  describe('User Registration Email', () => {
    it('should send welcome email on user registration', async () => {
      // Create a test user in the database
      const testUserId = 'test-user-' + Date.now();
      const testEmail = `test-${Date.now()}@example.com`;
      const testName = 'Test User';

      // Mock user creation (you might need to adapt this based on your repository structure)
      // For now, we'll test the notification flow assuming user exists

      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: testUserId,
        email: testEmail,
        name: testName,
      };

      // Queue the notification
      await notificationQueueService.queueNotification(notificationData);

      // Wait for email to be sent and received
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if email was received
      const messages = await MailpitHelper.getAllMessages();
      expect(messages.length).toBeGreaterThan(0);

      const welcomeEmail = messages.find(
        msg =>
          msg.To?.[0]?.Address === testEmail && msg.Subject?.includes('Welcome to CryptoGadai'),
      );

      expect(welcomeEmail).toBeDefined();
      expect(welcomeEmail?.Subject).toBe('Welcome to CryptoGadai - Account Created Successfully');
      expect(welcomeEmail?.To?.[0]?.Address).toBe(testEmail);

      // Check email content
      const emailContent = await MailpitHelper.getEmailContent(welcomeEmail!.ID);
      expect(emailContent.HTML).toContain('Welcome to CryptoGadai');
      expect(emailContent.HTML).toContain(testName);
      expect(emailContent.HTML).toContain('dashboard');
      expect(emailContent.Text).toContain('Welcome to CryptoGadai');
      expect(emailContent.Text).toContain(testName);
    });

    it('should handle email delivery failure gracefully', async () => {
      // Test with invalid email configuration
      const originalMailHost = process.env.MAIL_HOST;
      process.env.MAIL_HOST = 'invalid-host';

      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: 'test-user-fail',
        email: 'test-fail@example.com',
        name: 'Test User Fail',
      };

      // This should handle the failure gracefully
      await expect(
        notificationQueueService.queueNotification(notificationData),
      ).resolves.not.toThrow();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Restore original configuration
      process.env.MAIL_HOST = originalMailHost;
    });
  });

  describe('Email Verification Email', () => {
    it('should send email verification notification', async () => {
      const testUserId = 'test-user-verify-' + Date.now();
      const testEmail = `verify-${Date.now()}@example.com`;
      const verificationToken = 'verification-token-123-' + testUserId;

      const notificationData: EmailVerificationNotificationData = {
        type: 'EmailVerification',
        name: 'Verify Test User',
        email: testEmail,
        url: 'http://example.com/verify?token=' + verificationToken,
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for email processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      const messages = await MailpitHelper.getAllMessages();
      const verificationEmail = messages.find(
        msg => msg.To?.[0]?.Address === testEmail && msg.Subject?.includes('Verify your email'),
      );

      expect(verificationEmail).toBeDefined();
      expect(verificationEmail?.To?.[0]?.Address).toBe(testEmail);

      // Check if verification token is included in email content
      const emailContent = await MailpitHelper.getEmailContent(verificationEmail!.ID);
      expect(emailContent.HTML).toContain(verificationToken);
    });
  });

  describe('Password Reset Email', () => {
    it('should send password reset notification', async () => {
      const testUserId = 'test-user-reset-' + Date.now();
      const testEmail = `reset-${Date.now()}@example.com`;
      const resetToken = 'reset-token-123-' + testUserId;

      const notificationData: EmailPasswordResetNotificationData = {
        type: 'PasswordResetRequested',
        url: 'http://example.com/reset-password?token=' + resetToken,
        email: testEmail,
      };

      await notificationQueueService.queueNotification(notificationData);

      // Wait for email processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      const messages = await MailpitHelper.getAllMessages();
      const resetEmail = messages.find(
        msg => msg.To?.[0]?.Address === testEmail && msg.Subject?.includes('Reset your password'),
      );

      expect(resetEmail).toBeDefined();
      expect(resetEmail?.To?.[0]?.Address).toBe(testEmail);

      // Check if reset token is included in email content
      const emailContent = await MailpitHelper.getEmailContent(resetEmail!.ID);
      expect(emailContent.HTML).toContain(resetToken);
    });
  });

  describe('Email Content and Formatting', () => {
    it('should send properly formatted HTML and text emails', async () => {
      const testUserId = 'test-user-format-' + Date.now();
      const testEmail = `format-${Date.now()}@example.com`;
      const testName = 'Format Test User';

      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: testUserId,
        email: testEmail,
        name: testName,
      };

      await notificationQueueService.queueNotification(notificationData);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const messages = await MailpitHelper.getAllMessages();
      const email = messages.find(msg => msg.To?.[0]?.Address === testEmail);

      expect(email).toBeDefined();

      const emailContent = await MailpitHelper.getEmailContent(email!.ID);

      // Verify HTML content structure
      expect(emailContent.HTML).toContain('<html>');
      expect(emailContent.HTML).toContain('<body>');
      expect(emailContent.HTML).toContain('<h2');
      expect(emailContent.HTML).toContain('font-family');
      expect(emailContent.HTML).toContain('max-width');

      // Verify text content is present
      expect(emailContent.Text).toBeTruthy();
      expect(emailContent.Text?.length ?? -1).toBeGreaterThan(50);

      // Both should contain user name
      expect(emailContent.HTML).toContain(testName);
      expect(emailContent.Text).toContain(testName);
    });

    it('should handle special characters in email content', async () => {
      const testUserId = 'test-user-special-' + Date.now();
      const testEmail = `special-${Date.now()}@example.com`;
      const testName = 'José García-Müller & Co. <Special>';

      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: testUserId,
        email: testEmail,
        name: testName,
      };

      await notificationQueueService.queueNotification(notificationData);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const messages = await MailpitHelper.getAllMessages();
      const email = messages.find(msg => msg.To?.[0]?.Address === testEmail);

      expect(email).toBeDefined();

      const emailContent = await MailpitHelper.getEmailContent(email!.ID);

      // Should properly handle special characters
      expect(emailContent.HTML).toContain('José');
      expect(emailContent.Text).toContain('José');
      expect(emailContent.HTML).toContain('García-Müller');
      expect(emailContent.Text).toContain('García-Müller');
    });
  });

  describe('Email Headers and Metadata', () => {
    it('should set correct email headers', async () => {
      const testUserId = 'test-user-headers-' + Date.now();
      const testEmail = `headers-${Date.now()}@example.com`;

      const notificationData: UserRegisteredNotificationData = {
        type: 'UserRegistered',
        userId: testUserId,
        email: testEmail,
        name: 'Headers Test User',
      };

      await notificationQueueService.queueNotification(notificationData);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const messages = await MailpitHelper.getAllMessages();
      const email = messages.find(msg => msg.To?.[0]?.Address === testEmail);

      expect(email).toBeDefined();
      expect(email?.From?.Address).toBe('test@cryptogadai.com');
      expect(email?.To?.[0]?.Address).toBe(testEmail);
      expect(email?.Subject).toBeTruthy();
    });
  });

  describe('Bulk Email Processing', () => {
    it('should handle multiple email notifications efficiently', async () => {
      const startTime = Date.now();
      const emailCount = 5;
      const notifications: NotificationData[] = [];

      // Create multiple notifications
      for (let i = 0; i < emailCount; i++) {
        notifications.push({
          type: 'UserRegistered',
          userId: `bulk-user-${i}-${startTime}`,
          email: `bulk-${i}-${startTime}@example.com`,
          name: `Bulk User ${i}`,
        } as UserRegisteredNotificationData);
      }

      // Queue all notifications
      await Promise.all(notifications.map(n => notificationQueueService.queueNotification(n)));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 8000));

      const messages = await MailpitHelper.getAllMessages();
      const bulkEmails = messages.filter(msg =>
        msg.To?.[0]?.Address?.includes(`${startTime}@example.com`),
      );

      expect(bulkEmails).toHaveLength(emailCount);

      // Verify all emails have unique recipients
      const recipients = bulkEmails.map(email => email.To?.[0]?.Address);
      const uniqueRecipients = new Set(recipients);
      expect(uniqueRecipients.size).toBe(emailCount);
    });
  });
});
