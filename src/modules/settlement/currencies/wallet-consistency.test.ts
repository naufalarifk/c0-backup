/**
 * Wallet Consistency Tests
 *
 * Verifies that wallet addresses are deterministic and consistent
 * when derived multiple times from the same mnemonic.
 *
 * Tests wallet derivation at the cryptographic level without NestJS dependencies.
 */

import { strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';

// Test mnemonic from setup.ts
const TEST_MNEMONIC =
  'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';

// Expected addresses - Using default derivation path (account 0 - same as MetaMask)
// Changed from account 1005 to account 0 for easier wallet management
const EXPECTED_ADDRESSES = {
  solana: 'FR7VaPGTSKFD94QFHwj5tRFekLBPyhmQ2yXjs4VUNbq7',
  ethereum: '0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3',
  bsc: '0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3', // Same as ETH (both EVM)
};

// Helper to convert Uint8Array to hex string
function toHex(bytes: Uint8Array): string {
  return '0x' + Buffer.from(bytes).toString('hex');
}

describe('Wallet Consistency Tests', () => {
  describe('Solana Wallet Consistency', () => {
    const SOLANA_PATH = "m/44'/501'/0'/0/0"; // Default derivation path (account 0 - same as Phantom/MetaMask)

    async function deriveSolanaAddress(mnemonic: string): Promise<string> {
      const seed = await mnemonicToSeed(mnemonic);
      const masterKey = HDKey.fromMasterSeed(seed);
      const derivedKey = masterKey.derive(SOLANA_PATH);

      if (!derivedKey.privateKey) {
        throw new Error('Private key is undefined');
      }

      const keypair = Keypair.fromSeed(derivedKey.privateKey.slice(0, 32));
      return keypair.publicKey.toBase58();
    }

    it('should generate same address 10 times in a row', async () => {
      const addresses: string[] = [];

      for (let i = 0; i < 10; i++) {
        const address = await deriveSolanaAddress(TEST_MNEMONIC);
        addresses.push(address);

        // Verify against expected address
        strictEqual(
          address,
          EXPECTED_ADDRESSES.solana,
          `Iteration ${i + 1}: Address should match expected Solana address`,
        );
      }

      // Verify all addresses are identical
      const uniqueAddresses = new Set(addresses);
      strictEqual(uniqueAddresses.size, 1, 'All 10 addresses should be identical');

      console.log(`✅ Solana: Generated same address ${addresses.length} times`);
      console.log(`   Address: ${addresses[0]}`);
    });

    it('should match expected address', async () => {
      const address = await deriveSolanaAddress(TEST_MNEMONIC);
      strictEqual(address, EXPECTED_ADDRESSES.solana, 'Address should match expected value');
    });
  });

  describe('Ethereum Wallet Consistency', () => {
    const ETH_PATH = "m/44'/60'/0'/0/0"; // Ethereum hot wallet derivation path (account 1005)

    async function deriveEthereumAddress(mnemonic: string): Promise<string> {
      const seed = await mnemonicToSeed(mnemonic);
      const masterKey = HDKey.fromMasterSeed(seed);
      const derivedKey = masterKey.derive(ETH_PATH);

      if (!derivedKey.privateKey) {
        throw new Error('Private key is undefined');
      }

      const wallet = new ethers.Wallet(toHex(derivedKey.privateKey));
      return wallet.address;
    }

    it('should generate same address 10 times in a row', async () => {
      const addresses: string[] = [];

      for (let i = 0; i < 10; i++) {
        const address = await deriveEthereumAddress(TEST_MNEMONIC);
        addresses.push(address);

        // Verify against expected address
        strictEqual(
          address,
          EXPECTED_ADDRESSES.ethereum,
          `Iteration ${i + 1}: Address should match expected Ethereum address`,
        );
      }

      // Verify all addresses are identical
      const uniqueAddresses = new Set(addresses);
      strictEqual(uniqueAddresses.size, 1, 'All 10 addresses should be identical');

      console.log(`✅ Ethereum: Generated same address ${addresses.length} times`);
      console.log(`   Address: ${addresses[0]}`);
    });

    it('should match expected address', async () => {
      const address = await deriveEthereumAddress(TEST_MNEMONIC);
      strictEqual(address, EXPECTED_ADDRESSES.ethereum, 'Address should match expected value');
    });
  });

  describe('BSC Wallet Consistency', () => {
    const BSC_PATH = "m/44'/60'/0'/0/0"; // BSC uses same path as Ethereum (EVM compatible, account 1005)

    async function deriveBscAddress(mnemonic: string): Promise<string> {
      const seed = await mnemonicToSeed(mnemonic);
      const masterKey = HDKey.fromMasterSeed(seed);
      const derivedKey = masterKey.derive(BSC_PATH);

      if (!derivedKey.privateKey) {
        throw new Error('Private key is undefined');
      }

      const wallet = new ethers.Wallet(toHex(derivedKey.privateKey));
      return wallet.address;
    }

    it('should generate same address 10 times in a row', async () => {
      const addresses: string[] = [];

      for (let i = 0; i < 10; i++) {
        const address = await deriveBscAddress(TEST_MNEMONIC);
        addresses.push(address);

        // Verify against expected address
        strictEqual(
          address,
          EXPECTED_ADDRESSES.bsc,
          `Iteration ${i + 1}: Address should match expected BSC address`,
        );
      }

      // Verify all addresses are identical
      const uniqueAddresses = new Set(addresses);
      strictEqual(uniqueAddresses.size, 1, 'All 10 addresses should be identical');

      console.log(`✅ BSC: Generated same address ${addresses.length} times`);
      console.log(`   Address: ${addresses[0]}`);
    });

    it('should match expected address', async () => {
      const address = await deriveBscAddress(TEST_MNEMONIC);
      strictEqual(address, EXPECTED_ADDRESSES.bsc, 'Address should match expected value');
    });
  });

  describe('EVM Chains Share Same Address', () => {
    it('should generate identical addresses for ETH and BSC', async () => {
      const seed = await mnemonicToSeed(TEST_MNEMONIC);
      const masterKey = HDKey.fromMasterSeed(seed);
      const derivedKey = masterKey.derive("m/44'/60'/0'/0/0");

      if (!derivedKey.privateKey) {
        throw new Error('Private key is undefined');
      }

      const wallet = new ethers.Wallet(toHex(derivedKey.privateKey));

      strictEqual(wallet.address, EXPECTED_ADDRESSES.ethereum, 'Should match Ethereum address');
      strictEqual(wallet.address, EXPECTED_ADDRESSES.bsc, 'Should match BSC address');
      strictEqual(
        EXPECTED_ADDRESSES.ethereum,
        EXPECTED_ADDRESSES.bsc,
        'ETH and BSC should share the same address (both EVM chains)',
      );

      console.log(`✅ EVM Chains: ETH and BSC share same address`);
      console.log(`   Address: ${wallet.address}`);
    });
  });

  describe('Cross-Blockchain Address Generation', () => {
    it('should generate all blockchain addresses consistently', async () => {
      const deriveSolanaAddress = async (mnemonic: string): Promise<string> => {
        const seed = await mnemonicToSeed(mnemonic);
        const masterKey = HDKey.fromMasterSeed(seed);
        const derivedKey = masterKey.derive("m/44'/501'/0'/0/0");

        if (!derivedKey.privateKey) throw new Error('Private key is undefined');

        const keypair = Keypair.fromSeed(derivedKey.privateKey.slice(0, 32));
        return keypair.publicKey.toBase58();
      };

      const deriveEvmAddress = async (mnemonic: string): Promise<string> => {
        const seed = await mnemonicToSeed(mnemonic);
        const masterKey = HDKey.fromMasterSeed(seed);
        const derivedKey = masterKey.derive("m/44'/60'/0'/0/0");

        if (!derivedKey.privateKey) throw new Error('Private key is undefined');

        const wallet = new ethers.Wallet(toHex(derivedKey.privateKey));
        return wallet.address;
      };

      // Test 5 times
      for (let iteration = 0; iteration < 5; iteration++) {
        const solAddress = await deriveSolanaAddress(TEST_MNEMONIC);
        const ethAddress = await deriveEvmAddress(TEST_MNEMONIC);
        const bscAddress = await deriveEvmAddress(TEST_MNEMONIC); // Same as ETH

        strictEqual(
          solAddress,
          EXPECTED_ADDRESSES.solana,
          `Iteration ${iteration + 1}: Solana address mismatch`,
        );
        strictEqual(
          ethAddress,
          EXPECTED_ADDRESSES.ethereum,
          `Iteration ${iteration + 1}: Ethereum address mismatch`,
        );
        strictEqual(
          bscAddress,
          EXPECTED_ADDRESSES.bsc,
          `Iteration ${iteration + 1}: BSC address mismatch`,
        );
      }

      console.log('✅ All blockchains generated consistent addresses across 5 iterations');
      console.log('   Solana:', EXPECTED_ADDRESSES.solana);
      console.log('   Ethereum:', EXPECTED_ADDRESSES.ethereum);
      console.log('   BSC:', EXPECTED_ADDRESSES.bsc);
    });
  });

  describe('Parallel Address Generation', () => {
    it('should generate consistent addresses when called in parallel', async () => {
      const deriveSolanaAddress = async (mnemonic: string): Promise<string> => {
        const seed = await mnemonicToSeed(mnemonic);
        const masterKey = HDKey.fromMasterSeed(seed);
        const derivedKey = masterKey.derive("m/44'/501'/0'/0/0");

        if (!derivedKey.privateKey) throw new Error('Private key is undefined');

        const keypair = Keypair.fromSeed(derivedKey.privateKey.slice(0, 32));
        return keypair.publicKey.toBase58();
      };

      // Generate 20 addresses in parallel
      const promises = Array.from({ length: 20 }, () => deriveSolanaAddress(TEST_MNEMONIC));
      const addresses = await Promise.all(promises);

      // All should be identical
      const uniqueAddresses = new Set(addresses);
      strictEqual(
        uniqueAddresses.size,
        1,
        'All 20 parallel requests should return the same address',
      );
      strictEqual(addresses[0], EXPECTED_ADDRESSES.solana, 'Address should match expected value');

      console.log('✅ Generated 20 addresses in parallel - all identical');
    });

    it('should handle parallel requests across multiple blockchains', async () => {
      const deriveSolanaAddress = async (): Promise<string> => {
        const seed = await mnemonicToSeed(TEST_MNEMONIC);
        const masterKey = HDKey.fromMasterSeed(seed);
        const derivedKey = masterKey.derive("m/44'/501'/0'/0/0");
        if (!derivedKey.privateKey) throw new Error('Private key is undefined');
        const keypair = Keypair.fromSeed(derivedKey.privateKey.slice(0, 32));
        return keypair.publicKey.toBase58();
      };

      const deriveEvmAddress = async (): Promise<string> => {
        const seed = await mnemonicToSeed(TEST_MNEMONIC);
        const masterKey = HDKey.fromMasterSeed(seed);
        const derivedKey = masterKey.derive("m/44'/60'/0'/0/0");
        if (!derivedKey.privateKey) throw new Error('Private key is undefined');
        const wallet = new ethers.Wallet(toHex(derivedKey.privateKey));
        return wallet.address;
      };

      // Make 10 parallel requests for each blockchain type
      const solanaPromises = Array.from({ length: 10 }, () => deriveSolanaAddress());
      const ethereumPromises = Array.from({ length: 10 }, () => deriveEvmAddress());
      const bscPromises = Array.from({ length: 10 }, () => deriveEvmAddress());

      const [solanaAddresses, ethereumAddresses, bscAddresses] = await Promise.all([
        Promise.all(solanaPromises),
        Promise.all(ethereumPromises),
        Promise.all(bscPromises),
      ]);

      // Verify each blockchain has only one unique address
      strictEqual(new Set(solanaAddresses).size, 1, 'All Solana addresses should be identical');
      strictEqual(new Set(ethereumAddresses).size, 1, 'All Ethereum addresses should be identical');
      strictEqual(new Set(bscAddresses).size, 1, 'All BSC addresses should be identical');

      // Verify they match expected values
      strictEqual(solanaAddresses[0], EXPECTED_ADDRESSES.solana);
      strictEqual(ethereumAddresses[0], EXPECTED_ADDRESSES.ethereum);
      strictEqual(bscAddresses[0], EXPECTED_ADDRESSES.bsc);

      console.log('✅ Handled 30 parallel requests across 3 blockchains successfully');
    });
  });

  describe('Stress Test - 100 Iterations', () => {
    it('should maintain consistency over 100 consecutive address generations', async () => {
      const deriveSolanaAddress = async (mnemonic: string): Promise<string> => {
        const seed = await mnemonicToSeed(mnemonic);
        const masterKey = HDKey.fromMasterSeed(seed);
        const derivedKey = masterKey.derive("m/44'/501'/0'/0/0");

        if (!derivedKey.privateKey) throw new Error('Private key is undefined');

        const keypair = Keypair.fromSeed(derivedKey.privateKey.slice(0, 32));
        return keypair.publicKey.toBase58();
      };

      const addresses: string[] = [];

      for (let i = 0; i < 100; i++) {
        const address = await deriveSolanaAddress(TEST_MNEMONIC);
        addresses.push(address);

        if (address !== EXPECTED_ADDRESSES.solana) {
          throw new Error(
            `Address mismatch at iteration ${i + 1}: ${address} !== ${EXPECTED_ADDRESSES.solana}`,
          );
        }
      }

      const uniqueAddresses = new Set(addresses);
      strictEqual(uniqueAddresses.size, 1, 'All 100 addresses should be identical');

      console.log('✅ Stress Test: Generated consistent address 100 times');
      console.log(`   Total iterations: ${addresses.length}`);
      console.log(`   Unique addresses: ${uniqueAddresses.size}`);
    });
  });
});
