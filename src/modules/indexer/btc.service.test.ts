import assert from 'node:assert';
import { beforeEach, describe, test } from 'node:test';
import path from 'path';

import { Test, TestingModule } from '@nestjs/testing';

import { BitcoinService } from './btc.service';

// Ensure BTC_RPC_URL is available for tests
if (!process.env.BTC_RPC_URL) {
  throw new Error('BTC_RPC_URL not found in environment variables');
}

describe('BitcoinService', () => {
  let service: BitcoinService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitcoinService],
    }).compile();

    service = module.get<BitcoinService>(BitcoinService);
  });

  describe('constructor', () => {
    test('should be defined', () => {
      assert.ok(service);
    });

    test('should initialize with environment variables', () => {
      assert.ok(service instanceof BitcoinService);
    });
  });

  describe('onModuleInit', () => {
    test('should log initialization message', t => {
      const consoleSpy = t.mock.method(console, 'log');
      service.onModuleInit();
      assert.strictEqual(consoleSpy.mock.callCount(), 1);
      assert.deepStrictEqual(consoleSpy.mock.calls[0].arguments, ['Bitcoin service initialized']);
    });
  });

  describe('onNewBlock', () => {
    test('should create observable that emits block updates', async t => {
      const _getCurrentBlockHeightSpy = t.mock.method(service, 'getCurrentBlockHeight', () =>
        Promise.resolve(100),
      );
      const _getBlockHashSpy = t.mock.method(service, 'getBlockHash', () =>
        Promise.resolve('test-hash'),
      );
      const _getBlockSpy = t.mock.method(service, 'getBlock', () =>
        Promise.resolve({
          hash: 'test-hash',
          height: 100,
          time: 1234567890,
          tx: ['tx1', 'tx2'],
          size: 1000000,
          weight: 4000000,
        }),
      );

      const observable = service.onNewBlock();

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test timeout - observable did not emit within expected time'));
        }, 5000); // 5 second timeout

        const subscription = observable.subscribe({
          next: data => {
            try {
              assert.deepStrictEqual(data, {
                height: 100,
                hash: 'test-hash',
                timestamp: 1234567890000,
                transactions: ['tx1', 'tx2'],
                size: 1000000,
                weight: 4000000,
                method: 'polling',
              });
              clearTimeout(timeout);
              subscription.unsubscribe(); // Stop the polling
              resolve();
            } catch (error) {
              clearTimeout(timeout);
              subscription.unsubscribe();
              reject(error);
            }
          },
          error: error => {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });
    });
  });

  describe('getCurrentBlockHeight', () => {
    test('should return current block height', async t => {
      const mockHeight = 2500123;
      // biome-ignore lint/suspicious/noExplicitAny: Required for testing private methods
      const _makeRpcCallSpy = t.mock.method(service as any, 'makeRpcCall', () =>
        Promise.resolve(mockHeight),
      );

      const result = await service.getCurrentBlockHeight();

      assert.strictEqual(result, mockHeight);
    });

    test('should handle errors', async t => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const _makeRpcCallSpy = t.mock.method(service as any, 'makeRpcCall', () =>
        Promise.reject(new Error('RPC error')),
      );

      await assert.rejects(() => service.getCurrentBlockHeight(), { message: 'RPC error' });
    });
  });

  describe('getBlockHash', () => {
    test('should return block hash for given height', async t => {
      const height = 123456;
      const mockHash = '000000000000001234567890abcdef';
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const makeRpcCallSpy = t.mock.method(service as any, 'makeRpcCall', () =>
        Promise.resolve(mockHash),
      );

      const result = await service.getBlockHash(height);

      assert.strictEqual(result, mockHash);
      assert.strictEqual(makeRpcCallSpy.mock.callCount(), 1);
      assert.deepStrictEqual(makeRpcCallSpy.mock.calls[0].arguments, ['getblockhash', [height]]);
    });
  });

  describe('getBlock', () => {
    test('should return block data for given hash', async t => {
      const hash = '000000000000001234567890abcdef';
      const mockBlock = {
        hash,
        height: 123456,
        time: 1234567890,
        tx: ['tx1', 'tx2', 'tx3'],
        size: 1500000,
        weight: 6000000,
      };
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const makeRpcCallSpy = t.mock.method(service as any, 'makeRpcCall', () =>
        Promise.resolve(mockBlock),
      );

      const result = await service.getBlock(hash);

      assert.deepStrictEqual(result, mockBlock);
      assert.strictEqual(makeRpcCallSpy.mock.callCount(), 1);
      assert.deepStrictEqual(makeRpcCallSpy.mock.calls[0].arguments, ['getblock', [hash]]);
    });
  });

  describe('getTransaction', () => {
    test('should return transaction data for given txid', async t => {
      const txid = 'abc123def456';
      const mockTx = {
        txid,
        size: 250,
        vsize: 141,
        weight: 562,
      };
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const makeRpcCallSpy = t.mock.method(service as any, 'makeRpcCall', () =>
        Promise.resolve(mockTx),
      );

      const result = await service.getTransaction(txid);

      assert.deepStrictEqual(result, mockTx);
      assert.strictEqual(makeRpcCallSpy.mock.callCount(), 1);
      assert.deepStrictEqual(makeRpcCallSpy.mock.calls[0].arguments, [
        'getrawtransaction',
        [txid, true],
      ]);
    });
  });

  describe('isHealthy', () => {
    test('should return true when connection is healthy', async t => {
      const _getCurrentBlockHeightSpy = t.mock.method(service, 'getCurrentBlockHeight', () =>
        Promise.resolve(123456),
      );

      const result = await service.isHealthy();

      assert.strictEqual(result, true);
    });

    test('should return false when connection check fails', async t => {
      const consoleSpy = t.mock.method(console, 'error');
      const _getCurrentBlockHeightSpy = t.mock.method(service, 'getCurrentBlockHeight', () =>
        Promise.reject(new Error('Connection failed')),
      );

      const result = await service.isHealthy();

      assert.strictEqual(result, false);
      assert.strictEqual(consoleSpy.mock.callCount(), 1);
      assert.strictEqual(
        consoleSpy.mock.calls[0].arguments[0],
        'Bitcoin connection health check failed:',
      );
      assert.ok(consoleSpy.mock.calls[0].arguments[1] instanceof Error);
    });
  });

  describe('simulateBitcoinRpc', () => {
    test('should simulate getblockcount', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const result = await (service as any).simulateBitcoinRpc('getblockcount', []);
      assert.strictEqual(typeof result, 'number');
      assert.ok(result > 2500000);
    });

    test('should simulate getblockhash', async () => {
      const height = 123456;
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const result = await (service as any).simulateBitcoinRpc('getblockhash', [height]);
      assert.ok(result.includes('000000000000'));
      assert.ok(result.includes(height.toString().padStart(10, '0')));
    });

    test('should simulate getblock', async () => {
      const hash = '000000000000001234567890abcdef';
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const result = await (service as any).simulateBitcoinRpc('getblock', [hash]);
      assert.strictEqual(result.hash, hash);
      assert.ok('height' in result);
      assert.ok('time' in result);
      assert.ok('tx' in result);
      assert.ok('size' in result);
      assert.ok('weight' in result);
    });

    test('should simulate getrawtransaction', async () => {
      const txid = 'test-txid';
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      const result = await (service as any).simulateBitcoinRpc('getrawtransaction', [txid]);
      assert.strictEqual(result.txid, txid);
      assert.ok('size' in result);
      assert.ok('weight' in result);
    });

    test('should throw error for unsupported method', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing/legacy code requires any
      await assert.rejects(() => (service as any).simulateBitcoinRpc('unsupported', []), {
        message: 'Unsupported RPC method: unsupported',
      });
    });
  });
});
