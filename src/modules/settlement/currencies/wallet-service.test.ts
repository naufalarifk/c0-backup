/**
 * SettlementWalletService Integration Tests
 *
 * Tests the actual implementation with real blockchain connections.
 * Uses Solana devnet for testing since it's faster and has free testnet tokens.
 *
 * Prerequisites:
 * - SOLANA_USE_DEVNET=true environment variable
 * - Solana devnet RPC accessible (https://api.devnet.solana.com)
 * - Test uses actual blockchain queries (may be slower)
 */

import type { HotWallet, WalletService } from '../../../shared/wallets/wallet.service';

import { ok, strictEqual } from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { Logger } from '@nestjs/common';

import { mnemonicToSeedSync } from '@scure/bip39';
import { Connection, Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';

import { SolWallet } from '../../../shared/wallets/wallets/sol.wallet';
import { SettlementWalletService } from './wallet.service';

// Disable NestJS logging during tests
Logger.overrideLogger(false);

/**
 * Concrete Solana wallet implementation for testing
 */
class TestSolWallet extends SolWallet {
  protected connection: Connection;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, rpcUrl: string) {
    super(privateKey);
    this.connection = new Connection(rpcUrl, 'confirmed');
  }
}

/**
 * Test Setup
 * Create minimal WalletService mock with real Solana wallet for integration testing
 */
function setupRealServices() {
  // Use same mnemonic as settlement system
  const mnemonic =
    'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';

  // Use settlement's hot wallet derivation path: m/44'/501'/1005'/0'
  // (Account 1005 is used for settlement hot wallet)
  const seed = mnemonicToSeedSync(mnemonic);
  const path = "m/44'/501'/1005'/0'";
  const seedHex = Buffer.from(seed).toString('hex');
  const derivedSeed = derivePath(path, seedHex).key;
  const keypair = Keypair.fromSeed(derivedSeed);

  // Create Solana wallet pointing to devnet
  const solWallet = new TestSolWallet(
    derivedSeed,
    'https://api.devnet.solana.com', // Use devnet
  );

  const solanaBlockchainKey = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'; // Devnet
  const expectedAddress = keypair.publicKey.toBase58();

  // Create minimal WalletService mock that returns real Solana wallet
  const mockWalletService = {
    async getHotWallet(blockchainKey: string): Promise<HotWallet> {
      if (blockchainKey === solanaBlockchainKey) {
        return {
          blockchainKey: solanaBlockchainKey,
          address: expectedAddress,
          bip44CoinType: 501,
          wallet: solWallet,
        };
      }
      throw new Error(`Unsupported blockchain key: ${blockchainKey}`);
    },
  } as unknown as WalletService;

  // Create SettlementWalletService with mock that uses real wallet
  const settlementWalletService = new SettlementWalletService(mockWalletService);

  return {
    mockWalletService,
    settlementWalletService,
    solanaBlockchainKey,
    expectedAddress,
  };
}

