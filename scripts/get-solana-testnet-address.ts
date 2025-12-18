/**
 * Get Solana Hot Wallet Address from Test Mnemonic
 * This script derives the Solana address from the standard test mnemonic
 */

import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { mnemonicToSeedSync } from '@scure/bip39';

// BIP39 mnemonic used in tests
const MNEMONIC = 'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle';

// Solana derivation path for hot wallet (m/44'/501'/0'/0')
const DERIVATION_PATH = "m/44'/501'/0'/0'";

function getSolanaAddress() {
    try {
        console.log('');
        console.log('🔐 Deriving Solana Hot Wallet Address');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📝 Using test mnemonic:');
        console.log('  ', MNEMONIC);
        console.log('');

        // Generate seed from mnemonic (synchronously)
        const seed = mnemonicToSeedSync(MNEMONIC);
        console.log('✅ Seed generated');

        // Derive key using BIP44 path for Solana
        const seedHex = Buffer.from(seed).toString('hex');
        const derivedSeed = derivePath(DERIVATION_PATH, seedHex).key;
        console.log('✅ Key derived using path:', DERIVATION_PATH);

        // Create keypair
        const keypair = Keypair.fromSeed(derivedSeed);
        const address = keypair.publicKey.toBase58();

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ SOLANA HOT WALLET ADDRESS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('  ', address);
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');

        const isDevnet = process.env.SOLANA_USE_DEVNET === 'true';
        const isTestnet = process.env.SOLANA_USE_TESTNET === 'true';
        const network = isDevnet ? 'devnet' : isTestnet ? 'testnet' : 'mainnet';
        const blockchainKey = isDevnet
            ? 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
            : isTestnet
                ? 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z'
                : 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

        console.log('📋 Blockchain Key:', blockchainKey);
        console.log('🌐 Network:', network.toUpperCase());
        console.log('');

        if (isDevnet || isTestnet) {
            console.log('💰 Get testnet/devnet SOL from faucet:');
            console.log('   https://faucet.solana.com');
            console.log('');
            console.log('🔍 Check balance on explorer:');
            console.log(`   https://explorer.solana.com/address/${address}?cluster=${network}`);
            console.log('');
            console.log('📋 Copy this address for faucet:');
            console.log(`   ${address}`);
        } else {
            console.log('⚠️  This is MAINNET address');
            console.log('🔍 Check balance on explorer:');
            console.log(`   https://explorer.solana.com/address/${address}`);
        }

        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

getSolanaAddress();
