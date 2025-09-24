import assert from 'node:assert';
import { beforeEach, describe, test } from 'node:test';
import path from 'path';

import { Test, TestingModule } from '@nestjs/testing';

// Load environment variables
import { SolanaService } from './sol.service';

// Ensure SOL_RPC_URL is available for tests
if (!process.env.SOL_RPC_URL) {
  throw new Error('SOL_RPC_URL not found in environment variables');
}

describe('SolanaService', () => {
  let service: SolanaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SolanaService],
    }).compile();

    service = module.get<SolanaService>(SolanaService);
  });

  describe('constructor', () => {
    test('should be defined', () => {
      assert.ok(service);
    });

    test('should initialize with Solana connection', () => {
      assert.ok(service instanceof SolanaService);
    });
  });

  describe('onModuleInit', () => {
    test('should log initialization message', t => {
      const consoleSpy = t.mock.method(console, 'log');
      service.onModuleInit();
      assert.strictEqual(consoleSpy.mock.callCount(), 1);
      assert.deepStrictEqual(consoleSpy.mock.calls[0].arguments, ['Solana service initialized']);
    });
  });

  describe('getCurrentSlot', () => {
    test('should fetch current slot', async t => {
      const mockSlot = 12345;
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const connectionMock = t.mock.method((service as any).connection, 'getSlot', () =>
        Promise.resolve(mockSlot),
      );

      const result = await service.getCurrentSlot();

      assert.strictEqual(result, mockSlot);
      assert.strictEqual(connectionMock.mock.callCount(), 1);
    });

    test('should handle errors when fetching current slot', async t => {
      const error = new Error('Slot fetch failed');
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const _connectionMock = t.mock.method((service as any).connection, 'getSlot', () =>
        Promise.reject(error),
      );

      await assert.rejects(() => service.getCurrentSlot(), { message: 'Slot fetch failed' });
    });
  });

  describe('getBlock', () => {
    test('should fetch block by slot', async t => {
      const slot = 12345;
      const mockBlock = {
        blockTime: 1234567890,
        transactions: [],
      };
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const connectionMock = t.mock.method((service as any).connection, 'getBlock', () =>
        Promise.resolve(mockBlock),
      );

      const result = await service.getBlock(slot);

      assert.strictEqual(result, mockBlock);
      assert.strictEqual(connectionMock.mock.callCount(), 1);
      assert.deepStrictEqual(connectionMock.mock.calls[0].arguments, [
        slot,
        {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        },
      ]);
    });

    test('should handle errors when fetching block', async t => {
      const slot = 12345;
      const error = new Error('Block not found');
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const connectionMock = t.mock.method((service as any).connection, 'getBlock', () =>
        Promise.reject(error),
      );

      const result = await service.getBlock(slot);

      assert.strictEqual(result, null);
      assert.strictEqual(connectionMock.mock.callCount(), 1);
    });
  });

  describe('getAccountInfo', () => {
    test('should fetch account info', async t => {
      const publicKey = '11111111111111111111111111111112'; // Valid base58 public key
      const mockAccountInfo = {
        data: Buffer.from('test'),
        executable: false,
        lamports: 1000000,
        owner: 'mockOwner',
      };
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const connectionMock = t.mock.method((service as any).connection, 'getAccountInfo', () =>
        Promise.resolve(mockAccountInfo),
      );

      const result = await service.getAccountInfo(publicKey);

      assert.strictEqual(result, mockAccountInfo);
      assert.strictEqual(connectionMock.mock.callCount(), 1);
    });

    test('should handle errors when fetching account info', async t => {
      const publicKey = '11111111111111111111111111111112'; // Valid base58 public key
      const error = new Error('Account not found');
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const _connectionMock = t.mock.method((service as any).connection, 'getAccountInfo', () =>
        Promise.reject(error),
      );

      await assert.rejects(() => service.getAccountInfo(publicKey), {
        message: 'Account not found',
      });
    });
  });

  describe('isHealthy', () => {
    test('should return true when connection is healthy', async t => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const _connectionMock = t.mock.method((service as any).connection, 'getSlot', () =>
        Promise.resolve(12345),
      );

      const result = await service.isHealthy();

      assert.strictEqual(result, true);
    });

    test('should return false when connection check fails', async t => {
      const consoleSpy = t.mock.method(console, 'error');
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const _connectionMock = t.mock.method((service as any).connection, 'getSlot', () =>
        Promise.reject(new Error('Connection failed')),
      );

      const result = await service.isHealthy();

      assert.strictEqual(result, false);
      assert.strictEqual(consoleSpy.mock.callCount(), 1);
      assert.strictEqual(
        consoleSpy.mock.calls[0].arguments[0],
        'Solana connection health check failed:',
      );
      assert.ok(consoleSpy.mock.calls[0].arguments[1] instanceof Error);
    });
  });
});
