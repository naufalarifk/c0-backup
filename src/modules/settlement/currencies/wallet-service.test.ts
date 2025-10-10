import type { Mock } from 'node:test';
import type { Wallet } from '../../../shared/wallets/wallet.abstract';
import type { HotWallet, WalletService } from '../../../shared/wallets/wallet.service';

import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SettlementWalletService } from './wallet.service';

// Helper type for mocked functions
type MockedFunction<T extends (...args: unknown[]) => unknown> = Mock<T>;

describe('SettlementWalletService', () => {
  describe('getHotWallet', () => {
    it('should successfully get hot wallet for a blockchain', async () => {
      // Setup: Create mock wallet service
      const mockWallet: Wallet = {
        getAddress: mock.fn(async () => '0x1234567890123456789012345678901234567890'),
      } as unknown as Wallet;

      const expectedHotWallet: HotWallet = {
        blockchainKey: 'eip155:1',
        address: '0x1234567890123456789012345678901234567890',
        bip44CoinType: 60,
        wallet: mockWallet,
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async (blockchainKey: string) => {
          strictEqual(blockchainKey, 'eip155:1', 'Should request correct blockchain key');
          return expectedHotWallet;
        }),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallet('eip155:1');

      // Verify
      ok(result, 'Result should be defined');
      strictEqual(result.blockchainKey, 'eip155:1', 'Blockchain key should match');
      strictEqual(
        result.address,
        '0x1234567890123456789012345678901234567890',
        'Address should match',
      );
      strictEqual(result.bip44CoinType, 60, 'BIP44 coin type should be 60 for Ethereum');
      ok(result.wallet, 'Wallet instance should be present');
      strictEqual(
        (mockWalletService.getHotWallet as unknown as ReturnType<typeof mock.fn>).mock.calls.length,
        1,
        'getHotWallet should be called once',
      );
    });

    it('should get hot wallet for BSC (Binance Smart Chain)', async () => {
      // Setup: BSC hot wallet
      const mockWallet: Wallet = {
        getAddress: mock.fn(async () => '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
      } as unknown as Wallet;

      const expectedHotWallet: HotWallet = {
        blockchainKey: 'eip155:56',
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        bip44CoinType: 60,
        wallet: mockWallet,
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async (blockchainKey: string) => {
          strictEqual(blockchainKey, 'eip155:56', 'Should request BSC blockchain key');
          return expectedHotWallet;
        }),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallet('eip155:56');

      // Verify
      ok(result, 'Result should be defined');
      strictEqual(result.blockchainKey, 'eip155:56', 'Should be BSC blockchain key');
      strictEqual(
        result.address,
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        'Address should match',
      );
    });

    it('should propagate error when blockchain key is invalid', async () => {
      // Setup: Mock service that throws error
      const mockWalletService = {
        getHotWallet: mock.fn(async (blockchainKey: string) => {
          throw new Error(`Unsupported blockchain key: ${blockchainKey}`);
        }),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute & Verify
      try {
        await service.getHotWallet('invalid:chain');
        ok(false, 'Should have thrown an error');
      } catch (error) {
        ok(error instanceof Error, 'Error should be Error instance');
        strictEqual(
          error.message,
          'Unsupported blockchain key: invalid:chain',
          'Error message should match',
        );
      }

      strictEqual(
        (mockWalletService.getHotWallet as unknown as ReturnType<typeof mock.fn>).mock.calls.length,
        1,
        'getHotWallet should be called once',
      );
    });
  });

  describe('getHotWallets', () => {
    it('should get multiple hot wallets for different blockchains', async () => {
      // Setup: Multiple hot wallets
      const mockWalletEth: Wallet = {
        getAddress: mock.fn(async () => '0x1111111111111111111111111111111111111111'),
      } as unknown as Wallet;

      const mockWalletBsc: Wallet = {
        getAddress: mock.fn(async () => '0x2222222222222222222222222222222222222222'),
      } as unknown as Wallet;

      const mockWalletPolygon: Wallet = {
        getAddress: mock.fn(async () => '0x3333333333333333333333333333333333333333'),
      } as unknown as Wallet;

      const hotWallets: Record<string, HotWallet> = {
        'eip155:1': {
          blockchainKey: 'eip155:1',
          address: '0x1111111111111111111111111111111111111111',
          bip44CoinType: 60,
          wallet: mockWalletEth,
        },
        'eip155:56': {
          blockchainKey: 'eip155:56',
          address: '0x2222222222222222222222222222222222222222',
          bip44CoinType: 60,
          wallet: mockWalletBsc,
        },
        'eip155:137': {
          blockchainKey: 'eip155:137',
          address: '0x3333333333333333333333333333333333333333',
          bip44CoinType: 60,
          wallet: mockWalletPolygon,
        },
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async (blockchainKey: string) => {
          return hotWallets[blockchainKey];
        }),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallets(['eip155:1', 'eip155:56', 'eip155:137']);

      // Verify
      ok(Array.isArray(result), 'Result should be an array');
      strictEqual(result.length, 3, 'Should return 3 hot wallets');

      // Verify first wallet (Ethereum)
      strictEqual(result[0].blockchainKey, 'eip155:1', 'First wallet should be Ethereum');
      strictEqual(
        result[0].address,
        '0x1111111111111111111111111111111111111111',
        'Ethereum address should match',
      );

      // Verify second wallet (BSC)
      strictEqual(result[1].blockchainKey, 'eip155:56', 'Second wallet should be BSC');
      strictEqual(
        result[1].address,
        '0x2222222222222222222222222222222222222222',
        'BSC address should match',
      );

      // Verify third wallet (Polygon)
      strictEqual(result[2].blockchainKey, 'eip155:137', 'Third wallet should be Polygon');
      strictEqual(
        result[2].address,
        '0x3333333333333333333333333333333333333333',
        'Polygon address should match',
      );

      // Verify call count
      strictEqual(
        (mockWalletService.getHotWallet as unknown as ReturnType<typeof mock.fn>).mock.calls.length,
        3,
        'getHotWallet should be called 3 times',
      );
    });

    it('should return empty array when no blockchain keys provided', async () => {
      // Setup
      const mockWalletService = {
        getHotWallet: mock.fn(async () => {
          ok(false, 'getHotWallet should not be called');
          return {} as HotWallet;
        }),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallets([]);

      // Verify
      ok(Array.isArray(result), 'Result should be an array');
      strictEqual(result.length, 0, 'Should return empty array');
      strictEqual(
        (mockWalletService.getHotWallet as unknown as ReturnType<typeof mock.fn>).mock.calls.length,
        0,
        'getHotWallet should not be called',
      );
    });

    it('should get single hot wallet when array has one item', async () => {
      // Setup
      const mockWallet: Wallet = {
        getAddress: mock.fn(async () => '0x9999999999999999999999999999999999999999'),
      } as unknown as Wallet;

      const expectedHotWallet: HotWallet = {
        blockchainKey: 'eip155:1',
        address: '0x9999999999999999999999999999999999999999',
        bip44CoinType: 60,
        wallet: mockWallet,
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async () => expectedHotWallet),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallets(['eip155:1']);

      // Verify
      ok(Array.isArray(result), 'Result should be an array');
      strictEqual(result.length, 1, 'Should return 1 hot wallet');
      strictEqual(result[0].blockchainKey, 'eip155:1', 'Blockchain key should match');
      strictEqual(
        result[0].address,
        '0x9999999999999999999999999999999999999999',
        'Address should match',
      );
    });

    it('should handle error when one blockchain fails', async () => {
      // Setup: First call succeeds, second fails
      let callCount = 0;
      const mockWalletService = {
        getHotWallet: mock.fn(async (blockchainKey: string) => {
          callCount++;
          if (blockchainKey === 'invalid:chain') {
            throw new Error(`Unsupported blockchain key: ${blockchainKey}`);
          }
          return {
            blockchainKey,
            address: '0x1111111111111111111111111111111111111111',
            bip44CoinType: 60,
            wallet: {} as Wallet,
          };
        }),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute & Verify
      try {
        await service.getHotWallets(['eip155:1', 'invalid:chain']);
        ok(false, 'Should have thrown an error');
      } catch (error) {
        ok(error instanceof Error, 'Error should be Error instance');
        strictEqual(
          error.message,
          'Unsupported blockchain key: invalid:chain',
          'Error message should match',
        );
      }

      // Note: Promise.all fails fast, so second call happens in parallel
      // Both calls will be initiated even though one fails
      ok(
        (mockWalletService.getHotWallet as unknown as ReturnType<typeof mock.fn>).mock.calls
          .length >= 1,
        'getHotWallet should be called at least once',
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle Bitcoin blockchain key', async () => {
      // Setup: Bitcoin hot wallet
      const mockWallet: Wallet = {
        getAddress: mock.fn(async () => 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'),
      } as unknown as Wallet;

      const expectedHotWallet: HotWallet = {
        blockchainKey: 'bip122:000000000019d6689c085ae165831e93',
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        bip44CoinType: 0,
        wallet: mockWallet,
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async () => expectedHotWallet),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallet('bip122:000000000019d6689c085ae165831e93');

      // Verify
      ok(result, 'Result should be defined');
      strictEqual(
        result.blockchainKey,
        'bip122:000000000019d6689c085ae165831e93',
        'Should be Bitcoin blockchain key',
      );
      strictEqual(result.bip44CoinType, 0, 'BIP44 coin type should be 0 for Bitcoin');
      strictEqual(
        result.address,
        'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        'Bitcoin address should match',
      );
    });

    it('should handle Solana blockchain key', async () => {
      // Setup: Solana hot wallet
      const mockWallet: Wallet = {
        getAddress: mock.fn(async () => 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'),
      } as unknown as Wallet;

      const expectedHotWallet: HotWallet = {
        blockchainKey: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        bip44CoinType: 501,
        wallet: mockWallet,
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async () => expectedHotWallet),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallet('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp');

      // Verify
      ok(result, 'Result should be defined');
      strictEqual(
        result.blockchainKey,
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        'Should be Solana blockchain key',
      );
      strictEqual(result.bip44CoinType, 501, 'BIP44 coin type should be 501 for Solana');
      strictEqual(
        result.address,
        'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        'Solana address should match',
      );
    });

    it('should handle mixed blockchain types in getHotWallets', async () => {
      // Setup: Mix of EVM, Bitcoin, and Solana
      const hotWallets: Record<string, HotWallet> = {
        'eip155:1': {
          blockchainKey: 'eip155:1',
          address: '0x1111111111111111111111111111111111111111',
          bip44CoinType: 60,
          wallet: {} as Wallet,
        },
        'bip122:000000000019d6689c085ae165831e93': {
          blockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          bip44CoinType: 0,
          wallet: {} as Wallet,
        },
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
          blockchainKey: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          bip44CoinType: 501,
          wallet: {} as Wallet,
        },
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async (blockchainKey: string) => hotWallets[blockchainKey]),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const result = await service.getHotWallets([
        'eip155:1',
        'bip122:000000000019d6689c085ae165831e93',
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      ]);

      // Verify
      strictEqual(result.length, 3, 'Should return 3 wallets');
      strictEqual(result[0].bip44CoinType, 60, 'Ethereum should use coin type 60');
      strictEqual(result[1].bip44CoinType, 0, 'Bitcoin should use coin type 0');
      strictEqual(result[2].bip44CoinType, 501, 'Solana should use coin type 501');
    });
  });

  describe('getHotWalletBalance', () => {
    it('should get actual blockchain balance for hot wallet', async () => {
      // Setup: Mock wallet with getBalance method
      const mockWallet: Wallet = {
        getAddress: mock.fn(async () => '0x1234567890123456789012345678901234567890'),
        getBalance: mock.fn(async (address: string) => {
          strictEqual(address, '0x1234567890123456789012345678901234567890');
          return 10.5; // 10.5 ETH
        }),
      } as unknown as Wallet;

      const mockHotWallet: HotWallet = {
        blockchainKey: 'eip155:1',
        address: '0x1234567890123456789012345678901234567890',
        bip44CoinType: 60,
        wallet: mockWallet,
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async () => mockHotWallet),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const balance = await service.getHotWalletBalance('eip155:1');

      // Verify
      strictEqual(balance, '10.5', 'Should return balance as string');
      strictEqual(
        (mockWallet.getBalance as MockedFunction<typeof mockWallet.getBalance>).mock.callCount(),
        1,
      );
    });

    it('should return zero balance on error', async () => {
      // Setup: Wallet that throws error
      const mockWallet: Wallet = {
        getAddress: mock.fn(async () => '0x1234567890123456789012345678901234567890'),
        getBalance: mock.fn(async () => {
          throw new Error('Network error');
        }),
      } as unknown as Wallet;

      const mockHotWallet: HotWallet = {
        blockchainKey: 'eip155:1',
        address: '0x1234567890123456789012345678901234567890',
        bip44CoinType: 60,
        wallet: mockWallet,
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async () => mockHotWallet),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const balance = await service.getHotWalletBalance('eip155:1');

      // Verify
      strictEqual(balance, '0', 'Should return zero on error');
    });
  });

  describe('getHotWalletBalances', () => {
    it('should get balances for multiple blockchains', async () => {
      // Setup: Multiple wallets with different balances
      const mockWallets: Record<string, HotWallet> = {
        'eip155:1': {
          blockchainKey: 'eip155:1',
          address: '0x1111111111111111111111111111111111111111',
          bip44CoinType: 60,
          wallet: {
            getBalance: mock.fn(async () => 5.5),
          } as unknown as Wallet,
        },
        'eip155:137': {
          blockchainKey: 'eip155:137',
          address: '0x2222222222222222222222222222222222222222',
          bip44CoinType: 60,
          wallet: {
            getBalance: mock.fn(async () => 12.3),
          } as unknown as Wallet,
        },
        'bip122:000000000019d6689c085ae165831e93': {
          blockchainKey: 'bip122:000000000019d6689c085ae165831e93',
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          bip44CoinType: 0,
          wallet: {
            getBalance: mock.fn(async () => 0.025),
          } as unknown as Wallet,
        },
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async (key: string) => mockWallets[key]),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const balances = await service.getHotWalletBalances([
        'eip155:1',
        'eip155:137',
        'bip122:000000000019d6689c085ae165831e93',
      ]);

      // Verify
      strictEqual(balances.length, 3, 'Should return 3 balance entries');
      strictEqual(balances[0].blockchainKey, 'eip155:1');
      strictEqual(balances[0].balance, '5.5');
      strictEqual(balances[0].address, '0x1111111111111111111111111111111111111111');

      strictEqual(balances[1].blockchainKey, 'eip155:137');
      strictEqual(balances[1].balance, '12.3');

      strictEqual(balances[2].blockchainKey, 'bip122:000000000019d6689c085ae165831e93');
      strictEqual(balances[2].balance, '0.025');
    });

    it('should handle partial failures gracefully', async () => {
      // Setup: One wallet succeeds, one fails
      const mockWallets: Record<string, HotWallet> = {
        'eip155:1': {
          blockchainKey: 'eip155:1',
          address: '0x1111111111111111111111111111111111111111',
          bip44CoinType: 60,
          wallet: {
            getBalance: mock.fn(async () => 5.5),
          } as unknown as Wallet,
        },
        'eip155:137': {
          blockchainKey: 'eip155:137',
          address: '0x2222222222222222222222222222222222222222',
          bip44CoinType: 60,
          wallet: {
            getBalance: mock.fn(async () => {
              throw new Error('RPC node down');
            }),
          } as unknown as Wallet,
        },
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async (key: string) => mockWallets[key]),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const balances = await service.getHotWalletBalances(['eip155:1', 'eip155:137']);

      // Verify - should still include both, but failed one has zero balance
      strictEqual(balances.length, 2, 'Should return 2 entries even with failure');
      strictEqual(balances[0].balance, '5.5', 'First balance should be correct');
      strictEqual(balances[1].balance, '0', 'Failed balance should be zero');
      strictEqual(balances[1].address, '', 'Failed entry should have empty address');
    });

    it('should return all entries including failures', async () => {
      // Setup: Mix of successful and failed wallets
      const mockWallets: Record<string, HotWallet> = {
        'eip155:1': {
          blockchainKey: 'eip155:1',
          address: '0x1111111111111111111111111111111111111111',
          bip44CoinType: 60,
          wallet: {
            getBalance: mock.fn(async () => 5.5),
          } as unknown as Wallet,
        },
        'eip155:137': {
          blockchainKey: 'eip155:137',
          address: '0x2222222222222222222222222222222222222222',
          bip44CoinType: 60,
          wallet: {
            getBalance: mock.fn(async () => {
              throw new Error('Failed');
            }),
          } as unknown as Wallet,
        },
      };

      const mockWalletService = {
        getHotWallet: mock.fn(async (key: string) => mockWallets[key]),
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Execute
      const balances = await service.getHotWalletBalances(['eip155:1', 'eip155:137']);

      // Verify - returns all entries (including failures with zero balance)
      strictEqual(balances.length, 2, 'Should return all entries including failures');
      ok(
        balances.some(b => b.balance === '5.5'),
        'Should include successful balance',
      );
      ok(
        balances.some(b => b.balance === '0' && b.address === ''),
        'Should include failed entry with zero balance',
      );
    });
  });
});
