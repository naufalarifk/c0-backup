import type { Job } from 'bullmq';
import type { WalletBalanceCollectionJobData } from './wallet-balance-collector.types';

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { WalletBalanceCollectorProcessor } from './wallet-balance-collector.processor';
import { WalletBalanceCollectorQueueService } from './wallet-balance-collector.queue.service';

interface MockQueue {
  add: ReturnType<typeof mock.fn>;
  getWaiting: ReturnType<typeof mock.fn>;
  getActive: ReturnType<typeof mock.fn>;
  getCompleted: ReturnType<typeof mock.fn>;
  getFailed: ReturnType<typeof mock.fn>;
}

interface MockWalletBalanceCollectorService {
  collectBalance: ReturnType<typeof mock.fn>;
}

describe('Wallet Balance Collector Queue & Processor Tests', () => {
  let queueService: WalletBalanceCollectorQueueService;
  let processor: WalletBalanceCollectorProcessor;
  let mockQueue: MockQueue;
  let mockWalletBalanceCollectorService: MockWalletBalanceCollectorService;

  beforeEach(() => {
    // Mock BullMQ queue
    mockQueue = {
      add: mock.fn(() => Promise.resolve({ id: 'job-123' })),
      getWaiting: mock.fn(() => Promise.resolve([])),
      getActive: mock.fn(() => Promise.resolve([])),
      getCompleted: mock.fn(() => Promise.resolve([])),
      getFailed: mock.fn(() => Promise.resolve([])),
    };

    // Mock wallet balance collector service
    mockWalletBalanceCollectorService = {
      collectBalance: mock.fn(() =>
        Promise.resolve({
          success: true,
          balance: '1000000000000000000', // 1 ETH in wei
          transferredAmount: '900000000000000000', // 0.9 ETH after gas
          transactionHash: '0x1234567890abcdef',
        }),
      ),
    };

    // Create service instances with type assertions
    // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any for complex interfaces
    queueService = new WalletBalanceCollectorQueueService(mockQueue as any);
    // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any for complex interfaces
    processor = new WalletBalanceCollectorProcessor(mockWalletBalanceCollectorService as any);
  });

  afterEach(() => {
    mock.reset();
  });

  describe('WalletBalanceCollectorQueueService', () => {
    it('should queue wallet balance collection job', async () => {
      // Arrange
      const jobData: WalletBalanceCollectionJobData = {
        invoiceId: '123',
        blockchainKey: 'eip155:1',
        walletAddress: '0xABC123',
        walletDerivationPath: "m/44'/60'/5'/0/123",
        transactionHash: '0xDEF456',
        paidAmount: '5000000000000000000', // 5 ETH
      };

      // Act
      await queueService.enqueueBalanceCollection(jobData);

      // Assert
      assert.strictEqual(mockQueue.add.mock.callCount(), 1, 'Should add job to queue');

      const addCall = mockQueue.add.mock.calls[0];
      assert.strictEqual(
        addCall.arguments[0],
        'wallet-balance-collection',
        'Job name should be wallet-balance-collection',
      );
      assert.deepStrictEqual(addCall.arguments[1], jobData, 'Job data should match input data');
    });

    it('should use default options when not provided', async () => {
      // Arrange
      const jobData: WalletBalanceCollectionJobData = {
        invoiceId: '456',
        blockchainKey: 'eip155:56',
        walletAddress: '0xXYZ789',
        walletDerivationPath: "m/44'/60'/5'/0/456",
      };

      // Act
      await queueService.enqueueBalanceCollection(jobData);

      // Assert
      const addCall = mockQueue.add.mock.calls[0];
      const options = addCall.arguments[2];
      assert.strictEqual(options.attempts, 5, 'Default attempts should be 5');
      assert.strictEqual(options.priority, 5, 'Default priority should be 5');
    });
  });

  describe('WalletBalanceCollectorProcessor', () => {
    it('should process wallet balance collection job', async () => {
      // Arrange
      const jobData: WalletBalanceCollectionJobData = {
        invoiceId: '789',
        blockchainKey: 'eip155:1',
        walletAddress: '0xTEST',
        walletDerivationPath: "m/44'/60'/5'/0/789",
        transactionHash: '0xABCDEF',
      };

      const mockJob = {
        id: 'job-456',
        data: jobData,
      } as Job<WalletBalanceCollectionJobData>;

      // Act
      await processor.process(mockJob);

      // Assert
      assert.strictEqual(
        mockWalletBalanceCollectorService.collectBalance.mock.callCount(),
        1,
        'Should call collectBalance once',
      );

      const collectCall = mockWalletBalanceCollectorService.collectBalance.mock.calls[0];
      assert.strictEqual(collectCall.arguments[0].invoiceId, '789', 'Should pass invoice ID');
      assert.strictEqual(
        collectCall.arguments[0].blockchainKey,
        'eip155:1',
        'Should pass blockchain key',
      );
      assert.strictEqual(
        collectCall.arguments[0].walletAddress,
        '0xTEST',
        'Should pass wallet address',
      );
      assert.strictEqual(
        collectCall.arguments[0].walletDerivationPath,
        "m/44'/60'/5'/0/789",
        'Should pass derivation path',
      );
    });
  });
});
