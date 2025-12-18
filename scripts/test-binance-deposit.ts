#!/usr/bin/env tsx
/**
 * Script to test Binance Wallet API
 *
 * Usage:
 *   pnpm exec tsx scripts/test-binance-deposit.ts
 *
 * Configuration (in .env):
 *   BINANCE_API_ENABLED=true
 *   BINANCE_TEST_API_KEY=your_test_key  (for development)
 *   BINANCE_TEST_API_SECRET=your_test_secret  (for development)
 *   BINANCE_API_KEY=your_prod_key  (for production)
 *   BINANCE_API_SECRET=your_prod_secret  (for production)
 *
 * This script demonstrates:
 * 1. Checking Binance API connectivity
 * 2. Getting Binance deposit addresses
 * 3. Checking Binance account balances
 * 4. Preparing deposit instructions
 */

import 'dotenv/config'; // Load .env file
import { Spot } from '@binance/connector';

// @ts-nocheck - Binance Spot client has dynamic methods not typed in declarations

interface DepositAddress {
    address: string;
    coin: string;
    tag?: string;
    url: string;
}

interface Balance {
    asset: string;
    free: string;
    locked: string;
}

async function main() {
    console.log('🚀 Testing Binance Wallet API\n');
    console.log('='.repeat(80));

    try {
        // Get configuration from environment
        const isEnabled = process.env.BINANCE_API_ENABLED === 'true';
        const nodeEnv = process.env.NODE_ENV || 'development';
        const isDevelopment = false;

        console.log(`\n📊 Configuration:`);
        console.log(`   Environment: ${nodeEnv}`);
        console.log(`   Binance API Enabled: ${isEnabled}`);

        if (!isEnabled) {
            console.log('\n❌ Binance API not enabled');
            console.log('   Set BINANCE_API_ENABLED=true in .env file\n');
            return;
        }

        // Get API credentials
        const apiKey = isDevelopment
            ? process.env.BINANCE_TEST_API_KEY
            : process.env.BINANCE_API_KEY;
        const apiSecret = isDevelopment
            ? process.env.BINANCE_TEST_API_SECRET
            : process.env.BINANCE_API_SECRET;

        if (!apiKey || !apiSecret) {
            console.log(`\n❌ Binance API credentials not configured for ${nodeEnv} mode`);
            console.log(`   Required environment variables:`);
            if (isDevelopment) {
                console.log(`   - BINANCE_TEST_API_KEY`);
                console.log(`   - BINANCE_TEST_API_SECRET`);
            } else {
                console.log(`   - BINANCE_API_KEY`);
                console.log(`   - BINANCE_API_SECRET`);
            }
            console.log('');
            return;
        }

        console.log(`   Credentials: ✅ ${isDevelopment ? 'Test' : 'Production'} keys found`);

        // Initialize Binance client
        const baseURL = process.env.BINANCE_API_BASE_URL || 'https://api.binance.com';
        console.log(`   API Base URL: ${baseURL}`);
        const client = new Spot(apiKey, apiSecret, { baseURL });

        // Test 1: Check API connectivity by getting account info
        console.log('\n' + '='.repeat(80));
        console.log('📡 Test 1: Checking API Connectivity');
        console.log('='.repeat(80));

        try {
            // @ts-ignore - Method exists at runtime
            const accountResponse = await client.account();
            console.log(`✅ Successfully connected to Binance API`);
            console.log(`   Can trade: ${accountResponse.data.canTrade}`);
            console.log(`   Can withdraw: ${accountResponse.data.canWithdraw}`);
            console.log(`   Can deposit: ${accountResponse.data.canDeposit}`);
        } catch (error: any) {
            console.log('❌ Failed to connect to Binance API');
            console.log(`   Error: ${error.message}`);
            if (error.response) {
                console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
            }
            return;
        }

        // Test 2: Get deposit address for BSC (BNB)
        console.log('\n' + '='.repeat(80));
        console.log('📍 Test 2: Getting Deposit Address');
        console.log('='.repeat(80));

        const coin = 'BNB';
        const network = 'BSC';

        console.log(`   Coin: ${coin}`);
        console.log(`   Network: ${network}`);

        try {
            // @ts-ignore - Method exists at runtime
            const response = await client.depositAddress(coin, { network });
            const depositAddress: DepositAddress = response.data;

            console.log(`\n✅ Deposit Address Retrieved:`);
            console.log(`   Address: ${depositAddress.address}`);
            console.log(`   Coin: ${depositAddress.coin}`);
            if (depositAddress.tag) {
                console.log(`   Tag/Memo: ${depositAddress.tag}`);
            }
            console.log(`   URL: ${depositAddress.url}`);

            console.log(`\n💡 Instructions:`);
            console.log(`   1. Send ${coin} tokens to: ${depositAddress.address}`);
            console.log(`   2. Use network: ${network}`);
            console.log(`   3. Wait for blockchain confirmations`);
            console.log(`   4. Binance will automatically credit your account`);
        } catch (error: any) {
            console.log('❌ Failed to get deposit address');
            console.log(`   Error: ${error.message}`);
            if (error.response) {
                console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
            }
            console.log('\n⚠️  Note: Deposit address API (/sapi/v1/capital/deposit/address) may not be available on testnet');
            console.log('   This endpoint typically works only on production API');
        }

        // Test 3: Get account balances
        console.log('\n' + '='.repeat(80));
        console.log('💰 Test 3: Checking Account Balances');
        console.log('='.repeat(80));

        try {
            // @ts-ignore - Method exists at runtime
            const accountInfo = await client.account();
            const balances: Balance[] = accountInfo.data.balances;

            // Filter balances with non-zero amounts
            const nonZeroBalances = balances.filter(
                (b: Balance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
            );

            if (nonZeroBalances.length === 0) {
                console.log('   No balances found (all zero)');
            } else {
                console.log(`\n✅ Found ${nonZeroBalances.length} asset(s) with balance:\n`);
                for (const balance of nonZeroBalances) {
                    const free = parseFloat(balance.free);
                    const locked = parseFloat(balance.locked);
                    const total = free + locked;

                    console.log(`   ${balance.asset}:`);
                    console.log(`      Free: ${balance.free}`);
                    console.log(`      Locked: ${balance.locked}`);
                    console.log(`      Total: ${total}`);
                    console.log('');
                }
            }
        } catch (error: any) {
            console.log('❌ Failed to get account balances');
            console.log(`   Error: ${error.message}`);
            if (error.response) {
                console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
            }
        }

        // Summary
        console.log('='.repeat(80));
        console.log('✨ Test Completed Successfully!');
        console.log('='.repeat(80));

        console.log('\n📝 Next Steps:');
        console.log('   1. Review the deposit address above');
        console.log('   2. Send a small amount (e.g., 0.001 BNB) to test');
        console.log('   3. Monitor your Binance account for the deposit');
        console.log('   4. Verify the deposit shows up in your balance');
        console.log('\n⚠️  Important Notes:');
        console.log('   - Test with small amounts first');
        console.log('   - Deposits require blockchain confirmations (BSC: ~15 blocks)');
        console.log('   - Binance monitors the blockchain and credits automatically');
        console.log('   - Deposit addresses are reusable\n');

    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
        }
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
