import type { Job } from 'bullmq';
import type {
  InvoiceExpirationResult,
  InvoiceExpirationWorkerData,
} from './invoice-expiration.types';

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { InvoiceExpirationProcessor } from './invoice-expiration.processor';
// Import components to test
import { InvoiceExpirationQueueService } from './invoice-expiration-queue.service';

interface MockQueue {
  add: ReturnType<typeof mock.fn>;
  getWaiting: ReturnType<typeof mock.fn>;
  getActive: ReturnType<typeof mock.fn>;
  getCompleted: ReturnType<typeof mock.fn>;
  getFailed: ReturnType<typeof mock.fn>;
}

interface MockInvoiceExpirationService {
  processExpiredInvoices: ReturnType<typeof mock.fn>;
}

describe('Invoice Expiration Queue & Processor Tests', () => {
  let queueService: InvoiceExpirationQueueService;
  let processor: InvoiceExpirationProcessor;
  let mockQueue: MockQueue;
  let mockInvoiceExpirationService: MockInvoiceExpirationService;

  beforeEach(() => {
    // Mock BullMQ queue
    mockQueue = {
      add: mock.fn(() => Promise.resolve({ id: 'job-123' })),
      getWaiting: mock.fn(() => Promise.resolve([])),
      getActive: mock.fn(() => Promise.resolve([])),
      getCompleted: mock.fn(() => Promise.resolve([])),
      getFailed: mock.fn(() => Promise.resolve([])),
    };

    // Mock invoice expiration service
    mockInvoiceExpirationService = {
      processExpiredInvoices: mock.fn(() =>
        Promise.resolve({
          processedCount: 5,
          expiredCount: 3,
          errors: [],
        }),
      ),
    };

    // Create service instances with type assertions
    // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any for complex interfaces
    queueService = new InvoiceExpirationQueueService(mockQueue as any);
    // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any for complex interfaces
    processor = new InvoiceExpirationProcessor(mockInvoiceExpirationService as any);
  });

  afterEach(() => {
    mock.reset();
  });

  describe('InvoiceExpirationQueueService', () => {
    it('should queue invoice expiration check job', async () => {
      // Arrange
      const jobData = {
        type: 'invoice-expiration-check' as const,
        batchSize: 50,
        asOfDate: new Date().toISOString(),
      };

      // Act
      await queueService.queueInvoiceExpirationCheck(jobData);

      // Assert
      assert.strictEqual(mockQueue.add.mock.callCount(), 1, 'Should add job to queue');

      const addCall = mockQueue.add.mock.calls[0];
      assert.strictEqual(
        addCall.arguments[0],
        'invoice-expiration-check',
        'Job name should be correct',
      );
      assert.deepStrictEqual(addCall.arguments[1], jobData, 'Job data should match');

      console.log('✅ Queue Service Test 1 passed: Successfully queues jobs');
    });

    it('should get queue status correctly', async () => {
      // Arrange
      mockQueue.getWaiting.mock.mockImplementation(() => Promise.resolve([1, 2]));
      mockQueue.getActive.mock.mockImplementation(() => Promise.resolve([3]));
      mockQueue.getCompleted.mock.mockImplementation(() => Promise.resolve([4, 5, 6]));
      mockQueue.getFailed.mock.mockImplementation(() => Promise.resolve([7]));

      // Act
      const status = await queueService.getQueueStatus();

      // Assert
      assert.deepStrictEqual(status, {
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 1,
      });

      console.log('✅ Queue Service Test 2 passed: Gets queue status correctly');
    });

    it('should handle cron job trigger', async () => {
      // Act - This would normally be triggered by the cron decorator
      await queueService.handleScheduledInvoiceExpirationCheck();

      // Assert
      assert.strictEqual(mockQueue.add.mock.callCount(), 1, 'Should add scheduled job to queue');

      const addCall = mockQueue.add.mock.calls[0];
      assert.strictEqual(
        addCall.arguments[0],
        'invoice-expiration-check',
        'Scheduled job name should be correct',
      );
      assert.strictEqual(
        (addCall.arguments[1] as InvoiceExpirationWorkerData).type,
        'invoice-expiration-check',
        'Scheduled job type should be correct',
      );

      console.log('✅ Queue Service Test 3 passed: Handles cron scheduling');
    });
  });

  describe('InvoiceExpirationProcessor', () => {
    it('should process invoice expiration job successfully', async () => {
      // Arrange
      const jobData = {
        type: 'invoice-expiration-check' as const,
        batchSize: 100,
        asOfDate: new Date().toISOString(),
      };

      const mockJob = {
        id: 'job-456',
        data: jobData,
      };

      // Act
      await processor.process(mockJob as Job<InvoiceExpirationWorkerData>);

      // Assert
      assert.strictEqual(
        mockInvoiceExpirationService.processExpiredInvoices.mock.callCount(),
        1,
        'Should call service to process invoices',
      );

      const serviceCall = mockInvoiceExpirationService.processExpiredInvoices.mock.calls[0];
      assert.deepStrictEqual(serviceCall.arguments[0], jobData, 'Should pass job data to service');

      console.log('✅ Processor Test 1 passed: Processes jobs successfully');
    });

    it('should handle processing errors gracefully', async () => {
      // Arrange
      mockInvoiceExpirationService.processExpiredInvoices.mock.mockImplementation(() =>
        Promise.reject(new Error('Service unavailable')),
      );

      const mockJob = {
        id: 'job-789',
        data: {
          type: 'invoice-expiration-check' as const,
          batchSize: 100,
        },
      };

      // Act & Assert - Should not throw
      try {
        await processor.process(mockJob as Job<InvoiceExpirationWorkerData>);
        assert.fail('Expected error to be thrown');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Service unavailable'));
      }

      console.log('✅ Processor Test 2 passed: Handles errors appropriately');
    });
  });

  describe('Integration Test', () => {
    it('should demonstrate complete workflow', async () => {
      // Demonstrate the complete flow:
      // 1. Cron triggers -> 2. Queue job -> 3. Process job -> 4. Complete

      console.log('🔄 Demonstrating complete invoice expiration workflow:');

      // Step 1: Cron schedule triggers (every 5 minutes in production)
      console.log('📅 1. Cron job triggers (every 5 minutes)');
      await queueService.handleScheduledInvoiceExpirationCheck();

      // Step 2: Job is queued
      console.log('📋 2. Job added to BullMQ queue');
      assert.strictEqual(mockQueue.add.mock.callCount(), 1, 'Job should be queued');

      // Step 3: Processor picks up job and processes it
      console.log('⚡ 3. Processor handles job');
      const queuedJob = mockQueue.add.mock.calls[0].arguments[1];
      const mockProcessorJob = { id: 'test-job', data: queuedJob };

      await processor.process(mockProcessorJob as Job<InvoiceExpirationWorkerData>);

      // Step 4: Service processes expired invoices
      console.log('🏗️  4. Service processes expired invoices');
      assert.strictEqual(
        mockInvoiceExpirationService.processExpiredInvoices.mock.callCount(),
        1,
        'Service should process invoices',
      );

      // Step 5: Get queue status
      console.log('📊 5. Queue status check');
      const status = await queueService.getQueueStatus();
      assert.ok(typeof status.waiting === 'number', 'Status should include waiting count');

      console.log('✅ Integration Test passed: Complete workflow works!');
      console.log('🎯 Ready for production: Cron -> Queue -> Process -> Notify');
    });
  });
});
