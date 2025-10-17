import type {
  BalanceCollectionRequest,
  BalanceCollectionResult,
} from '../balance-collection.types';

import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { WalletFactory } from '../../../shared/wallets/wallet.factory';
import { WalletService } from '../../../shared/wallets/wallet.service';
import { BlockchainNetworkEnum } from '../balance-collection.types';
import { BitcoinBalanceCollector } from './bitcoin-balance.collector';
import { BSCBalanceCollector } from './bsc-balance.collector';
import { EVMBalanceCollector } from './evm-balance.collector';
import { SolanaBalanceCollector } from './solana-balance.collector';

interface MockWalletFactory {
  getBlockchain: ReturnType<typeof mock.fn>;
}

interface MockWallet {
  getAddress: ReturnType<typeof mock.fn>;
  transfer: ReturnType<typeof mock.fn>;
}

interface MockBlockchain {
  derivedPathToWallet: ReturnType<typeof mock.fn>;
  getHotWallet: ReturnType<typeof mock.fn>;
}

describe('Balance Collectors Tests', () => {
  let mockAppConfig: AppConfigService;
  let mockWalletFactory: MockWalletFactory;
  let mockWallet: MockWallet;
  let mockBlockchain: MockBlockchain;

  beforeEach(() => {
    mockAppConfig = {
      blockchains: {
        /** @TODO add blockchain for test */
      },
    } as Partial<AppConfigService> as unknown as AppConfigService;
    // Mock wallet
    mockWallet = {
      getAddress: mock.fn(() => Promise.resolve('0xMockAddress')),
      transfer: mock.fn(() =>
        Promise.resolve({
          txHash: '0xMockTransactionHash123456789',
        }),
      ),
    };

    // Mock blockchain
    mockBlockchain = {
      derivedPathToWallet: mock.fn(() => Promise.resolve(mockWallet)),
      getHotWallet: mock.fn(() => Promise.resolve(mockWallet)),
    };

    // Mock wallet factory
    mockWalletFactory = {
      getBlockchain: mock.fn(() => mockBlockchain),
    };
  });

  afterEach(() => {
    mock.reset();
  });

  describe('EVMBalanceCollector', () => {
    let collector: EVMBalanceCollector;

    beforeEach(() => {
      collector = new EVMBalanceCollector(
        mockAppConfig,
        mockWalletFactory as unknown as WalletFactory,
      );
    });

    it('should handle EVM blockchains', () => {
      const request: BalanceCollectionRequest = {
        blockchainKey: 'eip155:1',
        walletAddress: '0xTest',
        walletDerivationPath: "m/44'/60'/5'/0/123",
      };

      assert.strictEqual(collector.canHandle(request), true);
    });

    it('should skip collection when balance is zero', async () => {
      // Mock checkBalance to return 0
      mock.method(
        collector as unknown as { checkBalance: () => Promise<string> },
        'checkBalance',
        () => Promise.resolve('0'),
      );

      const request: BalanceCollectionRequest = {
        blockchainKey: 'eip155:1',
        walletAddress: '0xTest',
        walletDerivationPath: "m/44'/60'/5'/0/123",
      };

      const result = await collector.collect(request);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.skipReason, 'Zero balance');
    });

    it('should skip collection when balance is too small for gas', async () => {
      // Mock checkBalance to return very small amount (less than gas reserve)
      mock.method(
        collector as unknown as { checkBalance: () => Promise<string> },
        'checkBalance',
        () => Promise.resolve('10000'), // 10,000 wei - less than gas reserve
      );

      const request: BalanceCollectionRequest = {
        blockchainKey: 'eip155:1',
        walletAddress: '0xTest',
        walletDerivationPath: "m/44'/60'/5'/0/123",
      };

      const result = await collector.collect(request);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.skipped, true);
      assert.ok(result.skipReason?.includes('Balance too small'));
    });

    it('should successfully collect balance when sufficient', async () => {
      // Mock checkBalance to return sufficient amount
      const mockBalance = '1000000000000000000'; // 1 ETH
      mock.method(
        collector as unknown as { checkBalance: () => Promise<string> },
        'checkBalance',
        () => Promise.resolve(mockBalance),
      );

      // Mock transferToHotWallet
      mock.method(
        collector as unknown as {
          transferToHotWallet: (
            a: string,
            b: string,
            c: string,
          ) => Promise<{ txHash: string; transferredAmount: string }>;
        },
        'transferToHotWallet',
        () =>
          Promise.resolve({
            txHash: '0xTransferHash',
            transferredAmount: '980000000000000000', // 0.98 ETH after gas
          }),
      );

      const request: BalanceCollectionRequest = {
        blockchainKey: 'eip155:1',
        walletAddress: '0xTest',
        walletDerivationPath: "m/44'/60'/5'/0/123",
      };

      const result = await collector.collect(request);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.balance, mockBalance);
      assert.strictEqual(result.transactionHash, '0xTransferHash');
      assert.strictEqual(result.transferredAmount, '980000000000000000');
    });
  });

  describe('BSCBalanceCollector', () => {
    let collector: BSCBalanceCollector;

    beforeEach(() => {
      collector = new BSCBalanceCollector(
        mockAppConfig,
        mockWalletFactory as unknown as WalletFactory,
      );
    });

    it('should handle BSC mainnet', () => {
      const request: BalanceCollectionRequest = {
        blockchainKey: 'eip155:56',
        walletAddress: '0xTest',
        walletDerivationPath: "m/44'/60'/5'/0/123",
      };

      assert.strictEqual(collector.canHandle(request), true);
    });

    it('should use BSC RPC URL', () => {
      const rpcUrl = (collector as unknown as { getRpcUrl: () => string }).getRpcUrl();
      assert.ok(rpcUrl.includes('bsc') || rpcUrl.includes('binance'));
    });
  });

  describe('BitcoinBalanceCollector', () => {
    let collector: BitcoinBalanceCollector;

    beforeEach(() => {
      collector = new BitcoinBalanceCollector(mockWalletFactory as unknown as WalletFactory);
    });

    it('should handle Bitcoin mainnet', () => {
      const request: BalanceCollectionRequest = {
        blockchainKey: BlockchainNetworkEnum.BitcoinMainnet,
        walletAddress: 'bc1qTest123',
        walletDerivationPath: "m/44'/0'/5'/0/123",
      };

      assert.strictEqual(collector.canHandle(request), true);
    });

    it('should skip collection when balance is zero', async () => {
      // Mock checkBalance to return 0
      mock.method(
        collector as unknown as { checkBalance: () => Promise<string> },
        'checkBalance',
        () => Promise.resolve('0'),
      );

      const request: BalanceCollectionRequest = {
        blockchainKey: BlockchainNetworkEnum.BitcoinMainnet,
        walletAddress: 'bc1qTest123',
        walletDerivationPath: "m/44'/0'/5'/0/123",
      };

      const result = await collector.collect(request);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.skipReason, 'Zero balance');
    });

    it('should skip collection when balance is too small for fees', async () => {
      // Mock checkBalance to return small amount (less than minimum)
      const smallBalance = '5000'; // 5,000 satoshis - less than 10,000 minimum
      mock.method(
        collector as unknown as { checkBalance: () => Promise<string> },
        'checkBalance',
        () => Promise.resolve(smallBalance),
      );

      const request: BalanceCollectionRequest = {
        blockchainKey: BlockchainNetworkEnum.BitcoinMainnet,
        walletAddress: 'bc1qTest123',
        walletDerivationPath: "m/44'/0'/5'/0/123",
      };

      const result = await collector.collect(request);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.skipped, true);
      assert.ok(result.skipReason?.includes('Balance too small'));
    });

    it('should successfully collect balance when sufficient', async () => {
      // Mock checkBalance to return sufficient amount
      const mockBalance = '100000000'; // 1 BTC in satoshis
      mock.method(
        collector as unknown as { checkBalance: () => Promise<string> },
        'checkBalance',
        () => Promise.resolve(mockBalance),
      );

      // Mock transferToHotWallet
      const expectedTransferred = '99990000'; // 0.9999 BTC after minimum balance
      mock.method(
        collector as unknown as {
          transferToHotWallet: (
            a: string,
            b: string,
            c: string,
          ) => Promise<{ txHash: string; transferredAmount: string }>;
        },
        'transferToHotWallet',
        () =>
          Promise.resolve({
            txHash: 'BitcoinTransactionHash123',
            transferredAmount: expectedTransferred,
          }),
      );

      const request: BalanceCollectionRequest = {
        blockchainKey: BlockchainNetworkEnum.BitcoinMainnet,
        walletAddress: 'bc1qTest123',
        walletDerivationPath: "m/44'/0'/5'/0/123",
      };

      const result = await collector.collect(request);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.balance, mockBalance);
      assert.strictEqual(result.transactionHash, 'BitcoinTransactionHash123');
      assert.strictEqual(result.transferredAmount, expectedTransferred);
    });

    it('should handle errors gracefully', async () => {
      // Mock checkBalance to throw an error
      mock.method(
        collector as unknown as { checkBalance: () => Promise<string> },
        'checkBalance',
        () => Promise.reject(new Error('Network error')),
      );

      const request: BalanceCollectionRequest = {
        blockchainKey: BlockchainNetworkEnum.BitcoinMainnet,
        walletAddress: 'bc1qTest123',
        walletDerivationPath: "m/44'/0'/5'/0/123",
      };

      const result = await collector.collect(request);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.balance, '0');
      assert.ok(result.error?.includes('Network error'));
    });
  });

  describe('Collector Factory Pattern', () => {
    it('should use correct blockchain identifiers', () => {
      const evmCollector = new EVMBalanceCollector(
        mockAppConfig,
        mockWalletFactory as unknown as WalletFactory,
      );
      const _bscCollector = new BSCBalanceCollector(
        mockAppConfig,
        mockWalletFactory as unknown as WalletFactory,
      );
      const solanaCollector = new SolanaBalanceCollector(
        mockAppConfig,
        mockWalletFactory as unknown as WalletFactory,
      );
      const bitcoinCollector = new BitcoinBalanceCollector(
        mockWalletFactory as unknown as WalletFactory,
      );

      // Test that each collector handles only its blockchain
      const ethereumRequest: BalanceCollectionRequest = {
        blockchainKey: 'eip155:1',
        walletAddress: '0x123',
        walletDerivationPath: "m/44'/60'/5'/0/1",
      };

      const bscRequest: BalanceCollectionRequest = {
        blockchainKey: 'eip155:56',
        walletAddress: '0x456',
        walletDerivationPath: "m/44'/60'/5'/0/2",
      };

      const sepoliaRequest: BalanceCollectionRequest = {
        blockchainKey: 'eip155:11155111',
        walletAddress: '0x789',
        walletDerivationPath: "m/44'/60'/5'/0/3",
      };

      const solanaRequest: BalanceCollectionRequest = {
        blockchainKey: BlockchainNetworkEnum.SolanaMainnet,
        walletAddress: 'Sol123',
        walletDerivationPath: "m/44'/501'/5'/0/4",
      };

      const bitcoinRequest: BalanceCollectionRequest = {
        blockchainKey: BlockchainNetworkEnum.BitcoinMainnet,
        walletAddress: 'bc1q123',
        walletDerivationPath: "m/44'/0'/5'/0/5",
      };

      // Each collector should handle all EVM chains
      assert.strictEqual(evmCollector.canHandle(ethereumRequest), true);
      assert.strictEqual(evmCollector.canHandle(bscRequest), true);
      assert.strictEqual(evmCollector.canHandle(sepoliaRequest), true);
      assert.strictEqual(evmCollector.canHandle(solanaRequest), false);
      assert.strictEqual(evmCollector.canHandle(bitcoinRequest), false);

      // Solana collector should only handle Solana
      assert.strictEqual(solanaCollector.canHandle(solanaRequest), true);
      assert.strictEqual(solanaCollector.canHandle(ethereumRequest), false);

      // Bitcoin collector should only handle Bitcoin
      assert.strictEqual(bitcoinCollector.canHandle(bitcoinRequest), true);
      assert.strictEqual(bitcoinCollector.canHandle(ethereumRequest), false);
    });
  });
});
