import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { BeneficiaryVerificationNotificationComposer } from './composers/beneficiary-verification.composer';
import { EmailVerificationNotificationComposer } from './composers/email-verification-notification.composer';
import { InvoiceCreatedNotificationComposer } from './composers/invoice-created-notification.composer';
import { InvoicePaidNotificationComposer } from './composers/invoice-paid-notification.composer';
import { LoanLiquidationNotificationComposer } from './composers/loan-liquidation-notification.composer';
import { LoanLtvBreachNotificationComposer } from './composers/loan-ltv-breach-notification.composer';
import { LoanOfferMatchedNotificationComposer } from './composers/loan-offer-matched-notification.composer';
import { LoanOfferPublishedNotificationComposer } from './composers/loan-offer-published-notification.composer';
import { LoanRepaymentDueNotificationComposer } from './composers/loan-repayment-due-notification.composer';
import { LoanRepaymentFailedNotificationComposer } from './composers/loan-repayment-failed-notification.composer';
import { LoginFromNewDeviceNotificationComposer } from './composers/login-from-new-device-notification.composer';
import { PasswordResetCompletedNotificationComposer } from './composers/password-reset-completed-notification.composer';
import { PasswordResetNotificationComposer } from './composers/password-reset-notification.composer';
import { PhoneNumberVerificationNotificationComposer } from './composers/phone-number-verification-notification.composer';
import { SuspiciousLoginAttemptNotificationComposer } from './composers/suspicious-login-attempt-notification.composer';
import { TwoFactorEnabledNotificationComposer } from './composers/two-factor-enabled-notification.composer';
import { UserKycRejectedNotificationComposer } from './composers/user-kyc-rejected-notification.composer';
import { UserKycVerifiedNotificationComposer } from './composers/user-kyc-verified-notification.composer';
import { UserRegisteredNotificationComposer } from './composers/user-registered-notification.composer';
import { WithdrawalRequestedNotificationComposer } from './composers/withdrawal-requested-notification.composer';
import { NotificationService } from './notification.service';
import { NotificationComposerFactory } from './notification-composer.factory';
import { NotificationProviderFactory } from './notification-provider.factory';
import { NotificationQueueService } from './notification-queue.service';
import { APNSNotificationProvider } from './providers/apns-notification.provider';
import { EmailNotificationProvider } from './providers/email-notification.provider';
import { FCMNotificationProvider } from './providers/fcm-notification.provider';
import { SMSNotificationProvider } from './providers/sms-notification.provider';

@Module({
  imports: [
    DiscoveryModule,
    BullModule.registerQueue({
      name: 'notificationQueue',
    }),
  ],
  providers: [
    // Core services
    NotificationService,
    NotificationQueueService,

    // Factories
    NotificationComposerFactory,
    NotificationProviderFactory,

    // Providers
    EmailNotificationProvider,
    SMSNotificationProvider,
    FCMNotificationProvider,
    APNSNotificationProvider,

    // Notification Composers
    BeneficiaryVerificationNotificationComposer,
    EmailVerificationNotificationComposer,
    InvoiceCreatedNotificationComposer,
    InvoicePaidNotificationComposer,
    LoanLiquidationNotificationComposer,
    LoanLtvBreachNotificationComposer,
    LoanOfferMatchedNotificationComposer,
    LoanOfferPublishedNotificationComposer,
    LoanRepaymentDueNotificationComposer,
    LoanRepaymentFailedNotificationComposer,
    LoginFromNewDeviceNotificationComposer,
    PasswordResetNotificationComposer,
    PasswordResetCompletedNotificationComposer,
    SuspiciousLoginAttemptNotificationComposer,
    TwoFactorEnabledNotificationComposer,
    UserRegisteredNotificationComposer,
    UserKycVerifiedNotificationComposer,
    UserKycRejectedNotificationComposer,
    WithdrawalRequestedNotificationComposer,
    PhoneNumberVerificationNotificationComposer,
  ],
  exports: [NotificationQueueService, NotificationService],
})
export class NotificationModule {}
