#!/usr/bin/env tsx

/**
 * Wallet Address Checker
 *
 * This script checks and displays hot wallet addresses for all supported blockchains.
 * It verifies that wallet address derivation is working correctly across different networks.
 *
 * Usage:
 *   pnpm tsx scripts/check-wallet-addresses.ts
 */

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { WalletFactory } from '../src/shared/wallets/wallet.factory';
import { WalletModule } from '../src/shared/wallets/wallet.module';

// Supported blockchain keys (CAIP-2 format)
const BLOCKCHAIN_KEYS = {
    // Solana
    'Solana Mainnet': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    'Solana Testnet': 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
    'Solana Devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',

    // Ethereum
    'Ethereum Mainnet': 'eip155:1',
    'Ethereum Sepolia': 'eip155:11155111',

    // Binance Smart Chain
    'BSC Mainnet': 'eip155:56',

    // Bitcoin
    'Bitcoin Mainnet': 'bip122:000000000019d6689c085ae165831e93',
    'Bitcoin Testnet': 'bip122:000000000933ea01ad0ee984209779ba61f8d4362f5cb2f17e5e2c77d0d0dffc',

    // CryptoGadai Testnet
    'CG Testnet': 'cg:testnet',
};

async function checkWalletAddresses() {
    console.log('🔍 Checking Hot Wallet Addresses\n');
    console.log('='.repeat(80));

    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(WalletModule, {
        logger: false, // Disable logging for cleaner output
    });

    const walletFactory = app.get(WalletFactory);

    // Check each blockchain
    for (const [name, blockchainKey] of Object.entries(BLOCKCHAIN_KEYS)) {
        try {
            const blockchain = walletFactory.getBlockchain(blockchainKey);

            if (!blockchain) {
                console.log(`❌ ${name}`);
                console.log(`   Key: ${blockchainKey}`);
                console.log(`   Status: NOT REGISTERED`);
                console.log();
                continue;
            }

            // Get hot wallet
            const hotWallet = await blockchain.getHotWallet();
            const address = await hotWallet.getAddress();

            // Get BIP44 coin type
            const coinType = blockchain.bip44CoinType;
            const derivationPath = `m/44'/${coinType}'/1005'/0/0`;
            const mnemonic = app.get(ConfigService).get<string>('MASTER_SEED')

            console.log(`✅ ${name}`);
            console.log(`   Key: ${blockchainKey}`);
            console.log(`   BIP44 Coin Type: ${coinType}`);
            console.log(`   Derivation Path: ${derivationPath}`);
            console.log(`   Hot Wallet Address: ${address}`);
            console.log();
        } catch (error) {
            console.log(`❌ ${name}`);
            console.log(`   Key: ${blockchainKey}`);
            console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.log();
        }
    }

    console.log('='.repeat(80));
    console.log('\n📝 Summary:');
    console.log('   - All addresses are derived using BIP44 standard');
    console.log('   - Hot wallet derivation path: m/44\'/<coin_type>\'/1005\'/0/0');
    console.log('   - Invoice wallets use: m/44\'/<coin_type>\'/5\'/0/<invoice_id>');
    console.log('\n💡 Note: Addresses are deterministically derived from master seed');

    await app.close();
}

// Run the checker
checkWalletAddresses()
    .then(() => {
        console.log('\n✅ Address check complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Address check failed:', error);
        process.exit(1);
    });
