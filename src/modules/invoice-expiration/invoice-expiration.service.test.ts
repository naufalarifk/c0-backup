import type { ExpiredInvoiceData, InvoiceExpirationWorkerData } from './invoice-expiration.types';

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

// Import the service to test
import { InvoiceExpirationService } from './invoice-expiration.service';

interface MockFinanceRepository {
  platformViewsActiveButExpiredInvoices: ReturnType<typeof mock.fn>;
  platformSetActiveButExpiredInvoiceAsExpired: ReturnType<typeof mock.fn>;
}

interface MockNotificationQueueService {
  queueNotification: ReturnType<typeof mock.fn>;
}

describe('Invoice Expiration Service - Native Node Test', () => {
  let invoiceExpirationService: InvoiceExpirationService;
  let mockFinanceRepository: MockFinanceRepository;
  let mockNotificationQueueService: MockNotificationQueueService;

  const mockExpiredInvoices: ExpiredInvoiceData[] = [
    {
      id: 'invoice-1',
      userId: 'user-1',
      currencyBlockchainKey: 'eip155:1',
      currencyTokenId: 'USDC',
      invoicedAmount: '1000.00',
      paidAmount: '0.00',
      walletAddress: '0x123...abc',
      invoiceType: 'Loan',
      status: 'Pending',
      invoiceDate: new Date('2024-01-01'),
      dueDate: new Date('2024-01-15'),
      expiredDate: null,
    },
    {
      id: 'invoice-2',
      userId: 'user-2',
      currencyBlockchainKey: 'eip155:1',
      currencyTokenId: 'USDT',
      invoicedAmount: '500.00',
      paidAmount: '100.00',
      walletAddress: '0x456...def',
      invoiceType: 'Fee',
      status: 'PartiallyPaid',
      invoiceDate: new Date('2024-01-05'),
      dueDate: new Date('2024-01-20'),
      expiredDate: null,
    },
  ];

  beforeEach(() => {
    // Create mock finance repository with proper method signatures
    mockFinanceRepository = {
      platformViewsActiveButExpiredInvoices: mock.fn(() =>
        Promise.resolve({ invoices: [], totalCount: 0, hasMore: false }),
      ),
      platformSetActiveButExpiredInvoiceAsExpired: mock.fn(() => Promise.resolve()),
    };

    // Create mock notification queue service
    mockNotificationQueueService = {
      queueNotification: mock.fn(() => Promise.resolve()),
    };

    // Create service instance with mocked dependencies
    invoiceExpirationService = new InvoiceExpirationService(
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any for complex repository interface
      mockFinanceRepository as any,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any for complex service interface
      mockNotificationQueueService as any,
    );
  });

  afterEach(() => {
    // Reset all mocks
    mock.reset();
  });

  describe('processExpiredInvoices', () => {
    it('should successfully process expired invoices and send notifications', async () => {
      // Arrange
      const workerData: InvoiceExpirationWorkerData = {
        type: 'invoice-expiration-check',
        batchSize: 100,
        asOfDate: new Date().toISOString(),
      };

      // Mock repository to return expired invoices
      mockFinanceRepository.platformViewsActiveButExpiredInvoices.mock.mockImplementation(() =>
        Promise.resolve({
          invoices: mockExpiredInvoices,
          totalCount: 2,
          hasMore: false,
        }),
      );

      // Act
      const result = await invoiceExpirationService.processExpiredInvoices(workerData);

      // Assert
      assert.strictEqual(result.processedCount, 2, 'Should process 2 invoices');
      assert.strictEqual(result.expiredCount, 2, 'Should expire 2 invoices');
      assert.strictEqual(result.errors.length, 0, 'Should have no errors');

      // Verify repository method was called
      assert.strictEqual(
        mockFinanceRepository.platformViewsActiveButExpiredInvoices.mock.callCount(),
        1,
        'Should call platformViewsActiveButExpiredInvoices once',
      );

      // Verify expiration method was called for each invoice
      assert.strictEqual(
        mockFinanceRepository.platformSetActiveButExpiredInvoiceAsExpired.mock.callCount(),
        2,
        'Should call expiration method twice',
      );

      // Verify notifications were sent
      assert.strictEqual(
        mockNotificationQueueService.queueNotification.mock.callCount(),
        2,
        'Should send 2 notifications',
      );

      console.log('✅ Test 1 passed: Successfully processes expired invoices');
    });

    it('should handle empty results gracefully', async () => {
      // Arrange
      const workerData: InvoiceExpirationWorkerData = {
        type: 'invoice-expiration-check',
        batchSize: 100,
        asOfDate: new Date().toISOString(),
      };

      // Mock empty result (default from beforeEach)

      // Act
      const result = await invoiceExpirationService.processExpiredInvoices(workerData);

      // Assert
      assert.strictEqual(result.processedCount, 0, 'Should process 0 invoices');
      assert.strictEqual(result.expiredCount, 0, 'Should expire 0 invoices');
      assert.strictEqual(result.errors.length, 0, 'Should have no errors');

      // Verify query was made but no processing occurred
      assert.strictEqual(
        mockFinanceRepository.platformViewsActiveButExpiredInvoices.mock.callCount(),
        1,
        'Should call query method once',
      );

      assert.strictEqual(
        mockFinanceRepository.platformSetActiveButExpiredInvoiceAsExpired.mock.callCount(),
        0,
        'Should not call expiration method',
      );

      assert.strictEqual(
        mockNotificationQueueService.queueNotification.mock.callCount(),
        0,
        'Should not send notifications',
      );

      console.log('✅ Test 2 passed: Handles empty results gracefully');
    });

    it('should handle individual invoice expiration errors', async () => {
      // Arrange
      const workerData: InvoiceExpirationWorkerData = {
        type: 'invoice-expiration-check',
        batchSize: 100,
        asOfDate: new Date().toISOString(),
      };

      mockFinanceRepository.platformViewsActiveButExpiredInvoices.mock.mockImplementation(() =>
        Promise.resolve({
          invoices: mockExpiredInvoices,
          totalCount: 2,
          hasMore: false,
        }),
      );

      // First call succeeds, second fails
      let expireCallCount = 0;
      mockFinanceRepository.platformSetActiveButExpiredInvoiceAsExpired.mock.mockImplementation(
        () => {
          expireCallCount++;
          if (expireCallCount === 1) {
            return Promise.resolve();
          } else {
            return Promise.reject(new Error('Database error'));
          }
        },
      );

      // Act
      const result = await invoiceExpirationService.processExpiredInvoices(workerData);

      // Assert
      assert.strictEqual(result.processedCount, 2, 'Should attempt to process both invoices');
      assert.strictEqual(result.expiredCount, 1, 'Should succeed in expiring 1 invoice');
      assert.strictEqual(result.errors.length, 1, 'Should have 1 error');

      // Verify error message contains expected info
      assert.ok(result.errors[0].includes('invoice-2'), 'Error should mention failing invoice ID');
      assert.ok(
        result.errors[0].includes('Database error'),
        'Error should include original error message',
      );

      console.log('✅ Test 3 passed: Handles individual errors gracefully');
    });

    it('should handle batch processing correctly', async () => {
      // Arrange - Use small batch size to test pagination
      const workerData: InvoiceExpirationWorkerData = {
        type: 'invoice-expiration-check',
        batchSize: 1, // Process one at a time
        asOfDate: new Date().toISOString(),
      };

      let queryCallCount = 0;
      mockFinanceRepository.platformViewsActiveButExpiredInvoices.mock.mockImplementation(() => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return Promise.resolve({
            invoices: [mockExpiredInvoices[0]],
            totalCount: 2,
            hasMore: true,
          });
        } else {
          return Promise.resolve({
            invoices: [mockExpiredInvoices[1]],
            totalCount: 2,
            hasMore: false,
          });
        }
      });

      // Act
      const result = await invoiceExpirationService.processExpiredInvoices(workerData);

      // Assert
      assert.strictEqual(result.processedCount, 2, 'Should process both invoices across batches');
      assert.strictEqual(result.expiredCount, 2, 'Should expire both invoices');
      assert.strictEqual(result.errors.length, 0, 'Should have no errors');

      // Verify pagination worked
      assert.strictEqual(
        mockFinanceRepository.platformViewsActiveButExpiredInvoices.mock.callCount(),
        2,
        'Should call query method twice for pagination',
      );

      console.log('✅ Test 4 passed: Handles batch processing with pagination');
    });

    it('should handle notification failures gracefully', async () => {
      // Arrange
      const workerData: InvoiceExpirationWorkerData = {
        type: 'invoice-expiration-check',
        batchSize: 100,
        asOfDate: new Date().toISOString(),
      };

      mockFinanceRepository.platformViewsActiveButExpiredInvoices.mock.mockImplementation(() =>
        Promise.resolve({
          invoices: [mockExpiredInvoices[0]],
          totalCount: 1,
          hasMore: false,
        }),
      );

      // Notification fails but shouldn't affect expiration
      mockNotificationQueueService.queueNotification.mock.mockImplementation(() =>
        Promise.reject(new Error('Notification service down')),
      );

      // Act
      const result = await invoiceExpirationService.processExpiredInvoices(workerData);

      // Assert - Processing should still succeed despite notification failure
      assert.strictEqual(result.processedCount, 1, 'Should process 1 invoice');
      assert.strictEqual(result.expiredCount, 1, 'Should expire 1 invoice');
      assert.strictEqual(
        result.errors.length,
        0,
        'Notification errors should not affect processing',
      );

      // Verify invoice was still expired
      assert.strictEqual(
        mockFinanceRepository.platformSetActiveButExpiredInvoiceAsExpired.mock.callCount(),
        1,
        'Should still expire invoice despite notification failure',
      );

      console.log('✅ Test 5 passed: Handles notification failures gracefully');
    });
  });
});