describe('SettlementWalletService - Real Integration', () => {
  let services: ReturnType<typeof setupRealServices>;

  before(() => {
    services = setupRealServices();
    console.log('\n📋 Test Configuration:');
    console.log('   Network: Solana Devnet');
    console.log('   Address:', services.expectedAddress);
    console.log('   RPC: https://api.devnet.solana.com');
    console.log('');
  });

  describe('getHotWalletBalance', () => {
    it('should get actual blockchain balance from Solana devnet', async function () {
      // This test queries real Solana devnet
      const balance = await services.settlementWalletService.getHotWalletBalance(
        services.solanaBlockchainKey,
      );

      // Verify
      ok(balance, 'Should return a balance');
      ok(typeof balance === 'string', 'Balance should be a string');
      ok(!Number.isNaN(Number.parseFloat(balance)), 'Balance should be a valid number');

      console.log(`   ✅ Retrieved balance: ${balance} SOL`);

      // Balance should be >= 0
      ok(Number.parseFloat(balance) >= 0, 'Balance should be non-negative');
    });

    it('should return zero balance for invalid blockchain key', async () => {
      // Test with non-existent blockchain key
      const balance = await services.settlementWalletService.getHotWalletBalance(
        'solana:invalidblockchainkey123456789012',
      );

      // Should return '0' on error
      strictEqual(balance, '0', 'Should return zero for invalid blockchain');
    });
  });

  describe('getHotWalletBalances', () => {
    it('should get actual blockchain balance for single wallet', async function () {
      const balances = await services.settlementWalletService.getHotWalletBalances([
        services.solanaBlockchainKey,
      ]);

      // Verify
      strictEqual(balances.length, 1, 'Should return 1 balance entry');
      strictEqual(balances[0].blockchainKey, services.solanaBlockchainKey);
      strictEqual(balances[0].address, services.expectedAddress);
      ok(!Number.isNaN(Number.parseFloat(balances[0].balance)), 'Balance should be valid number');

      console.log(`   ✅ Retrieved balance: ${balances[0].balance} SOL`);
      console.log(`      Address: ${balances[0].address}`);
    });

    it('should handle mix of valid and invalid blockchain keys', async () => {
      const balances = await services.settlementWalletService.getHotWalletBalances([
        services.solanaBlockchainKey,
        'solana:invalidkey123456789012345678901',
      ]);

      // Verify - should return both entries
      strictEqual(balances.length, 2, 'Should return 2 entries');

      // First should succeed with real balance
      strictEqual(balances[0].blockchainKey, services.solanaBlockchainKey);
      ok(Number.parseFloat(balances[0].balance) >= 0, 'Valid wallet should have balance');
      strictEqual(balances[0].address, services.expectedAddress);

      // Second should fail with zero balance
      strictEqual(balances[1].blockchainKey, 'solana:invalidkey123456789012345678901');
      strictEqual(balances[1].balance, '0', 'Invalid wallet should have zero balance');
      strictEqual(balances[1].address, '', 'Invalid wallet should have empty address');

      console.log(`   ✅ Valid wallet balance: ${balances[0].balance} SOL`);
      console.log(`   ✅ Invalid wallet balance: ${balances[1].balance} SOL (expected)`);
    });

    it('should handle all invalid blockchain keys', async () => {
      const balances = await services.settlementWalletService.getHotWalletBalances([
        'solana:invalidkey111111111111111111111',
        'solana:invalidkey222222222222222222222',
      ]);

      // All should fail with zero balances
      strictEqual(balances.length, 2, 'Should return 2 entries');
      strictEqual(balances[0].balance, '0', 'First should be zero');
      strictEqual(balances[0].address, '', 'First should have empty address');
      strictEqual(balances[1].balance, '0', 'Second should be zero');
      strictEqual(balances[1].address, '', 'Second should have empty address');

      console.log(`   ✅ All invalid keys handled correctly`);
    });

    it('should handle empty array', async () => {
      const balances = await services.settlementWalletService.getHotWalletBalances([]);

      strictEqual(balances.length, 0, 'Should return empty array');
      console.log(`   ✅ Empty array handled correctly`);
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle network errors', async function () {
      // Create wallet with invalid RPC URL to simulate network error
      const mnemonic =
        'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';
      const seed = mnemonicToSeedSync(mnemonic);
      const path = "m/44'/501'/1005'/0'";
      const seedHex = Buffer.from(seed).toString('hex');
      const derivedSeed = derivePath(path, seedHex).key;
      const keypair = Keypair.fromSeed(derivedSeed);

      // Use invalid RPC URL to simulate network error
      const invalidSolWallet = new TestSolWallet(
        derivedSeed,
        'https://invalid-rpc-url-that-does-not-exist.com',
      );

      const blockchainKey = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

      // Create mock WalletService that returns wallet with invalid RPC
      const mockWalletService = {
        async getHotWallet() {
          return {
            blockchainKey,
            address: keypair.publicKey.toBase58(),
            bip44CoinType: 501,
            wallet: invalidSolWallet,
          };
        },
      } as unknown as WalletService;

      const service = new SettlementWalletService(mockWalletService);

      // Should return '0' instead of throwing
      const balance = await service.getHotWalletBalance(blockchainKey);
      strictEqual(balance, '0', 'Should return zero on network error');

      console.log(`   ✅ Network error handled gracefully`);
    });
  });
});
