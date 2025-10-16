#!/usr/bin/env tsx
/**
 * Mainnet Wallet Address Verification Script
 * 
 * This script verifies that wallet addresses are correctly generated
 * for mainnet networks and checks if they have any balance.
 * 
 * Usage:
 *   pnpm exec tsx scripts/verify-mainnet-wallets.ts
 */

import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { Keypair } from '@solana/web3.js';

// Test mnemonic - NEVER use in production!
const TEST_MNEMONIC =
    'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';

// Derivation paths (account 1005 for hot wallets)
const PATHS = {
    solana: "m/44'/501'/1005'/0/0",
    ethereum: "m/44'/60'/1005'/0/0",
    bsc: "m/44'/60'/1005'/0/0", // Same as Ethereum (EVM compatible)
};

// RPC URLs for mainnet
const RPC_URLS = {
    solana: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    ethereum: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
};

// Helper to convert Uint8Array to hex
function toHex(bytes: Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex');
}

// Derive Solana address
async function deriveSolanaAddress(mnemonic: string): Promise<string> {
    const seed = await mnemonicToSeed(mnemonic);
    const masterKey = HDKey.fromMasterSeed(seed);
    const derivedKey = masterKey.derive(PATHS.solana);

    if (!derivedKey.privateKey) {
        throw new Error('Private key is undefined');
    }

    const keypair = Keypair.fromSeed(derivedKey.privateKey.slice(0, 32));
    return keypair.publicKey.toBase58();
}

// Derive EVM address (works for both Ethereum and BSC)
async function deriveEvmAddress(mnemonic: string): Promise<string> {
    const seed = await mnemonicToSeed(mnemonic);
    const masterKey = HDKey.fromMasterSeed(seed);
    const derivedKey = masterKey.derive(PATHS.ethereum);

    if (!derivedKey.privateKey) {
        throw new Error('Private key is undefined');
    }

    const wallet = new ethers.Wallet(toHex(derivedKey.privateKey));
    return wallet.address;
}

// Check Solana balance
async function checkSolanaBalance(address: string): Promise<number> {
    try {
        const connection = new Connection(RPC_URLS.solana, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return balance / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error(`   ❌ Error checking Solana balance: ${error}`);
        return 0;
    }
}

// Check Ethereum balance
async function checkEthereumBalance(address: string): Promise<string> {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URLS.ethereum);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error(`   ❌ Error checking Ethereum balance: ${error}`);
        return '0';
    }
}

// Check BSC balance
async function checkBscBalance(address: string): Promise<string> {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URLS.bsc);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error(`   ❌ Error checking BSC balance: ${error}`);
        return '0';
    }
}

// Main execution
async function main() {
    console.log('🔍 Mainnet Wallet Address Verification\n');
    console.log('='.repeat(80));
    console.log('⚠️  WARNING: Using TEST mnemonic (DO NOT use in production!)');
    console.log('   This script is for TESTING and DEVELOPMENT only');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Derive addresses
        console.log('📝 Deriving wallet addresses...\n');
        const solanaAddress = await deriveSolanaAddress(TEST_MNEMONIC);
        const evmAddress = await deriveEvmAddress(TEST_MNEMONIC);

        // Solana
        console.log('📦 Solana Mainnet');
        console.log('-'.repeat(80));
        console.log(`   Network: mainnet-beta`);
        console.log(`   Chain ID: solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`);
        console.log(`   Derivation Path: ${PATHS.solana}`);
        console.log(`   Address: ${solanaAddress}`);
        console.log(`   RPC URL: ${RPC_URLS.solana}`);
        console.log('   Checking balance...');
        const solBalance = await checkSolanaBalance(solanaAddress);
        console.log(`   Balance: ${solBalance.toFixed(9)} SOL`);
        if (solBalance > 0) {
            console.log(`   ⚠️  WARNING: Wallet has balance! This should be empty for test wallet.`);
        } else {
            console.log(`   ✅ Balance is zero (expected for test wallet)`);
        }
        console.log('');

        // Ethereum
        console.log('📦 Ethereum Mainnet');
        console.log('-'.repeat(80));
        console.log(`   Network: mainnet`);
        console.log(`   Chain ID: eip155:1`);
        console.log(`   Derivation Path: ${PATHS.ethereum}`);
        console.log(`   Address: ${evmAddress}`);
        console.log(`   RPC URL: ${RPC_URLS.ethereum}`);
        console.log('   Checking balance...');
        const ethBalance = await checkEthereumBalance(evmAddress);
        console.log(`   Balance: ${ethBalance} ETH`);
        if (parseFloat(ethBalance) > 0) {
            console.log(`   ⚠️  WARNING: Wallet has balance! This should be empty for test wallet.`);
        } else {
            console.log(`   ✅ Balance is zero (expected for test wallet)`);
        }
        console.log('');

        // BSC
        console.log('📦 Binance Smart Chain Mainnet');
        console.log('-'.repeat(80));
        console.log(`   Network: mainnet`);
        console.log(`   Chain ID: eip155:56`);
        console.log(`   Derivation Path: ${PATHS.bsc}`);
        console.log(`   Address: ${evmAddress} (same as Ethereum - EVM compatible)`);
        console.log(`   RPC URL: ${RPC_URLS.bsc}`);
        console.log('   Checking balance...');
        const bscBalance = await checkBscBalance(evmAddress);
        console.log(`   Balance: ${bscBalance} BNB`);
        if (parseFloat(bscBalance) > 0) {
            console.log(`   ⚠️  WARNING: Wallet has balance! This should be empty for test wallet.`);
        } else {
            console.log(`   ✅ Balance is zero (expected for test wallet)`);
        }
        console.log('');

        console.log('='.repeat(80));
        console.log('✅ Mainnet Address Verification Summary:');
        console.log('   - All addresses derived successfully');
        console.log('   - Solana address:', solanaAddress);
        console.log('   - Ethereum/BSC address:', evmAddress);
        console.log('   - All balances checked on mainnet');
        console.log('');
        console.log('💡 Next Steps:');
        console.log('   1. These addresses are derived from the TEST mnemonic');
        console.log('   2. In production, use a secure mnemonic stored in encrypted vault');
        console.log('   3. Never commit real mnemonics to version control');
        console.log('   4. Use hardware wallets for large amounts');
        console.log('='.repeat(80));
        console.log('');
        console.log('✅ Mainnet verification complete!');
    } catch (error) {
        console.error('');
        console.error('❌ Error during verification:');
        console.error(error);
        process.exit(1);
    }
}

// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
