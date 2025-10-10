/**
 * Simple script to get Solana hot wallet address
 * Run with: SOLANA_USE_TESTNET=true node --import tsx scripts/get-address-simple.ts
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

// Import the test setup
import { setup, cleanup } from '../test/setup/setup';

test('Get Solana Hot Wallet Address', async () => {
    // Start the test server
    const testSetup = await setup();

    try {
        // Query the Solana balance endpoint
        const response = await fetch(
            `${testSetup.backendUrl}/api/test/settlement/solana-balance`
        );

        const data = await response.json();

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ SOLANA HOT WALLET ADDRESS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('  ', data.address);
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📋 Blockchain:', data.blockchain);
        console.log('🌐 Network:', data.network || 'mainnet');
        console.log('💰 Current Balance:', data.balanceInSOL, 'SOL');
        console.log('📡 RPC URL:', data.rpcUrl);
        console.log('');

        if (data.network === 'testnet' || data.blockchain.includes('testnet')) {
            console.log('💰 Get testnet SOL from faucet:');
            console.log('   https://faucet.solana.com');
            console.log('');
            console.log('🔍 Check balance on explorer:');
            console.log(`   https://explorer.solana.com/address/${data.address}?cluster=testnet`);
        } else {
            console.log('⚠️  This is MAINNET - use real SOL only!');
        }
        console.log('');

        assert.ok(data.success, 'Should successfully get balance');
        assert.ok(data.address, 'Should have an address');
    } finally {
        // Cleanup
        await cleanup();
    }
});
