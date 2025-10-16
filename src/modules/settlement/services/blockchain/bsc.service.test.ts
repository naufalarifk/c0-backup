/**
 * Binance Smart Chain Service Unit Tests
 *
 * Tests the BSC blockchain service implementation.
 * Uses mocked ethers.js provider to test without actual blockchain connections.
 */

import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import { Logger } from '@nestjs/common';

import { ethers } from 'ethers';

import { WalletFactory } from '../../../../shared/wallets/wallet.factory';
import { BscService } from './bsc.service';

// Disable NestJS logging during tests
Logger.overrideLogger(false);

describe('BscService - Unit Tests', () => {
  let bscService: BscService;
  let mockWalletFactory: WalletFactory;
  let mockProvider: any;

  beforeEach(() => {
    // Mock WalletFactory
    mockWalletFactory = {
      getBlockchain: mock.fn(() => ({
        getHotWallet: mock.fn(async () => ({
          getAddress: mock.fn(async () => '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'),
        })),
      })),
    } as any;

    // Create service instance
    bscService = new BscService(mockWalletFactory);

    // Mock the provider
    mockProvider = {
      getBalance: mock.fn(async () => ethers.parseEther('1')),
      getTransaction: mock.fn(),
      getTransactionReceipt: mock.fn(),
      getBlock: mock.fn(),
      waitForTransaction: mock.fn(),
      _getConnection: mock.fn(() => ({ url: 'https://bsc-dataseed1.binance.org' })),
    };

    // Replace provider with mock
    (bscService as any)._provider = mockProvider;
  });

  describe('getBlockchainKey', () => {
    it('should return mainnet blockchain key by default', () => {
      const key = bscService.getBlockchainKey();
      strictEqual(key, 'eip155:56');
    });

    // Note: Network is determined at module load time, not instance creation time
    it.skip('should return testnet blockchain key when BSC_USE_TESTNET=true', () => {
      // Skipped: requires module reload
    });
  });

  describe('getNetworkName', () => {
    it('should return mainnet by default', () => {
      const network = bscService.getNetworkName();
      strictEqual(network, 'mainnet');
    });

    // Note: Network is determined at module load time, not instance creation time
    it.skip('should return testnet when BSC_USE_TESTNET=true', () => {
      // Skipped: requires module reload
    });
  });

  describe('getRpcUrl', () => {
    it('should return RPC URL from provider', () => {
      const url = bscService.getRpcUrl();
      strictEqual(url, 'https://bsc-dataseed1.binance.org');
    });
  });

  describe('getBalance', () => {
    it('should get hot wallet balance', async () => {
      mockProvider.getBalance = mock.fn(async () => ethers.parseEther('5.25'));

      const balance = await bscService.getBalance();

      strictEqual(balance, Number(ethers.parseEther('5.25')));
      strictEqual((mockWalletFactory.getBlockchain as any).mock.calls.length, 1);
    });

    it('should throw error for unsupported blockchain', async () => {
      mockWalletFactory.getBlockchain = mock.fn(() => null) as any;

      try {
        await bscService.getBalance();
        throw new Error('Should have thrown error');
      } catch (error: any) {
        ok(error.message.includes('Unsupported blockchain'));
      }
    });
  });

  describe('getAddressBalance', () => {
    it('should get balance for specific address', async () => {
      const testAddress = '0x1234567890123456789012345678901234567890';
      mockProvider.getBalance = mock.fn(async () => ethers.parseEther('0.75'));

      const balance = await bscService.getAddressBalance(testAddress);

      strictEqual(balance, Number(ethers.parseEther('0.75')));
      strictEqual((mockProvider.getBalance as any).mock.calls.length, 1);
      strictEqual((mockProvider.getBalance as any).mock.calls[0].arguments[0], testAddress);
    });

    it('should handle errors gracefully', async () => {
      mockProvider.getBalance = mock.fn(async () => {
        throw new Error('RPC error');
      });

      try {
        await bscService.getAddressBalance('0xtest');
        throw new Error('Should have thrown error');
      } catch (error: any) {
        ok(error.message.includes('Failed to get balance'));
      }
    });
  });

  describe('getTransactionStatus', () => {
    it('should return confirmed status for successful transaction', async () => {
      const mockReceipt = {
        status: 1,
        blockNumber: 23456,
        confirmations: mock.fn(async () => 10),
      };
      const mockBlock = { timestamp: 1634567890 };

      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);
      mockProvider.getBlock = mock.fn(async () => mockBlock);

      const status = await bscService.getTransactionStatus('0xtxhash');

      strictEqual(status.confirmed, true);
      strictEqual(status.success, true);
      strictEqual(status.blockNumber, 23456);
      strictEqual(status.blockTime, 1634567890);
      strictEqual(status.confirmations, 10);
      strictEqual(status.err, null);
    });

    it('should return unconfirmed status for pending transaction', async () => {
      mockProvider.getTransactionReceipt = mock.fn(async () => null);

      const status = await bscService.getTransactionStatus('0xtxhash');

      strictEqual(status.confirmed, false);
      strictEqual(status.success, false);
    });

    it('should return error for failed transaction', async () => {
      const mockReceipt = {
        status: 0,
        blockNumber: 23456,
        confirmations: mock.fn(async () => 5),
      };
      const mockBlock = { timestamp: 1634567890 };

      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);
      mockProvider.getBlock = mock.fn(async () => mockBlock);

      const status = await bscService.getTransactionStatus('0xtxhash');

      strictEqual(status.confirmed, true);
      strictEqual(status.success, false);
      ok(status.err?.revert);
    });
  });

  describe('getTransactionDetails', () => {
    it('should return detailed transaction information', async () => {
      const mockTx = {
        from: '0xfrom',
        to: '0xto',
        value: ethers.parseEther('2'),
        gasPrice: ethers.parseUnits('5', 'gwei'), // BSC has lower gas prices
      };
      const mockReceipt = {
        status: 1,
        blockNumber: 23456,
        gasUsed: 21000n,
      };
      const mockBlock = { timestamp: 1634567890 };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);
      mockProvider.getBlock = mock.fn(async () => mockBlock);

      const details = await bscService.getTransactionDetails('0xtxhash');

      strictEqual(details.success, true);
      strictEqual(details.blockTime, 1634567890);
      strictEqual(details.blockNumber, 23456);
      strictEqual(details.fee, Number(21000n * ethers.parseUnits('5', 'gwei')));
      deepStrictEqual(details.accountKeys, ['0xfrom', '0xto']);
    });

    it('should return not found for missing transaction', async () => {
      mockProvider.getTransaction = mock.fn(async () => null);
      mockProvider.getTransactionReceipt = mock.fn(async () => null);

      const details = await bscService.getTransactionDetails('0xtxhash');

      strictEqual(details.success, false);
    });
  });

  describe('waitForConfirmation', () => {
    it('should wait for transaction confirmation', async () => {
      const mockReceipt = {
        status: 1,
        blockNumber: 23456,
      };

      mockProvider.waitForTransaction = mock.fn(async () => mockReceipt);

      const result = await bscService.waitForConfirmation('0xtxhash', 'confirmed', 30);

      strictEqual(result.confirmed, true);
      strictEqual(result.success, true);
      strictEqual(result.blockNumber, 23456);
      strictEqual((mockProvider.waitForTransaction as any).mock.calls[0].arguments[1], 3); // 3 confirmations for 'confirmed'
    });

    it('should require more confirmations for finalized commitment', async () => {
      const mockReceipt = {
        status: 1,
        blockNumber: 23456,
      };

      mockProvider.waitForTransaction = mock.fn(async () => mockReceipt);

      await bscService.waitForConfirmation('0xtxhash', 'finalized', 60);

      strictEqual((mockProvider.waitForTransaction as any).mock.calls[0].arguments[1], 15); // 15 confirmations for 'finalized'
    });

    it('should handle timeout', async () => {
      mockProvider.waitForTransaction = mock.fn(async () => {
        throw new Error('Timeout');
      });

      const result = await bscService.waitForConfirmation('0xtxhash', 'confirmed', 10);

      strictEqual(result.confirmed, false);
      strictEqual(result.success, false);
      ok(result.err?.timeout);
    });
  });

  describe('verifyTransfer', () => {
    it('should verify successful transfer', async () => {
      const expectedAmount = Number(ethers.parseEther('2'));
      const mockTx = {
        from: '0xFROM',
        to: '0xTO',
        value: ethers.parseEther('2'),
        gasPrice: ethers.parseUnits('5', 'gwei'),
      };
      const mockReceipt = {
        status: 1,
        gasUsed: 21000n,
      };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);

      const result = await bscService.verifyTransfer(
        '0xtxhash',
        '0xfrom', // lowercase
        '0xto', // lowercase
        expectedAmount,
      );

      strictEqual(result.verified, true);
      strictEqual(result.success, true);
      strictEqual(result.actualAmount, expectedAmount);
      strictEqual(result.from, '0xFROM');
      strictEqual(result.to, '0xTO');
      ok(result.fee && result.fee > 0);
    });

    it('should detect address mismatch', async () => {
      const mockTx = {
        from: '0xWRONG',
        to: '0xTO',
        value: ethers.parseEther('1'),
        gasPrice: ethers.parseUnits('5', 'gwei'),
      };
      const mockReceipt = {
        status: 1,
        gasUsed: 21000n,
      };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);

      const result = await bscService.verifyTransfer(
        '0xtxhash',
        '0xfrom',
        '0xto',
        Number(ethers.parseEther('1')),
      );

      strictEqual(result.verified, false);
      ok(result.errors && result.errors.length > 0);
      ok(result.errors.some(e => e.includes('From address mismatch')));
    });

    it('should detect amount mismatch', async () => {
      const mockTx = {
        from: '0xfrom',
        to: '0xto',
        value: ethers.parseEther('5'), // Wrong amount
        gasPrice: ethers.parseUnits('5', 'gwei'),
      };
      const mockReceipt = {
        status: 1,
        gasUsed: 21000n,
      };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);

      const result = await bscService.verifyTransfer(
        '0xtxhash',
        '0xfrom',
        '0xto',
        Number(ethers.parseEther('2')),
      );

      strictEqual(result.verified, false);
      ok(result.errors && result.errors.some(e => e.includes('Amount mismatch')));
    });
  });

  describe('getTransactionForMatching', () => {
    it('should return formatted transaction for matching', async () => {
      const mockTx = {
        from: '0xfrom',
        to: '0xto',
        value: ethers.parseEther('3.25'),
        gasPrice: ethers.parseUnits('5', 'gwei'),
      };
      const mockReceipt = {
        status: 1,
        blockNumber: 23456,
        gasUsed: 21000n,
        confirmations: mock.fn(async () => 8),
      };
      const mockBlock = { timestamp: 1634567890 };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);
      mockProvider.getBlock = mock.fn(async () => mockBlock);

      const result = await bscService.getTransactionForMatching('0xtxhash');

      strictEqual(result.found, true);
      strictEqual(result.confirmed, true);
      strictEqual(result.success, true);
      strictEqual(result.amount, '3.25'); // BNB, not wei
      strictEqual(result.from, '0xfrom');
      strictEqual(result.to, '0xto');
      strictEqual(result.blockTime, 1634567890);
      strictEqual(result.blockNumber, 23456);
      strictEqual(result.confirmations, 8);
      ok(result.fee);
      ok(result.raw);
    });

    it('should return not found for missing transaction', async () => {
      mockProvider.getTransaction = mock.fn(async () => null);
      mockProvider.getTransactionReceipt = mock.fn(async () => null);

      const result = await bscService.getTransactionForMatching('0xtxhash');

      strictEqual(result.found, false);
      strictEqual(result.confirmed, false);
      strictEqual(result.success, false);
    });
  });

  describe('getAddressBalanceChange', () => {
    it('should calculate balance change for sender', async () => {
      const testAddress = '0xfrom';
      const mockTx = {
        from: testAddress.toLowerCase(),
        to: '0xto',
        value: ethers.parseEther('2'),
        gasPrice: ethers.parseUnits('5', 'gwei'),
      };
      const mockReceipt = {
        status: 1,
        gasUsed: 21000n,
      };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);

      const result = await bscService.getAddressBalanceChange('0xtxhash', testAddress);

      strictEqual(result.found, true);
      strictEqual(result.success, true);
      ok(result.balanceChange < 0); // Sender loses balance
    });

    it('should calculate balance change for receiver', async () => {
      const testAddress = '0xto';
      const mockTx = {
        from: '0xfrom',
        to: testAddress.toLowerCase(),
        value: ethers.parseEther('2'),
        gasPrice: ethers.parseUnits('5', 'gwei'),
      };
      const mockReceipt = {
        status: 1,
        gasUsed: 21000n,
      };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);

      const result = await bscService.getAddressBalanceChange('0xtxhash', testAddress);

      strictEqual(result.found, true);
      strictEqual(result.success, true);
      strictEqual(result.balanceChange, Number(ethers.parseEther('2'))); // Receiver gains balance
    });

    it('should return zero for uninvolved address', async () => {
      const testAddress = '0xother';
      const mockTx = {
        from: '0xfrom',
        to: '0xto',
        value: ethers.parseEther('2'),
        gasPrice: ethers.parseUnits('5', 'gwei'),
      };
      const mockReceipt = {
        status: 1,
        gasUsed: 21000n,
      };

      mockProvider.getTransaction = mock.fn(async () => mockTx);
      mockProvider.getTransactionReceipt = mock.fn(async () => mockReceipt);

      const result = await bscService.getAddressBalanceChange('0xtxhash', testAddress);

      strictEqual(result.found, false);
      strictEqual(result.success, true);
      strictEqual(result.balanceChange, 0);
    });
  });
});
