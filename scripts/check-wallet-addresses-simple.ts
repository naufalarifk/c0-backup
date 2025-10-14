#!/usr/bin/env tsx

/**
 * Simple Wallet Address Checker
 *
 * Checks hot wallet addresses for Solana, Ethereum, and BSC
 */

import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';

// Mock config service
class MockConfigService {
    get(key: string, defaultValue?: any): any {
        const config: Record<string, any> = {
            MASTER_SEED: process.env.MASTER_SEED || '',
        };
        return config[key] ?? defaultValue;
    }
}

async function checkAddresses() {
    console.log('🔍 Checking Hot Wallet Addresses\n');
    console.log('='.repeat(80));

    // Use test mnemonic from test/setup/setup.ts
    const TEST_MNEMONIC = 'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';
    const masterSeed = process.env.MASTER_SEED || process.env.WALLET_MNEMONIC || TEST_MNEMONIC;

    if (!masterSeed) {
        console.log('❌ No mnemonic found');
        console.log('   Please set MASTER_SEED or WALLET_MNEMONIC environment variable');
        return;
    }

    console.log('✅ Using test mnemonic (same as E2E tests)');
    console.log('   Source: test/setup/setup.ts\n');

    try {
        const seed = mnemonicToSeedSync(masterSeed);
        const masterKey = HDKey.fromMasterSeed(seed);

        // Solana (coin type 501) - Using default path (account 0)
        console.log('\n📦 Solana Wallets');
        console.log('-'.repeat(80));
        const solPath = "m/44'/501'/0'/0/0";
        const solKey = masterKey.derive(solPath);
        if (solKey.privateKey) {
            const solKeypair = Keypair.fromSeed(solKey.privateKey.slice(0, 32));
            console.log(`   Derivation Path: ${solPath} (account 0 - default)`);
            console.log(`   Hot Wallet Address: ${solKeypair.publicKey.toBase58()}`);
            console.log(`   Network Support: mainnet-beta, testnet, devnet`);
        }

        // Ethereum (coin type 60) - Using default path (account 0)
        console.log('\n📦 Ethereum Wallets');
        console.log('-'.repeat(80));
        const ethPath = "m/44'/60'/0'/0/0";
        const ethKey = masterKey.derive(ethPath);
        if (ethKey.privateKey) {
            const ethWallet = new ethers.Wallet(Buffer.from(ethKey.privateKey).toString('hex'));
            console.log(`   Derivation Path: ${ethPath} (account 0 - default)`);
            console.log(`   Hot Wallet Address: ${ethWallet.address}`);
            console.log(`   Network Support: mainnet (eip155:1), sepolia (eip155:11155111)`);
        }

        // BSC uses same derivation as Ethereum (coin type 60) - account 0
        console.log('\n📦 Binance Smart Chain Wallets');
        console.log('-'.repeat(80));
        const bscPath = "m/44'/60'/0'/0/0";
        const bscKey = masterKey.derive(bscPath);
        if (bscKey.privateKey) {
            const bscWallet = new ethers.Wallet(Buffer.from(bscKey.privateKey).toString('hex'));
            console.log(`   Derivation Path: ${bscPath} (account 0 - default)`);
            console.log(`   Hot Wallet Address: ${bscWallet.address}`);
            console.log(`   Network Support: mainnet (eip155:56), testnet (eip155:97)`);
            console.log(`   Note: Same address as Ethereum (EVM-compatible)`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ Address Derivation Summary:');
        console.log('   - All addresses derived from same master seed using BIP44');
        console.log('   - Solana: Uses coin type 501 (SOL-specific)');
        console.log('   - Ethereum & BSC: Use coin type 60 (shared address)');
        console.log('   - Hot wallet account index: 0 (default - same as MetaMask)');
        console.log('   - Invoice wallets: Account index 5, address_index varies');
        console.log('');
        console.log('💡 MetaMask Compatible:');
        console.log('   - Import mnemonic into MetaMask');
        console.log('   - Account 1 (actually account 0) will show the hot wallet');
        console.log('   - No need to create multiple accounts');
        console.log('\n💡 Security Note:');
        console.log('   - ETH and BSC share the same addresses (EVM-compatible)');
        console.log('   - This is expected behavior for EVM chains');
        console.log('   - Different networks use different chain IDs for security');

    } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    }
}

checkAddresses()
    .then(() => {
        console.log('\n✅ Address check complete!\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    });
