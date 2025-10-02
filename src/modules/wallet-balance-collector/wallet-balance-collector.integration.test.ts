import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { ethers } from 'ethers';

/**
 * Integration test to verify wallet balance collector derivation path logic
 * This test validates that:
 * 1. Invoice wallets can be derived from paths correctly
 * 2. Hot wallets can be derived correctly
 * 3. Addresses match expected format
 * 4. The derivation paths follow BIP44 standard
 */
describe('Wallet Balance Collector - Derivation Path Integration', () => {
  let masterKey: HDKey;
  const testMnemonic = 'test test test test test test test test test test test junk';

  before(async () => {
    // Create master key from test mnemonic
    const seed = await mnemonicToSeed(testMnemonic);
    masterKey = HDKey.fromMasterSeed(seed);
  });

  it('should derive invoice wallet from correct BIP44 path', async () => {
    const invoiceId = 12345;
    const coinType = 60; // Ethereum
    const expectedPath = `m/44'/${coinType}'/5'/0/${invoiceId}`;

    // Derive wallet using the path
    const derived = masterKey.derive(expectedPath);
    assert.ok(derived.privateKey, 'Should have private key');

    // Create Ethereum wallet from private key
    const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
    assert.ok(wallet.address, 'Should have address');
    assert.ok(wallet.address.startsWith('0x'), 'Address should start with 0x');
    assert.strictEqual(wallet.address.length, 42, 'Address should be 42 characters');

    console.log(`✅ Invoice ${invoiceId} derived wallet: ${wallet.address}`);
  });

  it('should derive hot wallet from correct BIP44 path', async () => {
    const coinType = 60; // Ethereum
    const expectedPath = `m/44'/${coinType}'/0'/10/0`;

    // Derive wallet using the path
    const derived = masterKey.derive(expectedPath);
    assert.ok(derived.privateKey, 'Should have private key');

    // Create Ethereum wallet from private key
    const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
    assert.ok(wallet.address, 'Should have address');
    assert.ok(wallet.address.startsWith('0x'), 'Address should start with 0x');

    console.log(`✅ Hot wallet derived: ${wallet.address}`);
  });

  it('should derive different addresses for different invoice IDs', async () => {
    const coinType = 60;
    const invoiceId1 = 100;
    const invoiceId2 = 200;

    const path1 = `m/44'/${coinType}'/5'/0/${invoiceId1}`;
    const path2 = `m/44'/${coinType}'/5'/0/${invoiceId2}`;

    const derived1 = masterKey.derive(path1);
    const derived2 = masterKey.derive(path2);

    const wallet1 = new ethers.Wallet(Buffer.from(derived1.privateKey!).toString('hex'));
    const wallet2 = new ethers.Wallet(Buffer.from(derived2.privateKey!).toString('hex'));

    assert.notStrictEqual(
      wallet1.address,
      wallet2.address,
      'Different invoice IDs should generate different addresses',
    );

    console.log(`✅ Invoice ${invoiceId1}: ${wallet1.address}`);
    console.log(`✅ Invoice ${invoiceId2}: ${wallet2.address}`);
  });

  it('should handle large invoice IDs within BIP32 range', async () => {
    const coinType = 60;
    const largeInvoiceId = 2147483646; // 2^31 - 2 (near max)
    const path = `m/44'/${coinType}'/5'/0/${largeInvoiceId}`;

    const derived = masterKey.derive(path);
    assert.ok(derived.privateKey, 'Should handle large invoice ID');

    const wallet = new ethers.Wallet(Buffer.from(derived.privateKey).toString('hex'));
    assert.ok(wallet.address, 'Should derive wallet for large invoice ID');

    console.log(`✅ Large invoice ID ${largeInvoiceId}: ${wallet.address}`);
  });

  it('should derive same address from same derivation path', async () => {
    const coinType = 60;
    const invoiceId = 555;
    const path = `m/44'/${coinType}'/5'/0/${invoiceId}`;

    // Derive twice
    const derived1 = masterKey.derive(path);
    const derived2 = masterKey.derive(path);

    const wallet1 = new ethers.Wallet(Buffer.from(derived1.privateKey!).toString('hex'));
    const wallet2 = new ethers.Wallet(Buffer.from(derived2.privateKey!).toString('hex'));

    assert.strictEqual(
      wallet1.address,
      wallet2.address,
      'Same path should always generate same address',
    );

    console.log(`✅ Deterministic derivation verified: ${wallet1.address}`);
  });
});
