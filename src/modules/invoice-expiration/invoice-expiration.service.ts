import type {
  ExpiredInvoiceData,
  InvoiceExpirationResult,
  InvoiceExpirationWorkerData,
} from './invoice-expiration.types';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { ActiveButExpiredInvoice } from 'src/shared/repositories/finance.types.js';
import { assertProp, isInstanceOf } from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { NotificationQueueService } from '../notifications/notification-queue.service';

@Injectable()
export class InvoiceExpirationService {
  private readonly logger = new Logger(InvoiceExpirationService.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  async processExpiredInvoices(
    data: InvoiceExpirationWorkerData,
  ): Promise<InvoiceExpirationResult> {
    const { asOfDate = new Date().toISOString(), batchSize = 50 } = data;
    const processingDate = new Date(asOfDate);

    this.logger.log(`Starting invoice expiration check as of ${processingDate.toISOString()}`);

    let processedCount = 0;
    let expiredCount = 0;
    const errors: string[] = [];
    let hasMore = true;
    let offset = 0;

    try {
      while (hasMore) {
        // Fetch expired invoices in batches
        const result = await this.repository.platformViewsActiveButExpiredInvoices({
          asOfDate: processingDate,
          limit: batchSize,
          offset,
        });

        if (result.invoices.length === 0) {
          break;
        }

        this.logger.debug(
          `Processing batch of ${result.invoices.length} expired invoices (offset: ${offset})`,
        );

        // Process each expired invoice
        for (const invoice of result.invoices) {
          try {
            await this.expireInvoice(invoice, processingDate);
            expiredCount++;

            // Send expiration notification
            assertProp(isInstanceOf(Date), invoice, 'dueDate');
            assertProp(isInstanceOf(Date), invoice, 'expiredDate');
            await this.sendExpirationNotification(invoice);

            processedCount++;
          } catch (error) {
            const errorMessage = `Failed to expire invoice ${invoice.id}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error(errorMessage);
            errors.push(errorMessage);
            processedCount++;
          }
        }

        // Check if there are more invoices to process
        hasMore = result.hasMore;
        offset += batchSize;

        // Add small delay between batches to prevent overwhelming the database
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      this.logger.log(
        `Invoice expiration check completed. Processed: ${processedCount}, Expired: ${expiredCount}, Errors: ${errors.length}`,
      );

      return {
        processedCount,
        expiredCount,
        errors,
      };
    } catch (error) {
      const errorMessage = `Critical error during invoice expiration processing: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage);
      errors.push(errorMessage);

      return {
        processedCount,
        expiredCount,
        errors,
      };
    }
  }

  private async expireInvoice(invoice: ActiveButExpiredInvoice, expiredDate: Date): Promise<void> {
    this.logger.debug(`Expiring invoice ${invoice.id} for user ${invoice.userId}`);

    await this.repository.platformSetActiveButExpiredInvoiceAsExpired({
      invoiceId: invoice.id,
      expiredDate,
    });

    this.logger.log(
      `Successfully expired invoice ${invoice.id} (${invoice.invoiceType}) for user ${invoice.userId}`,
    );
  }

  private async sendExpirationNotification(invoice: ExpiredInvoiceData): Promise<void> {
    try {
      // Get user details from the database
      const user = await this.repository.userViewsProfile({
        userId: invoice.userId,
      });

      // Queue invoice expiration notification
      await this.notificationQueueService.queueNotification({
        type: 'InvoiceExpired',
        userId: invoice.userId,
        invoiceId: invoice.id,
        invoiceType: invoice.invoiceType,
        currencySymbol: invoice.currencyTokenId,
        invoicedAmount: invoice.invoicedAmount,
        dueDate: invoice.dueDate?.toISOString(),
        walletAddress: invoice.walletAddress,
        userEmail: user.email || `user${invoice.userId}@example.com`, // Fallback if no email
        userFirstName: user.name?.split(' ')[0] || 'User', // Get first name or fallback
      });

      this.logger.debug(`Queued expiration notification for invoice ${invoice.id}`);
    } catch (error) {
      this.logger.warn(
        `Failed to queue expiration notification for invoice ${invoice.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - notification failure shouldn't prevent invoice expiration
    }
  }
}
