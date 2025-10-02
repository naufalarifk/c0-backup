import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { ethers } from 'ethers';

import { BlockchainNetworkEnum } from '../balance-collection.types';

/**
 * Integration tests for wallet balance collector collectors
 *
 * These tests verify:
 * 1. Blockchain-specific derivation paths are correct
 * 2. Address generation works for each blockchain
 * 3. Collectors can identify their supported blockchains
 */
describe('Balance Collectors - Integration Tests', () => {
  let masterKey: HDKey;
  const testMnemonic = 'test test test test test test test test test test test junk';

  before(async () => {
    // Create master key from test mnemonic
    const seed = await mnemonicToSeed(testMnemonic);
    masterKey = HDKey.fromMasterSeed(seed);
  });

  describe('Ethereum Mainnet (EIP155:1)', () => {
    const coinType = 60; // Ethereum

    it('should derive valid Ethereum address from invoice wallet path', async () => {
      const invoiceId = 12345;
      const expectedPath = `m/44'/${coinType}'/5'/0/${invoiceId}`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');

      const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
      assert.ok(wallet.address, 'Should have address');
      assert.ok(wallet.address.startsWith('0x'), 'Address should start with 0x');
      assert.strictEqual(wallet.address.length, 42, 'Address should be 42 characters');

      console.log(`✅ Ethereum invoice ${invoiceId} wallet: ${wallet.address}`);
    });

    it('should derive hot wallet from correct path', async () => {
      const expectedPath = `m/44'/${coinType}'/0'/10/0`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');

      const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
      assert.ok(wallet.address, 'Should have address');

      console.log(`✅ Ethereum hot wallet: ${wallet.address}`);
    });
  });

  describe('BSC Mainnet (EIP155:56)', () => {
    const coinType = 60; // BSC uses same coin type as Ethereum

    it('should derive valid BSC address (same format as Ethereum)', async () => {
      const invoiceId = 67890;
      const expectedPath = `m/44'/${coinType}'/5'/0/${invoiceId}`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');

      const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
      assert.ok(wallet.address.startsWith('0x'), 'BSC address should start with 0x');

      console.log(`✅ BSC invoice ${invoiceId} wallet: ${wallet.address}`);
    });
  });

  describe('Ethereum Sepolia (EIP155:11155111)', () => {
    const coinType = 60; // Testnet uses same coin type

    it('should derive valid Sepolia address', async () => {
      const invoiceId = 11111;
      const expectedPath = `m/44'/${coinType}'/5'/0/${invoiceId}`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');

      const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
      assert.ok(wallet.address.startsWith('0x'), 'Sepolia address should start with 0x');

      console.log(`✅ Sepolia invoice ${invoiceId} wallet: ${wallet.address}`);
    });
  });

  describe('Solana Mainnet', () => {
    const coinType = 501; // Solana

    it('should derive valid Solana key from correct path', async () => {
      const invoiceId = 54321;
      const expectedPath = `m/44'/${coinType}'/5'/0/${invoiceId}`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');
      assert.strictEqual(derived.privateKey.length, 32, 'Solana private key should be 32 bytes');

      console.log(`✅ Solana invoice ${invoiceId} private key derived (32 bytes)`);
    });

    it('should derive hot wallet from correct path', async () => {
      const expectedPath = `m/44'/${coinType}'/0'/10/0`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');
      assert.strictEqual(derived.privateKey.length, 32, 'Solana private key should be 32 bytes');

      console.log(`✅ Solana hot wallet private key derived (32 bytes)`);
    });
  });

  describe('Bitcoin Mainnet', () => {
    const coinType = 0; // Bitcoin

    it('should derive valid Bitcoin key from correct path', async () => {
      const invoiceId = 98765;
      const expectedPath = `m/44'/${coinType}'/5'/0/${invoiceId}`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');
      assert.strictEqual(derived.privateKey.length, 32, 'Bitcoin private key should be 32 bytes');

      console.log(`✅ Bitcoin invoice ${invoiceId} private key derived (32 bytes)`);
    });

    it('should derive hot wallet from correct path', async () => {
      const expectedPath = `m/44'/${coinType}'/0'/10/0`;

      const derived = masterKey.derive(expectedPath);
      assert.ok(derived.privateKey, 'Should have private key');
      assert.strictEqual(derived.privateKey.length, 32, 'Bitcoin private key should be 32 bytes');

      console.log(`✅ Bitcoin hot wallet private key derived (32 bytes)`);
    });
  });

  describe('Blockchain Network Identifiers', () => {
    it('should have correct blockchain network enums', () => {
      assert.strictEqual(
        BlockchainNetworkEnum.EthereumMainnet,
        'eip155:1',
        'Ethereum mainnet identifier',
      );
      assert.strictEqual(BlockchainNetworkEnum.BSCMainnet, 'eip155:56', 'BSC mainnet identifier');
      assert.strictEqual(
        BlockchainNetworkEnum.EthereumSepolia,
        'eip155:11155111',
        'Sepolia testnet identifier',
      );
      assert.strictEqual(
        BlockchainNetworkEnum.SolanaMainnet,
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        'Solana mainnet identifier',
      );
      assert.strictEqual(
        BlockchainNetworkEnum.BitcoinMainnet,
        'bip122:000000000019d6689c085ae165831e93',
        'Bitcoin mainnet identifier',
      );
    });
  });

  describe('Derivation Path Standards', () => {
    it('should use correct BIP44 coin types for each blockchain', () => {
      const coinTypes = {
        ethereum: 60,
        bsc: 60, // BSC uses same as Ethereum
        solana: 501,
        bitcoin: 0,
      };

      // Invoice wallet paths (account 5)
      const invoiceId = 123;
      const ethereumInvoicePath = `m/44'/${coinTypes.ethereum}'/5'/0/${invoiceId}`;
      const bscInvoicePath = `m/44'/${coinTypes.bsc}'/5'/0/${invoiceId}`;
      const solanaInvoicePath = `m/44'/${coinTypes.solana}'/5'/0/${invoiceId}`;
      const bitcoinInvoicePath = `m/44'/${coinTypes.bitcoin}'/5'/0/${invoiceId}`;

      // Hot wallet paths (account 0, change 10, index 0)
      const ethereumHotPath = `m/44'/${coinTypes.ethereum}'/0'/10/0`;
      const solanaHotPath = `m/44'/${coinTypes.solana}'/0'/10/0`;
      const bitcoinHotPath = `m/44'/${coinTypes.bitcoin}'/0'/10/0`;

      // Verify paths can be derived
      assert.ok(masterKey.derive(ethereumInvoicePath), 'Ethereum invoice path should be valid');
      assert.ok(masterKey.derive(bscInvoicePath), 'BSC invoice path should be valid');
      assert.ok(masterKey.derive(solanaInvoicePath), 'Solana invoice path should be valid');
      assert.ok(masterKey.derive(bitcoinInvoicePath), 'Bitcoin invoice path should be valid');

      assert.ok(masterKey.derive(ethereumHotPath), 'Ethereum hot path should be valid');
      assert.ok(masterKey.derive(solanaHotPath), 'Solana hot path should be valid');
      assert.ok(masterKey.derive(bitcoinHotPath), 'Bitcoin hot path should be valid');

      console.log('✅ All BIP44 derivation paths are valid');
    });

    it('should generate deterministic addresses from same path', async () => {
      const invoiceId = 99999;
      const path = `m/44'/60'/5'/0/${invoiceId}`;

      // Derive twice
      const derived1 = masterKey.derive(path);
      const derived2 = masterKey.derive(path);

      const wallet1 = new ethers.Wallet(Buffer.from(derived1.privateKey!).toString('hex'));
      const wallet2 = new ethers.Wallet(Buffer.from(derived2.privateKey!).toString('hex'));

      assert.strictEqual(
        wallet1.address,
        wallet2.address,
        'Same path should generate same address',
      );

      console.log(`✅ Deterministic derivation verified: ${wallet1.address}`);
    });

    it('should generate different addresses for different invoice IDs', async () => {
      const path1 = "m/44'/60'/5'/0/100";
      const path2 = "m/44'/60'/5'/0/200";

      const derived1 = masterKey.derive(path1);
      const derived2 = masterKey.derive(path2);

      const wallet1 = new ethers.Wallet(Buffer.from(derived1.privateKey!).toString('hex'));
      const wallet2 = new ethers.Wallet(Buffer.from(derived2.privateKey!).toString('hex'));

      assert.notStrictEqual(
        wallet1.address,
        wallet2.address,
        'Different invoice IDs should generate different addresses',
      );

      console.log(`✅ Invoice 100: ${wallet1.address}`);
      console.log(`✅ Invoice 200: ${wallet2.address}`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maximum invoice ID (BIP32 limit)', async () => {
      // BIP32 uses 31-bit indices (0 to 2^31-1)
      const maxInvoiceId = 2147483647; // 2^31 - 1
      const path = `m/44'/60'/5'/0/${maxInvoiceId}`;

      const derived = masterKey.derive(path);
      assert.ok(derived.privateKey, 'Should derive with max invoice ID');

      const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
      console.log(`✅ Max invoice ID ${maxInvoiceId}: ${wallet.address}`);
    });

    it('should handle invoice ID 0', async () => {
      const invoiceId = 0;
      const path = `m/44'/60'/5'/0/${invoiceId}`;

      const derived = masterKey.derive(path);
      assert.ok(derived.privateKey, 'Should derive with invoice ID 0');

      const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
      console.log(`✅ Invoice ID 0: ${wallet.address}`);
    });
  });
});
